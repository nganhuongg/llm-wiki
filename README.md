# StudyAtlas

StudyAtlas is a personalized LLM wiki for students. It uses **Cognee** as long-term memory, **Redis** as the student's working memory (with TTLs that mirror the forgetting curve), and markdown files as the visible wiki artifact.

The core loop:

```text
Ingest -> Build Wiki -> Query + Self-Improve -> Lint
```

The demo's wow moment is a mastery bar visibly decaying past threshold mid-pitch, triggering a "you're losing this — here's your past self explaining it" toast.

> **The source of truth is [`courseatlas_project_plan.md`](./courseatlas_project_plan.md).** Read §2 (the hook), §5 (demo script), §6 (Redis primitives table), and your role in §10 before writing code.

## Where to Start (by role)

Four-person split per plan §10. Sync at 15min on payload shapes, integration test at 60min, feature freeze at 90min, submit at 4:30 PM.

| Role | What you own | Files | Plan ref |
|---|---|---|---|
| **P1 — Lead / Curator / Demo / Pitch** | EA51 ingest sanity check, decay tuning, demo timing, submission writeup, floater | `assets/`, `templates/SUBMISSION.md`, tuning `DEMO_TIME_SCALE` | §10 P1, §15 |
| **P2 — Backend / Redis #1** | Sorted-set mastery state, TTL keys, distillation rule, fading-concepts lint clause | `backend/memory.py`, `backend/lint.py`, `backend/ingest.py` | §10 P2 |
| **P3 — Backend / Redis #2** | Event streams, decay watcher, SSE, skill loop (propose+apply) | `backend/main.py`, `backend/query.py`, `backend/improve.py` (new), `my_skills/personalized-explainer/SKILL.md` (new) | §10 P3 |
| **P4 — Frontend + Design** | Mastery decay bars, decay toast (SSE), SKILL.md diff viewer, visual polish | `frontend/src/components/*` (add `MasteryTimeline.jsx`, `DecayToast.jsx`, `SkillDiff.jsx`) | §10 P4 |

**Branch strategy for the timebox:** everyone commits to `main` in small, fast pieces. Pull before you push. If you break something, revert — don't try to fix on a side branch.

## Requirements

- Python 3.10 through 3.14
- Docker, for local Redis
- An LLM API key, provided at the hackathon kickoff or from any Cognee-supported provider
- PowerShell on Windows, or a Unix-like shell on macOS/Linux

## macOS Prerequisites

If you are on macOS, install the basics with Homebrew:

```bash
brew install python
brew install redis
```

Use either Docker Desktop or the local Redis service. Docker matches the hackathon setup most closely, while Homebrew Redis is convenient for local development.

## Install

Create and activate a virtual environment.

PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

Install dependencies.

```bash
pip install -r requirements.txt
```

The important packages are:

- `cognee`: long-term memory and semantic recall
- `redis`: session memory client
- `fastapi` and `uvicorn`: backend API
- `python-multipart`: file upload support
- `pypdf`: PDF text extraction
- `rank-bm25`: simple local keyword search
- `networkx`: concept graph and lint support

## Configure Environment

Copy `.env.example` to `.env` and fill in. `.env` is gitignored.

```env
LLM_API_KEY=your-api-key
REDIS_URL=redis://localhost:6379

# Demo: divides real TTLs by this factor so mastery visibly decays during a 3-minute demo.
# 100 means "1 day of forgetting curve = ~14 seconds on stage." Set to 1 for production.
DEMO_TIME_SCALE=100
```

For macOS/Linux shell sessions, you can also export the values directly:

```bash
export LLM_API_KEY="your-api-key"
export REDIS_URL="redis://localhost:6379"
```

If you use a non-default LLM provider, also set the Cognee provider variables supported by your provider, for example:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

Cognee provider configuration is documented here:

```text
https://docs.cognee.ai/setup-configuration/llm-providers
```

## Start Redis

Redis is the student's working memory. We use it four ways: sorted sets for mastery state, TTL keys for the forgetting curve, streams for event logs, pub/sub for the live decay toast (see plan §6).

**The `--notify-keyspace-events KEA` flag is required** — without it, the decay watcher won't see TTL expirations.

Docker, all platforms:

```bash
docker run -p 6379:6379 redis:latest --notify-keyspace-events KEA
```

macOS with Homebrew Redis (apply the same setting):

```bash
brew services start redis
redis-cli config set notify-keyspace-events KEA
```

To stop the Homebrew Redis service:

```bash
brew services stop redis
```

Verify the flag is on:

```bash
redis-cli config get notify-keyspace-events
# expected: notify-keyspace-events  AKE  (or any string containing K and E)
```

Keep Redis running while using the app.

## Smoke Test Cognee

Run the existing test script:

```bash
python test.py
```

The script stores a short memory with Cognee and recalls it:

