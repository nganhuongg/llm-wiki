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
| 0:20–0:50 | **Ingest.** Drop the EA51 materials (syllabus, Zika case study, research design, hypothesis development reading) + a "what I'm confused about" note. | Wiki pages render. Mastery bars populate on the right for ~6 concepts: `case_study`, `plausibility`, `hypothesis_development`, `evidence_based_argument`, `research_design`, `confounders`. | `ZADD mastery:<session>` per concept; `XADD events:<session>` per upload |
| 0:50–1:30 | **Baseline query.** Ask: *"Help me explain why the Zika microcephaly reading is a case study, and how it connects to hypothesis development and plausibility."* Student rates 0.3. | Generic answer that recites definitions. Mastery bars start ticking downward visibly. | `XADD events:<session>` (query, rating); `ZINCRBY mastery` (touched concept goes up slightly) |
| 1:30–2:00 | **Self-improve.** Click "Improve." | SKILL.md diff renders on screen: explainer learns "this student needs case studies tied back to argument structure and concrete evidence chains." Apply. | `cognee.remember(SkillRunEntry…)`; `improve_skill(apply=True)` |
| **2:00–2:30** | **THE MOMENT.** A bar drops below the red line. | Toast: *"You're losing 'plausibility.' Here's your past self explaining it — added 8 minutes ago."* Card appears with the original concept page + its `known_as_of` timestamp. | `ZRANGEBYSCORE mastery 0 0.4` fires from the decay watcher; `PUBLISH decay:warn` → frontend toast; cognee recall returns the timestamped page |
| 2:30–2:50 | **Improved query + lint.** Same Zika question; new answer threads case_study → hypothesis_development → plausibility cleanly (score 0.8). Run lint — surfaces 2 more fading concepts as review cards. | Side-by-side: baseline answer vs improved answer. Lint panel lists fading concepts in red. | `ZRANGEBYSCORE` for the lint rule |
| 2:50–3:00 | **Close.** "Knowledge has a half-life. We built the first wiki that knows it." | Title card. | — |

## 5.5. Demo Case Study (the actual dataset we run live)

We use real EA51 (Empirical Analyses) course materials from `assets/`. Concrete > generic — judges remember the Zika case, not "course A and course B."

**Materials ingested:**
- `ea51-syllabus.pdf`
- `EA51 - Science of Science Communication (1).pdf`
- `Research Design.pdf`
- `casestudy.pdf`
- `EA51 Session 15 - (8.2) Case study.docx`
- `evidencebased.pdf`
- `hypothesisdevelopment.pdf`
- `plausibility.pdf`

**Student profile (the "what I'm confused about" note):**
> "I understand the readings separately, but I struggle to connect case studies, evidence, hypothesis development, and plausibility. I need help explaining why the Zika and microcephaly reading counts as a case study, and I want to compare its logic with the Japanese vocabulary research design example. I'm stronger on argument structure than on research-methods vocabulary."

**Generated pages (visible in the wiki tree during the demo):**

```text
courses/ea51_empirical_analyses.md
sources/ea51_syllabus.md
sources/science_of_science_communication.md
sources/japanese_vocabulary_research_design.md
sources/zika_microcephaly_case_study.md
concepts/case_study.md
concepts/evidence_based_argument.md
concepts/hypothesis_development.md
concepts/plausibility.md
concepts/research_design.md
student/profile.md
student/confusing_topics.md
study_guides/zika_case_study_for_this_student.md
bridges/case_study_evidence_hypothesis_plausibility.md
```

**The demo question (asked at 0:50 and again at 2:30):**
> "Help me explain why the Zika microcephaly reading is a case study, and connect it to evidence-based argument, hypothesis development, and plausibility."

**The decaying concept (the one that crosses the red line at 2:00):** `plausibility`. Starts at ~0.55 mastery (because the student touches it briefly during the baseline query), then drifts under 0.4 as TTL ticks. The recovered "past self" page is `concepts/plausibility.md` with its `known_as_of` timestamp from minute 0:30 of the same session — close enough to feel real, recent enough to land as "wait, I literally just saw this."

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

