# P2 Quick Reference: Redis Integration Checklist

## What's Already Built (You Have This)
```
✅ backend/memory.py           - Cognee wrapper (needs Redis layer)
✅ backend/ingest.py           - Concept extraction (needs mastery seeding)
✅ backend/config.py           - Paths (needs Redis config)
✅ backend/main.py             - FastAPI basics (needs mastery endpoints)
✅ backend/query.py            - Search + recall (needs session tracking)
✅ backend/lint.py             - Health checks (needs fading-concepts rule)
✅ backend/parser.py           - PDF parsing
✅ backend/search.py           - BM25 keyword search
✅ backend/wiki_writer.py      - Wiki page generation
✅ backend/extractor.py        - Metadata extraction
```

## What You (P2) Must Build

### Priority 1: Core Redis Layer
```
backend/memory.py — Add Redis client + 6 functions:
  • set_mastery(session_id, concept, score)
  • bump_mastery(session_id, concept, delta)
  • get_mastery(session_id, concept)
  • fading_concepts(session_id, threshold=0.4) → list of slugs
  • seed_concept_mastery(session_id, concepts)
  • log_event(session_id, event_type, metadata)
  
Redis structures:
  • Sorted set: mastery:{session_id}  → {concept: score 0..1}
  • Stream: events:{session_id}       → time-indexed event log
  • TTL keys: concept:{session}:{slug} → expires per DEMO_TIME_SCALE
```

### Priority 2: Wire Session_ID Through API
```
backend/main.py — Add 3 endpoints + update 1:
  • POST /ingest?session_id=... (update existing)
  • GET /mastery-state?session_id=...  (NEW)
  • POST /rate (NEW)  
  • GET /lint?session_id=... (update existing)

backend/ingest.py — Update:
  • Accept session_id parameter
  • Call memory.seed_concept_mastery() on upload
  • Call memory.log_event() for audit trail

backend/query.py — Update:
  • Accept session_id parameter
  • Call memory.bump_mastery() for concepts mentioned
  • Call memory.log_event() for audit trail
  • Return concepts_touched in response
```

### Priority 3: Add Fading-Concepts Lint Rule
```
backend/lint.py — Add rule:
  • Query memory.fading_concepts(session_id, threshold=0.4)
  • Flag any concept below threshold that isn't consolidated to graph
  • Issue type: "fading_concept"
```

### Priority 4: Create Stub for P3
```
backend/improve.py — Skeleton:
  • async propose_improvement(session_id, last_answer_score)
  • async apply_improvement()
  
(P3 will fill in the Cognee skill-rewrite logic)
```

### Priority 5: Update Config
```
backend/config.py — Add:
  • REDIS_URL
  • DEMO_TIME_SCALE (default 100)
  • MASTERY_THRESHOLDS
  • MASTERY_DELTAS (per interaction type)
```

---

## 🚨 Critical Questions (Must Answer Before Coding)

1. **Initial mastery**: What score do new concepts start at? (0.2? 0.3?)
2. **Mastery bumps**: How much per query hit? Per rating ≥0.7?
3. **Distillation**: What triggers promotion to permanent graph (cognee)?
4. **Session TTL**: How long until a session expires?
5. **Session ID**: Auto-generate (UUID) or provided by frontend?
6. **Redis host:port**: What's your setup?
7. **DEMO_TIME_SCALE**: Confirm 100× is right?
8. **Fading threshold**: Confirm 0.4 is the cutoff?
9. **Event retention**: Keep forever or prune?
10. **Graph TTL**: Once in graph, does it expire or stay forever?

---

## Architecture You're Building

```
┌─────────────────────────────────┐
│     Frontend (P4)               │
│  (mastery bars, decay toast)    │
└─────────────┬───────────────────┘
              │ session_id
              ↓
┌─────────────────────────────────────────┐
│   FastAPI (main.py)                     │
│  /ingest  /query  /rate  /mastery-state │
└────────────┬─────────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌─────────────┐   ┌──────────────────┐
│ Redis       │   │ Cognee           │
│ (working    │   │ (permanent       │
│  memory)    │   │  knowledge)      │
│             │   │                  │
│ mastery:{s} │   │ graph +          │
│ events:{s}  │   │ skills           │
└─────────────┘   └──────────────────┘

Your job (P2): Build the Redis layer + wire session_id
```

---

## File-by-File TODO

- [ ] Answer all 10 questions
- [ ] Create detailed `backend/memory.py` with Redis client + sorted sets
- [ ] Update `backend/ingest.py` to seed mastery
- [ ] Update `backend/main.py` with new endpoints
- [ ] Update `backend/query.py` to track concepts
- [ ] Update `backend/lint.py` fading rule
- [ ] Create `backend/improve.py` stub
- [ ] Update `backend/config.py` with Redis settings
- [ ] Sync with P3 on `/rate` payload format
- [ ] Sync with P4 on UI expectations for `/mastery-state`

---

## Key Insight

**You're not just caching data — you're implementing the forgetting curve.**

Redis isn't decorative here. It's the *behavioral model* of the student's working memory. The TTL decay, the mastery sorted set, the event stream — all of it together creates a live representation of "what this student understands right now and what they're about to forget."

That's what makes the demo's 2:00 decay moment land. Judges feel it because it's real.