```python
await cognee.remember("MC50 focuses on communication and evidence.")
await cognee.recall("What does MC50 focus on?")
```

## Memory Model

StudyAtlas uses two tiers of memory:

```text
User/session
    |
    v
Redis session memory
Fast scratchpad for recent uploads, current questions, draft answers, and session state.
    |
    v
Cognee long-term memory
Durable knowledge graph for course materials, student profile, concepts, bridges, and saved study guides.
```

Example Cognee usage:

```python
import cognee

# Session memory through Redis.
await cognee.remember(
    "Student struggles with claims versus evidence.",
    session_id="student_session_1",
)

# Long-term memory through Cognee.
await cognee.remember(
    "Evidence in statistics usually means data patterns, uncertainty, and inference."
)

# Recall checks the current session and long-term memory.
results = await cognee.recall(
    "What does this student struggle with?",
    session_id="student_session_1",
)
```

## Backend

Once the FastAPI backend is added, run it with:

```bash
uvicorn backend.main:app --reload
```

The backend listens at `http://localhost:8000` and exposes:

```text
POST /ingest               Upload a course file. Seeds mastery sorted set, logs XADD event
POST /query                Answer a question via cognee.search(skills=[...], session_id=...)
POST /rate                 Rate an answer 0..1. ZINCRBY mastery, write SkillRunEntry
POST /improve              Apply a proposed skill rewrite, return the SKILL.md diff
GET  /mastery-state        Current Redis mastery sorted set for the active session
GET  /events/decay         SSE stream of decay:warn pub/sub events (powers the toast)
GET  /lint                 Lint report including the fading-concepts rule
GET  /graph                Concept graph JSON (nodes carry mastery + known_as_of)
GET  /wiki/pages           List all generated wiki pages
GET  /wiki/page/{path}     Read the markdown content of a single page
POST /save-answer          Save a useful answer as a study guide or bridge page
```

Open `http://localhost:8000/docs` for the live OpenAPI UI.

## Frontend

The frontend is a React + Tailwind CSS app in `frontend/`.

### Requirements

- Node.js 18 or later
- npm 9 or later

### Install and run

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/api/*` to the FastAPI backend at `http://localhost:8000`. Start the backend in another terminal first.

### Build for production

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`.

### Tabs

| Tab | What it does |
|-----|-------------|
| Ingest | Drag-and-drop course files (PDF, TXT, MD, DOCX) and add a student context note, then click Build Wiki |
| Wiki | Browse generated wiki pages by folder (courses, concepts, bridges, student, study\_guides) and read them rendered as markdown |
| Query | Ask personalized cross-course questions, see which pages were used as sources, and save useful answers as study guides |
| Graph | Interactive force-directed visualization of the concept graph, color-coded by node type |
| Lint | Filterable lint report showing missing pages, orphan pages, weak bridges, and personalization gaps |

### Component structure

```text
frontend/src/
  App.jsx                       Tab shell and navigation header
  components/
    UploadPanel.jsx             File upload and student context input
    WikiViewer.jsx              Sidebar page list and markdown viewer
    QueryBox.jsx                Query input, example questions, save-as-study-guide
    GraphView.jsx               Force-directed concept graph
    LintReport.jsx              Filterable lint issues with severity badges
```

## Demo Materials

The EA51 (Empirical Analyses) course materials in `assets/` are the demo dataset:

```text
assets/
  ea51-syllabus.pdf
  EA51 - Science of Science Communication (1).pdf
  Research Design.pdf
  casestudy.pdf
  EA51 Session 15 - (8.2) Case study.docx
  evidencebased.pdf
  hypothesisdevelopment.pdf
  plausibility.pdf
```

The demo question we run live: *"Help me explain why the Zika microcephaly reading is a case study, and connect it to evidence-based argument, hypothesis development, and plausibility."* See plan §5.5 for the full case study.

## Skills

`my_skills/` holds the skill packs cognee uses for the propose-then-apply self-improvement loop. The hackathon-critical one is `personalized-explainer` — P3 authors and tunes it.

```text
my_skills/
  personalized-explainer/
    SKILL.md
```

## Project Files

```text
courseatlas_project_plan.md   Project plan and hackathon scope (source of truth)
docs/setup_guideline.md       Hackathon setup and Cognee/Redis reference
requirements.txt              Python dependencies
test.py                       Minimal Cognee smoke test
test_two_tier.py              Smoke test for the Redis/Cognee session pattern
assets/                       EA51 demo materials
my_skills/                    Skill packs for the self-improvement loop
backend/                      FastAPI app
frontend/                     React + Tailwind CSS frontend
```

## Useful Cognee CLI Commands

```bash
cognee-cli remember "Cognee turns documents into AI memory."
cognee-cli recall "What does Cognee do?"
cognee-cli forget --all
```

Launch the local Cognee UI:

```bash
cognee-cli -ui
```

The UI runs at:

```text
http://localhost:3000
```
