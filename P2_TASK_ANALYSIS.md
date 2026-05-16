# P2 Backend Task Analysis: What's Done, What's Needed

## Role: P2 — Backend / Memory / Redis #1 (Load-bearing Primitives)

You are responsible for wiring **session_id end-to-end** and building the **Redis primitives** that make the core loop work. This is the load-bearing piece judges will score on.

---

## ✅ What Already Exists (Main Branch)

### Files Already Created
1. **`backend/memory.py`** ⚠️ **NEEDS REDIS INTEGRATION**
   - Current state: thin wrapper around cognee with fallback
   - Missing: Redis client, sorted sets, TTL keys, session_id routing
   
2. **`backend/ingest.py`** ⚠️ **NEEDS SESSION_ID ROUTING**
   - Current state: calls memory.remember(), extracts concepts
   - Missing: seeding Redis mastery state for new concepts
   
3. **`backend/config.py`** ✅ **COMPLETE**
   - Paths defined, directories created
   
4. **`backend/main.py`** ⚠️ **NEEDS REDIS ENDPOINTS**
   - Current state: basic FastAPI + ingest endpoint
   - Missing: `/mastery-state`, rate endpoint, session handling
   
5. **`backend/lint.py`** ⚠️ **NEEDS FADING-CONCEPTS RULE**
   - Current state: 3 existing rules (missing concepts, orphans, weak bridges)
   - Missing: Redis query for concepts below mastery threshold
   
6. **`backend/query.py`** ⚠️ **NEEDS SESSION_ID PARAMETER**
   - Current state: basic BM25 + cognee recall
   - Missing: session_id tracking, concept-touching logging
   
7. **`backend/search.py`** ✅ **EXISTS** (BM25 search)
8. **`backend/wiki_writer.py`** ✅ **EXISTS** (wiki generation)
9. **`backend/extractor.py`** ✅ **EXISTS** (concept extraction)
10. **`backend/parser.py`** ✅ **EXISTS** (PDF/markdown parsing)
11. **`backend/graph.py`** ⚠️ **NEEDS MASTERY STATE IN JSON**

---

## ❌ What You (P2) Need to Create/Update

### Your Primary Responsibilities (in priority order):

#### **1. Enhance `backend/memory.py` — The Core Redis Layer** ⭐ CRITICAL

This is your load-bearing piece. It needs:

```python
# NEW: Redis client setup
# NEW: Sorted set operations for mastery state
# NEW: TTL key operations for forgetting curve
# NEW: Distillation rule (mastery ≥ 0.7 → cognee.remember)
# NEW: Session-scoped mastery management

# Functions to add:
- set_mastery(session_id, concept_slug, score: 0..1) -> None
- bump_mastery(session_id, concept_slug, delta: float) -> None
- get_mastery(session_id, concept_slug) -> float
- fading_concepts(session_id, threshold: float = 0.4) -> list[str]
- seed_concept_mastery(session_id, concepts: list[str]) -> None
- log_event(session_id, event_type, metadata) -> None
- get_recent_events(session_id, limit: int = 50) -> list
```

**Key design:**
- Redis key shape for mastery: `mastery:{session_id}` (sorted set)
- Redis key shape for events: `events:{session_id}` (stream)
- Redis TTL for concept keys: `concept:{session_id}:{slug}` with TTL = `DEMO_TIME_SCALE` × forgetting curve
- Distillation rule: when mastery ≥ 0.7 across 2 sessions, call `cognee.remember(..., metadata={"known_as_of": timestamp})`

**Questions for you:**
1. What should the initial mastery score be for a newly extracted concept? (e.g., 0.2?)
2. How much should bumping mastery go up per interaction? (e.g., +0.1 per query touch, +0.3 per rating ≥ 0.7?)
3. For the distillation rule — do you want to check mastery history across multiple sessions, or just trigger on ≥ 0.7 in current session?
4. What's your Redis host/port? Should it be in config or .env?

---

