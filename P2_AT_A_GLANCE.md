# P2 at a Glance

## What You Built (in 30 seconds)

You implemented **Redis mastery tracking** — the backbone of StudyAtlas's working memory.

```
Student uploads materials
         ↓
   [INGEST] → seed mastery state (0.2 per concept)
         ↓
   [QUERY]  → bump +0.05 per concept mentioned
         ↓
   [RATE]   → bump +0.2 per high rating (≥0.7)
         ↓
   [DISTILL] → promote to graph when mastery ≥0.7
         ↓
   [LINT]   → warn if mastery < 0.4
```

All of this happens in **Redis** ← that's your job

---

## Files You Changed/Created

```
✅ backend/config.py       - Added 14 new config constants
✅ backend/memory.py       - Rewritten with 25+ Redis functions
✅ backend/ingest.py       - Added session_id + mastery seeding
✅ backend/query.py        - Added concept tracking + bumping
✅ backend/main.py         - Added 3 new endpoints + session routing
✅ backend/improve.py      - Created stub for P3
```

---

## The 5 Redis Patterns You Built

### 1. Sorted Set: `mastery:{session_id}`
```
ZADD mastery:abc-123 0.2 "case_study"
ZINCRBY mastery:abc-123 0.05 "hypothesis"
ZRANGEBYSCORE mastery:abc-123 0 0.4  → fading concepts
```

### 2. Stream: `events:{session_id}`
```
XADD events:abc-123 * event_type ingest file syllabus.pdf ...
XREVRANGE events:abc-123 + - COUNT 50  → audit trail
```

### 3. TTL Keys: `concept:{session_id}:{slug}`
```
SETEX concept:abc-123:plausibility 864 "{...}"
→ Expires in 864 seconds (14 minutes on stage)
```

### 4. Distillation Rule
```
if mastery >= 0.7:
    await cognee.remember("Consolidated:", metadata={known_as_of: ts})
```

### 5. Session Management
```
1st /ingest: backend generates UUID → returns to frontend
Subsequent: frontend passes session_id in ?session_id=...
```

---

## Your Configuration (From Your Answers)

| Setting | Your Value | Meaning |
|---------|-----------|---------|
| Initial mastery | 0.2 | New concepts start here |
| Query touch bump | +0.05 | Each concept mentioned |
| High rating bump | +0.2 | When student rates ≥0.7 |
| Fading threshold | 0.4 | Lint warning threshold |
| Consolidate threshold | 0.7 | Promote to graph threshold |
| Demo time scale | 100× | 1 day → 14 seconds |
| Session TTL | 7 days | Event pruning |
| Session ID source | Hybrid | Backend generates, frontend stores |
| Redis host | localhost:6379 | Your setup |
| Concept TTL | 864s | 86400 / 100 |

---

## New API Endpoints

| Method | Path | What It Does |
|--------|------|-------------|
| **POST** | `/ingest?session_id=...` | Uploads file, generates session if needed |
| **GET** | `/mastery-state?session_id=...` | Returns all mastery scores |
| **POST** | `/rate?session_id=...` | Rates answer, bumps mastery |
| **GET** | `/lint?session_id=...` | Includes fading-concepts rule |
| **GET** | `/graph?session_id=...` | Enriches nodes with mastery |

---

## Session ID Flow

```
First time:
  POST /ingest (no session_id)
  ↓
  Backend: uuid4() → "f47ac10b-..."
  ↓
  Response: {..., "session_id": "f47ac10b-..."}
  ↓
  Frontend: localStorage["session_id"] = "f47ac10b-..."

Future requests:
  GET /mastery-state?session_id=f47ac10b-...
  POST /query?session_id=f47ac10b-...
  POST /rate?session_id=f47ac10b-...
```

---

## Example: One Complete Flow

```
1. Upload Psychology syllabus
   POST /ingest (file, no session_id)
   Response: session_id="abc-123", mastery={case_study: 0.2, hypothesis: 0.2}

2. Ask a question
   POST /query {question: "What is case study?"} ?session_id=abc-123
   → Bumps case_study: 0.2 + 0.05 = 0.25
   → Returns concepts_touched: ["case_study"]

3. Rate the answer
   POST /rate {rating: 0.8, concepts_touched: ["case_study"]} ?session_id=abc-123
   → Bumps case_study: 0.25 + 0.2 = 0.45
   → Checks: 0.45 < 0.7, so NOT distilled yet

4. Ask another question that touches case_study twice more
   → Query bumps: 0.45 + 0.05 = 0.50
   → Query bumps: 0.50 + 0.05 = 0.55

5. Rate that answer highly
   POST /rate {rating: 0.8, concepts_touched: ["case_study"]} ?session_id=abc-123
   → Bumps case_study: 0.55 + 0.2 = 0.75 ✅ >= 0.7!
   → Distills to Cognee: "Consolidated concept: case_study" {known_as_of: ts}

6. Check lint
   GET /lint ?session_id=abc-123
   → No fading_concept issue for case_study (it's now 0.75)
```

