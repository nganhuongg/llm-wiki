# StudyAtlas: A Personalized LLM Wiki for Students

> Hackathon plan — Cognee × Redis AI-Memory Hackathon, 2026-05-16.
> Team of 4, ~2 hours of build time, 3-minute demo.

## 1. One-Sentence Pitch

> StudyAtlas turns scattered course materials into a personalized wiki — and uses Redis as the *student's* working memory (what they saw recently, what's decaying, what's confusing them right now) to make every answer anchor on what that specific student already understands.

## 2. The Hook (read first)

Two memory tiers, deliberately mapped:

- **Redis = the student's working memory.** Every study event — page viewed, question asked, "I get it" / "I don't get it" rating, concept brushed against in a query — is written to Redis under a `session_id`, with a TTL that mirrors the forgetting curve. Mastery state per concept lives here and *decays*.
- **Cognee = the student's consolidated knowledge.** When a concept is reinforced across enough sessions, it's promoted into the permanent graph with a `known_as_of` timestamp. The graph holds course pages, concept pages, bridges, and the *history of what the student has actually internalized*.

This is the load-bearing pattern the hackathon brief flags twice. Most teams will use Redis as a generic cache; we make it the cognitive working-memory analogue, which is the part judges are scoring.

## 3. The Three Required Operations

| Operation | What StudyAtlas does |
|---|---|
| **Ingest** | Pulls syllabi, readings, notes, and a short "what I'm confused about" note into the wiki. Each event also seeds Redis with initial mastery state per concept. |
| **Query + Self-improve** | Answers questions against the wiki, anchored on the student's strong areas. After each run, a `SkillRunEntry` proposes a rewrite of the `personalized-explainer` skill; we apply it explicitly. **Before/after on the same question is the demo's money shot.** |
| **Lint** | Surfaces gaps: missing concept pages, weak bridges, *and forgotten concepts* (mastery state has decayed past a threshold without consolidation). |

## 4. Why This Wins

- **Redis is genuinely load-bearing**, not decorative. TTL = forgetting curve, mastery state in Redis, distillation rule from Redis → graph is explicit.
- **Self-improvement has a visible diff**: a `SKILL.md` rewrite shown live in the demo.
- **Pain is universal** — every student forgets, every wiki is dead text. StudyAtlas connects the two.

## 5. Demo Script (3 minutes, optimized for the money shot)

