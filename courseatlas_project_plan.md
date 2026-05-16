# StudyAtlas: A Personalized LLM Wiki for Students

> Hackathon plan — Cognee × Redis AI-Memory Hackathon, 2026-05-16.
> Team of 4, ~2 hours of build time, 3-minute demo.

## 1. One-Sentence Pitch

> StudyAtlas turns scattered course materials into a personalized wiki — and uses Redis as the *student's* working memory (what they saw recently, what's decaying, what's confusing them right now) to make every answer anchor on what that specific student already understands.

## 2. The Hook (read first)

> *"How many times have you understood something perfectly, then forgotten it three weeks later? Your notes don't know. Your textbooks don't know. We built a wiki that does — and reminds you, in your own past words."*

Two memory tiers, deliberately mapped:

- **Redis = the student's working memory.** Every study event — page viewed, question asked, "I get it" / "I don't get it" rating, concept brushed against in a query — is written to Redis under a `session_id`, with a TTL that mirrors the forgetting curve. Mastery state per concept lives here and *decays in real time*.
- **Cognee = the student's consolidated knowledge.** When a concept is reinforced across enough sessions, it's promoted into the permanent graph with a `known_as_of` timestamp. The graph holds course pages, concept pages, bridges, and the *history of what the student has actually internalized*.

**The wow moment:** During the demo, a mastery bar visibly decays past threshold (TTLs are sped up 100× for stage time). A toast fires — *"You're losing 'hypothesis testing.' Here's your past self explaining it."* Cognee returns the page with its original `known_as_of` date. The room feels it because everyone has lived it.

This is the load-bearing pattern the hackathon brief flags twice. Most teams will use Redis as a generic cache; we use it the way Redis wants to be shown off (see §6).

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

## 5. Demo Script (3 minutes, built around the live-decay moment)

The 2:00 mark is the wow. Everything before it sets the bars on screen so they can decay; everything after it pays off the moment.

**TTL acceleration:** mastery-state TTLs are scaled by an env var `DEMO_TIME_SCALE=100`. Ebbinghaus says ~1 day to first forget; we make that ~14 seconds on stage. Without this, nothing visibly decays inside 3 minutes — make sure it's set.

| Time | Beat | What the audience sees | What Redis is doing |
|---|---|---|---|
| 0:00–0:20 | **Hook.** Read the line from §2 verbatim. | Title card. | — |
| 0:20–0:50 | **Ingest.** Drop 2 syllabi + a "what I'm confused about" note. | Wiki pages render. Mastery bars populate on the right (~6 concepts at varying starting scores). | `ZADD mastery:<session>` per concept; `XADD events:<session>` per upload |
| 0:50–1:30 | **Baseline query.** Ask: *"Explain hypothesis testing using something I already understand."* Student rates 0.3. | Generic textbook answer. Bars start ticking downward visibly. | `XADD events:<session>` (query, rating); `ZINCRBY mastery` (touched concept goes up slightly) |
| 1:30–2:00 | **Self-improve.** Click "Improve." | SKILL.md diff renders on screen: explainer learns "anchor stats on argument structure for this student." Apply. | `cognee.remember(SkillRunEntry…)`; `improve_skill(apply=True)` |
| **2:00–2:30** | **THE MOMENT.** A bar drops below the red line. | Toast: *"You're losing 'correlation.' Here's your past self explaining it — added Tuesday."* Card appears with the original page + its `known_as_of` date. | `ZRANGEBYSCORE mastery 0 0.4` fires from the decay watcher; `PUBLISH decay:warn` → frontend toast; cognee recall returns the timestamped page |
| 2:30–2:50 | **Improved query + lint.** Same question, anchored on argument structure (score 0.8). Run lint — surfaces 2 more fading concepts as review cards. | Side-by-side: baseline answer vs improved answer. Lint panel lists fading concepts in red. | `ZRANGEBYSCORE` for the lint rule |
| 2:50–3:00 | **Close.** "Knowledge has a half-life. We built the first wiki that knows it." | Title card. | — |

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

### Redis primitives — what does what

This is the table judges will look for. We use Redis four ways, each for a reason:

| Primitive | Key shape | Purpose |
|---|---|---|
| **Sorted set** (`ZADD`, `ZINCRBY`, `ZRANGEBYSCORE`) | `mastery:<session_id>` → `{concept: score 0..1}` | Per-session mastery state. `ZRANGEBYSCORE mastery 0 0.4` instantly returns "what's fading" — sub-ms. Powers the lint rule and the live-decay watcher. |
| **TTL on hash keys** | `concept:<session>:<slug>` with `EXPIRE` | Ebbinghaus forgetting curve. Sped up 100× for the demo via `DEMO_TIME_SCALE`. When the key expires, a keyspace notification triggers the decay event. |
| **Streams** (`XADD`, `XRANGE`) | `events:<session_id>` | Per-session event log: every page view, query, rating. This is the concrete artifact `session_id` actually points to. Doubles as the audit trail in the submission. |
| **Pub/sub** (`PUBLISH`, `SUBSCRIBE`) | channel `decay:warn:<session_id>` | The "you're losing this" toast. Frontend subscribes; no polling. The decay watcher publishes when a `ZRANGEBYSCORE` reveals a fade. |