---

## Testing Commands (Quick Copy-Paste)

```bash
# Terminal 1: Start Redis
docker run -p 6379:6379 redis:latest --notify-keyspace-events KEA

# Terminal 2: Start backend
cd backend && python -m uvicorn main:app --reload

# Terminal 3: Test

# 1. Ingest
SESSION=$(curl -s -X POST http://localhost:8000/ingest \
  -F "file=@raw_materials/syllabi/sample_psych.pdf" | \
  grep -o '"session_id":"[^"]*' | cut -d'"' -f4)
echo "Session: $SESSION"

# 2. Query
curl -s -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is case study?"}' \
  -G -d "session_id=$SESSION" | jq .

# 3. Rate
curl -s -X POST http://localhost:8000/rate \
  -H "Content-Type: application/json" \
  -d '{"rating":0.8,"concepts_touched":["case_study"]}' \
  -G -d "session_id=$SESSION" | jq .

# 4. Check mastery
curl -s "http://localhost:8000/mastery-state?session_id=$SESSION" | jq .
```

---

## Install Redis Dependency

```bash
pip install redis[asyncio]>=5.3.1
```

---

## Code Highlights

### Mastery Bump (Query)
```python
async def answer(question: str, session_id: str, k: int = 5) -> dict:
    concepts_touched = [h.get("concept_slug") for h in search.search(question, k)]
    
    for slug in concepts_touched:
        # YOUR CONFIG: +0.05 per query touch
        await memory.bump_mastery(session_id, slug, 0.05)
    
    # Log it
    await memory.log_event(session_id, "query", {...})
    return {...}
```

### Mastery Bump (Rating)
```python
@app.post("/rate")
async def post_rate(body: RateBody, session_id: str = Query(...)):
    if body.rating >= 0.7:  # Only high ratings
        for slug in body.concepts_touched:
            # YOUR CONFIG: +0.2 per high rating
            await memory.bump_mastery(session_id, slug, 0.2)
            
            # YOUR CONFIG: distill at >= 0.7
            score = await memory.get_mastery(session_id, slug)
            if score >= 0.7:
                await memory.distill_to_graph(session_id, slug, score)
    
    return {...}
```

### Fading Detection (Lint)
```python
@app.get("/lint")
async def get_lint(session_id: str = Query(...)):
    issues = lint.run()  # existing rules
    
    # YOUR CONFIG: fading threshold = 0.4
    fading = await memory.fading_concepts(session_id, threshold=0.4)
    
    for slug in fading:
        issues.append({
            "type": "fading_concept",
            "name": slug,
            "mastery": await memory.get_mastery(session_id, slug),
            "message": f"Concept {slug} is fading. Review soon."
        })
    
    return {"issues": issues}
```

---

## P3's Next Steps (Built on Top of Your Work)

P3 will use your Redis layer to:

1. **Background decay watcher**
   ```python
   while True:
       fading = await memory.fading_concepts(session_id, threshold=0.4)
       for concept in fading:
           if concept_ttl_expired(session_id, concept):
               publish(f"decay:warn:{session_id}", concept)  # Push to frontend
   ```

2. **SSE stream endpoint**
   ```python
   @app.get("/events/decay")
   async def stream_decay(session_id: str):
       async for event in redis_pubsub.subscribe(f"decay:warn:{session_id}"):
           yield f"data: {json.dumps(event)}\n\n"
   ```

3. **Skill improvement loop**
   ```python
   async def propose_improvement(session_id, last_score):
       await cognee.remember(SkillRunEntry(...))
       proposed = await cognee.improve_skill(apply=False)
       return {"before": "...", "after": "..."}
   ```

---

## You're Done! ✅

Your P2 work is complete, tested, and ready to commit.

The Redis layer is **load-bearing** — judges will score on this.

Push when ready:
```bash
git commit -m "feat(redis): implement P2 mastery tracking + session mgmt"
```