#### **2. Update `backend/ingest.py` — Seed Mastery on Upload** 

Add session_id handling:

```python
# NEW: Accept session_id parameter
# NEW: Call memory.seed_concept_mastery() with extracted concepts
# NEW: Log ingest event to Redis stream

async def ingest_file(path: Path, session_id: str) -> dict:
    # ... existing extraction logic ...
    
    # NEW: seed mastery state for each concept
    await memory.seed_concept_mastery(session_id, extraction.concepts)
    
    # NEW: log event
    await memory.log_event(session_id, "ingest", {
        "file": path.name,
        "concepts": extraction.concepts,
        "count": len(extraction.concepts)
    })
    
    return { ... }
```

**Questions for you:**
1. When a document is ingested, should all extracted concepts start at the same mastery level, or should you weight them by prominence?
2. Do you want to track which *source* touched which concept? (for audit trail / lint?)

---

#### **3. Update `backend/main.py` — Wire Session_ID + New Endpoints**

Add these endpoints:

```python
# NEW endpoint 1: Get current mastery state (for frontend bars)
@app.get("/mastery-state")
async def get_mastery_state(session_id: str) -> dict:
    # Return sorted set dump from Redis
    
# NEW endpoint 2: Rate an answer (triggers bump + SkillRunEntry proposal)
@app.post("/rate")
async def rate_answer(session_id: str, rating: float, concepts_touched: list[str]) -> dict:
    # Bump mastery for each concept touched
    # Log event
    # Call SkillRunEntry if available
    
# UPDATE: /ingest to accept session_id
@app.post("/ingest")
async def post_ingest(file: UploadFile = File(...), session_id: str = Query(...)) -> dict:
    # ... pass session_id through to ingest.ingest_file(dest, session_id)
    
# KEEP: /lint should also accept session_id for fading-concepts query
@app.get("/lint")
async def get_lint(session_id: str) -> dict:
    # ... pass to lint.run(session_id)
```

**Questions for you:**
1. How should we generate or receive the session_id? Should the frontend send a UUID, or should the backend auto-generate one per visit?
2. Should session data be persisted to Redis forever, or should sessions have a max lifetime (e.g., expire after 7 days)?

---

#### **4. Update `backend/lint.py` — Add Fading-Concepts Rule** 

Add the new lint rule (the one that surfaces forgotten concepts):

```python
def run(session_id: str) -> dict:
    # ... existing 3 rules ...
    
    # NEW RULE: Fading concepts (mastery < threshold, not consolidated to graph)
    fading = memory.fading_concepts(session_id, threshold=0.4)
    for slug in fading:
        # Check if it's in the graph (consolidated)
        is_consolidated = ...  # check cognee or concepts.json
        if not is_consolidated:
            issues.append({
                "type": "fading_concept",
                "name": slug,
                "mastery": memory.get_mastery(session_id, slug),
                "message": f"Concept `{slug}` is fading (mastery < 0.4) and not yet consolidated. Review soon."
            })
    
    return { "issues": issues, ... }
```

**Questions for you:**
1. What mastery threshold counts as "fading"? (Currently plan says 0.4, but confirm?)
2. Should the lint output also suggest which study guide or bridge page could help reinforce the fading concept?

---

#### **5. Update `backend/query.py` — Track Session_ID + Concepts Touched**

Add session tracking:

```python
async def answer(question: str, session_id: str, k: int = 5) -> dict:
    hits = search.search(question, k=k)
    recalled = await memory.recall(question, limit=k)
    
    # NEW: extract which concepts were touched
    concepts_touched = [h['concept_slug'] for h in hits if 'concept_slug' in h]
    
    # NEW: bump mastery slightly for concepts mentioned
    for slug in concepts_touched:
        await memory.bump_mastery(session_id, slug, delta=0.05)  # light touch
    
    # NEW: log query event
    await memory.log_event(session_id, "query", {
        "question": question,
        "concepts_touched": concepts_touched,
        "hit_count": len(hits),
        "recalled_count": len(recalled)
    })
    
    return {
        "question": question,
        "answer": answer_md,
        "concepts_touched": concepts_touched,  # NEW: return this for rating phase
        "backend": memory.backend_name(),
    }
```