**Distillation rule (Redis → Cognee):**
A concept gets `cognee.remember(...)`'d with a `known_as_of` timestamp when:
- mastery score (from the sorted set) crosses 0.7 sustained across ≥ 2 sessions, OR
- the student explicitly rates a related answer ≥ 0.7, OR
- a `bridge` page touching it is saved.

**Read path:** `ZRANGEBYSCORE` first (Redis, sub-ms) → `cognee.recall(...)` second (graph). The brief's exact pattern, made concrete.

**Cognee stores:**
- course pages, concept pages, source pages, bridge pages
- the `personalized-explainer` skill (rewritten via the propose/apply loop)
- consolidated concept history with `known_as_of` timestamps (this is what the toast pulls up)

## 7. The Self-Improvement Loop (the mechanism behind the wow)

> The decay moment is the *story*. The skill rewrite is the *mechanism* that earns the score. Judges score the loop; the room remembers the decay.



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

### P1 — Redis + memory layer (the hackathon's load-bearing piece, *and* the demo's wow engine)
1. `backend/memory.py`: wire `session_id` end-to-end. Direct Redis client (don't only go through cognee — we want the primitives visible).
2. **Sorted set** `mastery:<session>` with `ZADD`/`ZINCRBY`/`ZRANGEBYSCORE`. API: `set_mastery`, `bump_mastery`, `fading_concepts(threshold)`.
3. **Streams** `events:<session>` with `XADD` on every ingest/query/rate. API: `log_event`, `recent_events`.
4. **TTL keys** `concept:<session>:<slug>` with `EXPIRE`. Apply `DEMO_TIME_SCALE` (default 100) — divides real TTLs by that factor.
5. **Decay watcher**: a background task that runs `ZRANGEBYSCORE mastery 0 0.4` every ~2s; `PUBLISH decay:warn:<session>` with the concept payload. Frontend SSE/WebSocket subscribes.
6. Distillation rule: mastery ≥ 0.7 sustained across ≥ 2 sessions → `cognee.remember(..., metadata={"known_as_of": ts})`.

### P2 — Skill loop (the demo money shot)
1. Author `my_skills/personalized-explainer/SKILL.md`.
2. `backend/query.py`: wire `cognee.search(skills=[...], session_id=...)`.
3. `backend/improve.py`: `SkillRunEntry` + `improve_skill(apply=True)`. Return the SKILL.md diff as part of the response.
4. Seed one canned scenario where baseline answer fails and the rewrite obviously wins.

### P3 — Frontend (focus on the three demo-critical panels)
1. **Mastery timeline / decay bars** — reads `/mastery-state`, animates score changes. Red line at 0.4 threshold.
2. **Decay toast** — subscribes to `/events/decay` (SSE backed by Redis pub/sub). When a `decay:warn` fires, slide in a card with the past-self page (returned in the event payload).
3. **Skill diff viewer** — renders `/improve` SKILL.md before/after as a side-by-side diff.
4. Graph view if time. Color nodes by mastery score.

### P4 — Lint + demo data + pitch
1. `backend/lint.py`: three rules including the forgotten-concepts rule.
2. Prep the demo dataset: 2 syllabi (psychology + statistics works well — they share concepts), 1 student confusion note ("I'm strong on writing arguments, weak on stats notation").
3. Write and time the 3-minute script. Run it twice before submission.

## 11. API (minimal surface)

| Method | Path | Purpose |
|---|---|---|
| POST | `/ingest` | Upload a document or note (seeds mastery sorted set) |
| POST | `/query` | Ask a question, returns answer + concepts touched (logs to stream) |
| POST | `/rate` | Rate an answer 0..1 → `ZINCRBY` + `SkillRunEntry` |
| POST | `/improve` | Apply a proposed skill rewrite, returns the diff |
| GET | `/mastery-state` | Current Redis mastery state (sorted set dump) for the active session |
| GET | `/events/decay` | **SSE stream** — subscribes to Redis pub/sub `decay:warn:<session>`. Powers the toast. |
| GET | `/lint` | Lint report (includes fading-concepts rule) |
| GET | `/graph` | Concept graph JSON (nodes carry mastery + `known_as_of`) |
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
| Redis distillation rule is invisible to judges | Mastery timeline panel + a small "promoted to graph" toast when distillation fires. Dev panel exposes the actual Redis commands firing. |
| **The decay moment doesn't fire on time** | This is the single biggest demo risk. Tune `DEMO_TIME_SCALE` and starting mastery scores so a specific concept *will* cross 0.4 between 2:00 and 2:15. Practice the run twice. Have a manual `POST /debug/force-decay` endpoint as the safety net. |
| 3 minutes is tight | Don't introduce, don't read slides — start typing into the upload box at 0:20. |
| One person blocks another | P2 can develop against a stubbed `memory.py`; P3 can develop against stubbed API responses. Agree on response shapes in the first 10 minutes. |
| Redis keyspace notifications aren't enabled by default | `docker run ... redis:latest --notify-keyspace-events KEA` — bake this into the README setup step. |

## 15. First 15 Minutes (parallel kickoff)

1. P1 starts Redis, smoke-tests cognee with `test.py`.
2. P2 writes the SKILL.md and stubs `/query` + `/improve` return shapes.
3. P3 wires the frontend to those stubbed shapes.
4. P4 picks the two syllabi, writes the confusion note, drafts the demo script.

Sync at 15 minutes on response shapes, then go heads-down until the 60-minute mark.