| Time | What happens |
|---|---|
| 0:00–0:20 | **Hook.** "Students forget. Wikis don't. Here's why that gap matters." |
| 0:20–0:50 | **Ingest.** Drop 2 syllabi + a "things I'm confused about" note. Wiki pages appear. Show Redis populated with initial mastery state. |
| 0:50–1:30 | **Baseline query.** Ask: *"Explain hypothesis testing using something I already understand."* Generic answer. Student rates 0.3. Show the Redis session log + mastery-decay panel. |
| 1:30–2:10 | **Self-improve.** Click "Improve." `SkillRunEntry` records the failure → cognee proposes a `personalized-explainer` rewrite that anchors on writing/argumentation (the student's strong area). **Show the SKILL.md diff on screen.** Apply it. |
| 2:10–2:40 | **Improved query.** Same question. New answer anchors on argument structure. Score jumps to 0.8. |
| 2:40–3:00 | **Lint + close.** Run lint — surfaces a *forgotten* concept (mastery decayed past threshold) plus a missing bridge. Close: "Redis is the student's working memory, Cognee is their consolidated knowledge. The wiki learns *this* student." |

## 6. Architecture

```text
                  [ student ]
                       |
                       v
   +-------------------------------------------+
   |  FastAPI backend                          |
   |   - /ingest, /query, /improve, /lint      |
   +----------------+--------------------------+
                    |
        +-----------+-----------+
        |                       |
        v                       v
   +----------+         +-------------------+
   | Redis    |         | Cognee            |
   | session  |         | permanent graph   |
   | memory   |  ---->  | + skills          |
   | (TTL =   |  promote| + SKILL.md        |
   | forget)  |         |                   |
   +----------+         +-------------------+
```

**Redis stores per `session_id`:**
- raw study events (page viewed, query asked, rating given)
- per-concept `mastery_state` (float 0..1, TTL decays over hours/days)
- recent query history for the current study session

**Distillation rule (Redis → Cognee):**
A concept gets `cognee.remember(...)`'d with a `known_as_of` timestamp when:
- it's referenced positively across ≥ N sessions, OR
- the student explicitly rates a related answer ≥ 0.7, OR
- a `bridge` page touching it is saved.

**Cognee stores:**
- course pages, concept pages, source pages, bridge pages
- the `personalized-explainer` skill (rewritten via the propose/apply loop)
- consolidated concept history with timestamps

## 7. The Self-Improvement Loop (this is the differentiator)

Single skill: `my_skills/personalized-explainer/SKILL.md`.

```markdown
---
description: Explain concepts to this student by anchoring on what they already understand.
allowed-tools: memory_search
---

# Instructions

When answering, retrieve the student's profile and recent mastery state.
Anchor new concepts on areas where mastery is high.
Avoid metaphors from areas the student has rated low.
```

Loop, lifted from the hackathon brief:

1. Student asks a question → `cognee.search(query_type=AGENTIC_COMPLETION, skills=["personalized-explainer"], session_id=...)`.
2. Student rates the answer (0..1). We compute `success_score`.
3. `cognee.remember(SkillRunEntry(...), skill_improvement={"apply": False, "score_threshold": 0.7})` → cognee **proposes** a rewrite.
4. We display the proposed `SKILL.md` diff and call `improve_skill(..., apply=True)`.
5. Same question, re-run, new answer. Score jumps. **This is the demo moment.**

## 8. Backend Modules (only what we'll actually build)

| Module | Purpose | Owner |
|---|---|---|
| `backend/memory.py` | Wraps cognee. Adds `session_id` routing, `mastery_state` read/write to Redis with TTL, distillation rule. | P1 |
| `backend/ingest.py` | Reads PDFs/markdown, extracts concept list, seeds Redis mastery state, writes initial wiki pages. | P1 |
| `backend/query.py` | Calls `cognee.search` with `personalized-explainer` skill. Returns answer + the concepts it leaned on. | P2 |
| `backend/improve.py` | Wraps `SkillRunEntry` + `improve_skill`. Returns the proposed SKILL.md diff. | P2 |
| `backend/lint.py` | Three rules: missing concept pages, weak bridges, **forgotten concepts** (mastery < threshold, last_seen > N days). | P4 |
| `backend/graph.py` | Concept graph as JSON. Nodes carry `mastery` + `known_as_of`. | P3 |

## 9. Frontend (only the demo panels)

- **Upload panel** — drag/drop syllabi + a confusion note.
- **Wiki viewer** — read generated pages.
- **Query panel** — ask question, see answer, rate 0..1.
- **Mastery timeline** (new, demo-critical) — small chart of mastery state per concept, pulled from Redis. Shows decay visually.
- **Skill diff viewer** (new, demo-critical) — renders the `SKILL.md` before/after when `improve` proposes a rewrite.
- **Graph view** — NetworkX → JSON → simple force layout. Nodes colored by mastery.
- **Lint panel** — list of issues, with "forgotten concepts" highlighted.

## 10. Four-Person Split

### P1 — Redis + memory layer (the hackathon's load-bearing piece)
1. `backend/memory.py`: wire `session_id` end-to-end. Function `set_mastery(concept, score, ttl)` and `get_mastery_state()` over Redis.
2. Forgetting-curve TTL (use real seconds for demo speed, e.g., 60s = 1 "day").
3. Distillation rule: positive references across ≥ 2 sessions → `cognee.remember(..., metadata={"known_as_of": ts})`.

### P2 — Skill loop (the demo money shot)
1. Author `my_skills/personalized-explainer/SKILL.md`.
2. `backend/query.py`: wire `cognee.search(skills=[...], session_id=...)`.
3. `backend/improve.py`: `SkillRunEntry` + `improve_skill(apply=True)`. Return the SKILL.md diff as part of the response.
4. Seed one canned scenario where baseline answer fails and the rewrite obviously wins.

### P3 — Frontend (focus on the two demo-critical panels)
1. Mastery timeline (reads `/mastery-state`).
2. Skill diff viewer (renders `/improve` response).
3. Graph view if time. Wire color by mastery.

### P4 — Lint + demo data + pitch
1. `backend/lint.py`: three rules including the forgotten-concepts rule.
2. Prep the demo dataset: 2 syllabi (psychology + statistics works well — they share concepts), 1 student confusion note ("I'm strong on writing arguments, weak on stats notation").
3. Write and time the 3-minute script. Run it twice before submission.

## 11. API (minimal surface)

| Method | Path | Purpose |
|---|---|---|
| POST | `/ingest` | Upload a document or note |
| POST | `/query` | Ask a question, returns answer + concepts touched |
| POST | `/rate` | Rate an answer 0..1 → triggers `SkillRunEntry` |
| POST | `/improve` | Apply a proposed skill rewrite, returns the diff |
| GET | `/mastery-state` | Current Redis mastery state for the active session |
| GET | `/lint` | Lint report |
| GET | `/graph` | Concept graph JSON |
| GET | `/wiki/pages`, `/wiki/page/{path}` | Wiki browse |

## 12. Self-Improvement Evidence (for the submission)

| | Baseline | After improve |
|---|---|---|
| Question | "Explain hypothesis testing using something I already understand." | (same) |
| Answer style | Textbook definition, generic examples | Anchored on argument structure (student's strong area) |
| `success_score` | 0.3 | 0.8 |
| Skill change | — | SKILL.md gains a rule: "for this student, always tie statistical inference back to argument/claim structure" |

The SKILL.md diff is the artifact we paste into the submission.

## 13. What We're Explicitly Not Building

- Multi-agent framework
- Auth, user accounts
- Production PDF parsing (use easy PDFs in the demo set)
- Multiple skill files (one is enough to show the loop)
- Embeddings/vector search beyond what cognee gives us out of the box
- Pretty graph layouts (force-directed default is fine)
- A learning analytics dashboard

## 14. Risk Register

| Risk | Mitigation |
|---|---|
| Cognee skill rewrite produces a bad proposal in front of judges | Pre-run the loop once; if the proposal is good, freeze that exact run as the demo. We can replay against a canned dataset. |
| Redis distillation rule is invisible to judges | Mastery timeline panel + a small "promoted to graph" toast when distillation fires. |
| 3 minutes is tight | Don't introduce, don't read slides — start typing into the upload box at 0:20. |
| One person blocks another | P2 can develop against a stubbed `memory.py`; P3 can develop against stubbed API responses. Agree on response shapes in the first 10 minutes. |

## 15. First 15 Minutes (parallel kickoff)

1. P1 starts Redis, smoke-tests cognee with `test.py`.
2. P2 writes the SKILL.md and stubs `/query` + `/improve` return shapes.
3. P3 wires the frontend to those stubbed shapes.
4. P4 picks the two syllabi, writes the confusion note, drafts the demo script.

Sync at 15 minutes on response shapes, then go heads-down until the 60-minute mark.