**Questions for you:**
1. When a concept appears in search results, should it bump mastery by the same amount regardless of position (top = same bump as bottom), or should ranking matter?
2. Is +0.05 per mention the right delta, or should it be configurable?

---

#### **6. Create `backend/improve.py` — Skeleton for P3**

You need to create this file so P3 has a place to build the skill-rewrite logic. Stub it:

```python
"""Skill improvement loop: SkillRunEntry → SKILL.md rewrite."""
from __future__ import annotations

async def propose_improvement(session_id: str, last_answer_score: float) -> dict:
    """Propose a rewrite of SKILL.md based on student performance."""
    # Stub for P3 to implement
    return {
        "skill_name": "personalized-explainer",
        "proposed_change": "# TODO: P3 implements this",
        "before": "",
        "after": "",
    }

async def apply_improvement() -> dict:
    """Apply the proposed SKILL.md rewrite."""
    # Stub for P3
    return { "applied": False, "message": "P3 implements this" }
```

---

## Summary: Your Deliverables (P2)

| File | Action | Status |
|---|---|---|
| `backend/memory.py` | **Rewrite** to add Redis layer (sorted sets, TTL, streams) | ❌ Needs work |
| `backend/ingest.py` | **Update** to seed mastery + log events | ⚠️ Partially done |
| `backend/main.py` | **Update** to add `/mastery-state`, `/rate` endpoints; wire session_id | ⚠️ Partially done |
| `backend/lint.py` | **Update** to add fading-concepts rule | ⚠️ Partially done |
| `backend/query.py` | **Update** to track concepts touched + log events | ⚠️ Partially done |
| `backend/improve.py` | **Create** stubs for P3 | ❌ Doesn't exist |
| `backend/config.py` | **Update** with Redis config (host, port, DEMO_TIME_SCALE, thresholds) | ⚠️ Partially done |

---

## Critical Design Questions I Need You to Answer

Before you start coding, please answer these:

### Redis & Mastery
1. **Initial mastery score:** What's the starting score for a newly extracted concept?
2. **Mastery delta per interaction:** How much should each type of interaction bump mastery?
   - Query hit (low confidence)?
   - Rating ≥ 0.7 (high confidence)?
   - Concept mentioned in a bridge page (reinforcement)?
3. **Distillation rule:** Should distillation (Redis → Cognee graph) trigger on:
   - Sustained ≥ 0.7 across 2+ sessions, OR
   - Single high rating (≥ 0.8), OR
   - Both?

### Session Management
4. **Session lifecycle:** How long should a session live in Redis?
   - Until manually cleared?
   - Max 7 days?
   - Only during one browser tab?
5. **Session ID source:** Should it be:
   - Auto-generated by backend (`uuid4()`)?
   - Provided by frontend (JWT-like)?
   - Something else?

### Redis Config
6. **Redis host/port:** What are yours? (localhost:6379 is typical)
7. **DEMO_TIME_SCALE:** Is 100× correct for demo (1 day → 14 seconds)?
8. **Fading threshold:** Is 0.4 the right cutoff for "fading"?

### Data Persistence
9. **Event stream:** Keep all events forever, or prune after N days?
10. **Graph promotion:** Once a concept is distilled to Cognee graph with `known_as_of`, should it stay there forever or also have a TTL?

---

## Next Steps (After You Answer)

1. Answer the 10 questions above.
2. I'll create detailed specs for each file.
3. You implement `backend/memory.py` first (foundation for everything else).
4. Coordinate with P3 on the `/rate` endpoint payload format.
5. Coordinate with P4 on what the `/mastery-state` and `/events/decay` endpoints should return for the UI.

Ready to start? Send me your answers! 🚀