Two engineers on the backend / Redis / memory layer (that's where most of the lifting is and where judges score us). One on frontend + design (we need the bars and the toast to look good). One leader who curates content, prepares the demo, writes the pitch, and floats into engineering wherever there's slack.

### P1 — Lead / Curator / Demo / Pitch (floater on engineering)
The hackathon-winning role. Owns the story end-to-end.
1. **Demo content (first 30 min):** verify the EA51 ingest works on the real PDFs in `assets/`. If a PDF parses badly, swap or pre-process. Write the student `confusing_topics.md` note exactly. Pick the concept that will decay (currently `plausibility`).
2. **Mastery tuning (mid-build):** run the full flow end-to-end. Adjust starting mastery scores and `DEMO_TIME_SCALE` so `plausibility` crosses 0.4 between **2:00 and 2:15** of the demo. This requires close coordination with P2/P3.
3. **Pitch:** memorize the §2 hook line, the §5 beats, and the closing line. Time the run twice before 4:30 PM submission.
4. **Submission template:** fill in `templates/SUBMISSION.md` from the hackathon repo. Paste the SKILL.md diff and the before/after answer scores from §12.
5. **Float:** wherever something's slipping — extra lint rule, polish a wiki page, debug the SSE — pitch in.

### P2 — Backend / Memory / Redis #1 (load-bearing primitives)
The hackathon's scored-on piece. Pair with P3 — split the file boundaries early.
1. `backend/memory.py`: wire `session_id` end-to-end. Direct Redis client (don't only go through cognee — we want primitives visible).
2. **Sorted set** `mastery:<session>` with `ZADD`/`ZINCRBY`/`ZRANGEBYSCORE`. API: `set_mastery`, `bump_mastery`, `fading_concepts(threshold)`.
3. **TTL keys** `concept:<session>:<slug>` with `EXPIRE`. Apply `DEMO_TIME_SCALE` (default 100). Coordinate with P1 on tuning.
4. Distillation rule: mastery ≥ 0.7 sustained across ≥ 2 sessions → `cognee.remember(..., metadata={"known_as_of": ts})`. Wire it into `ingest.py` and the rating path.
5. Update `lint.py` with the **fading-concepts** rule (one new clause; the rest of lint stays).

### P3 — Backend / Memory / Redis #2 (events, decay watcher, skill loop)
Pair with P2 — owns the parts that make the wow moment fire on stage.
1. **Streams** `events:<session>` with `XADD` on every ingest/query/rate. API: `log_event`, `recent_events`. Wire into `main.py` endpoints.
2. **Decay watcher**: background task that runs `ZRANGEBYSCORE mastery 0 0.4` every ~2s; `PUBLISH decay:warn:<session>` with concept slug + the cognee page payload + `known_as_of`.
3. **SSE endpoint** `GET /events/decay` that subscribes to the Redis channel and streams events to the frontend.
4. **Skill loop:** author `my_skills/personalized-explainer/SKILL.md`. Build `backend/query.py` to call `cognee.search(skills=[...], session_id=...)` and `backend/improve.py` to run `SkillRunEntry` + `improve_skill(apply=True)`, returning the SKILL.md before/after diff.
5. Pre-rehearse the skill rewrite once so P1 knows the proposal is good before going on stage.

### P4 — Frontend + Design (the three demo-critical panels)
The wow moment is visual — this seat decides whether the room actually feels it.
1. **Mastery timeline / decay bars** — reads `/mastery-state`, animates score changes smoothly (not jumpy). Red threshold line at 0.4. Bars need to be large enough to read from the back of the room.
2. **Decay toast** — subscribes to `/events/decay` (SSE). When `decay:warn` lands, slide in a card with the past-self page + its `known_as_of` date. This is THE money shot — make it land.
3. **Skill diff viewer** — renders `/improve` SKILL.md before/after as a side-by-side diff with diff highlighting.
4. **Design pass:** existing UI is functional but plain. Tighten typography, give the bars proper color (mastery green → fading amber → forgotten red), add a single accent color. No new dependencies — use Tailwind only.
5. Graph view stays as stretch — only touch if all of the above is solid.

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

1. **P1 (Lead):** runs `python test.py` to smoke-test cognee, then runs `POST /ingest` on each EA51 PDF in `assets/`. Confirms which PDFs parse cleanly; flags any that need pre-processing. Drafts the confusing-topics note in plain text.
2. **P2 (Backend #1):** starts Redis with `--notify-keyspace-events KEA`, writes the sorted-set + TTL functions in `backend/memory.py`. Stubs return shapes so P3 and P4 can develop in parallel.
3. **P3 (Backend #2):** writes the SKILL.md scaffold and stubs `/query`, `/improve`, `/events/decay` return shapes. Agrees with P4 on the SSE event payload format.
4. **P4 (Frontend):** wires the existing UI to call the stubbed shapes from P2/P3. Sketches the mastery bars layout.

**15-minute sync:** P2 + P3 + P4 agree on payload shapes, P1 confirms which PDFs are in the demo set. Then heads-down until the 60-minute mark for an integration test.

**60-minute integration check:** run the full demo flow end-to-end with placeholder data. If the decay toast doesn't fire, that's the urgent fix. Everything else is polish.

**90-minute freeze:** stop adding features. P1 tunes `DEMO_TIME_SCALE` so `plausibility` decays at 2:00–2:15. P4 polishes the visual. P2/P3 fix bugs only.

**4:30 PM:** submit per `templates/SUBMISSION.md` — P1 owns this.
