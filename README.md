# CourseAtlas

A self-improving LLM wiki for university courses. Turns scattered course materials (syllabi, readings, notes) into a persistent, connected knowledge base that compounds with every document and every question.

Built for the **Cognee × Redis AI-Memory Hackathon** (2026-05-16). See [`courseatlas_project_plan.md`](./courseatlas_project_plan.md) for the full design.

The core loop is:

```text
Ingest -> Build Wiki -> Query + Self-Improve -> Lint
```

## Stack

- **Backend:** FastAPI + cognee (memory engine) + markdown/JSON storage
- **Frontend:** React + Vite + Tailwind
- **Session memory:** Redis (fast scratchpad for in-progress conversations)
- **Long-term memory:** Cognee knowledge graph (durable, cross-session)

## Project layout

```text
backend/         FastAPI app: ingest, extract, wiki, query, lint, graph
frontend/        Vite + React UI
raw_materials/   Uploaded files (syllabi, readings, notes)
wiki/            Generated markdown pages (courses, concepts, sources, bridges)
metadata/        JSON sidecars (courses.json, concepts.json, graph.json)
```

## Memory Model

CourseAtlas runs on two tiers of memory — this is the core hackathon pattern.

```text
                    [ student / agent ]
                          |
                          v
          +---------------------------------+
          | Redis  - session memory         |  fast, ephemeral
          |  (current upload, draft answer, |  per-conversation
          |   recent questions)             |
          +----------------+----------------+
                           | distillation
                           v
          +---------------------------------+
          | Cognee - permanent memory       |  structured, durable
          |  (course pages, concepts,       |  cross-session
          |   bridges, skills, summaries)   |
          +---------------------------------+
```

Routing maps directly onto cognee's `session_id`:

```python
import cognee

# Goes to Redis session memory - fast cache, syncs to graph in background
await cognee.remember(
    "Student is asking about hypothesis testing.",
    session_id="study_session_1",
)

# Goes straight to the permanent knowledge graph
await cognee.remember("Hypothesis testing compares a null and alternative claim under data.")

# Recall queries session memory first, falls through to the graph
await cognee.recall("What is the student working on?", session_id="study_session_1")
```

## Requirements

- Python 3.10 - 3.14 (project pinned to 3.12 via `uv`)
- Docker (for Redis)
- An LLM API key — provided at hackathon kickoff, or use any [Cognee-supported provider](https://docs.cognee.ai/setup-configuration/llm-providers)
- PowerShell (Windows) or a Unix-like shell (macOS/Linux)

## Install

The fast path uses [`uv`](https://docs.astral.sh/uv/):

```powershell
# from llm-wiki/
uv venv --python 3.12
.\.venv\Scripts\Activate.ps1
uv pip install -r requirements.txt
```

macOS/Linux:

```bash
uv venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements.txt
```

The important packages are:

- `cognee` — long-term memory and semantic recall
- `redis` — session memory client
- `fastapi` + `uvicorn` — backend API
- `python-multipart` — file upload support
- `pypdf` — PDF text extraction
- `rank-bm25` — local keyword search over markdown
- `networkx` — concept graph and lint support

## Start Redis

Redis is the session-memory layer. Cognee picks it up automatically when `REDIS_URL` is set and a call includes a `session_id`.

```bash
docker run -d --name cognee-redis -p 6379:6379 redis:latest
docker exec cognee-redis redis-cli PING   # -> PONG
```

macOS with Homebrew Redis (alternative):

```bash
brew services start redis    # stop with: brew services stop redis
```

## Configure Environment

Create a local `.env` (already in `.gitignore`):

```env
LLM_API_KEY=your-api-key
REDIS_URL=redis://localhost:6379
```

For a non-default provider, also set:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

Provider reference: <https://docs.cognee.ai/setup-configuration/llm-providers>

## Smoke Test Cognee

```bash
python test.py
```

The script stores a short memory in cognee and recalls it — confirms LLM, Redis, and the graph are wired up.

## Run the Backend

```bash
uvicorn backend.main:app --reload
```

Then open <http://localhost:8000/docs> for the OpenAPI UI.

### Cognee wrapper

The backend talks to cognee through `backend/memory.py`. If cognee is unavailable it falls back to a tiny in-process store so the dev loop still works without an API key.

## Run the Frontend

```powershell
cd frontend
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://localhost:8000`.

## API

| Method | Path                | Purpose                            |
|--------|---------------------|------------------------------------|
| POST   | `/ingest`           | Upload a document                  |
| GET    | `/wiki/pages`       | List wiki pages                    |
| GET    | `/wiki/page/{path}` | Read a wiki page                   |
| POST   | `/query`            | Ask a question                     |
| POST   | `/save-answer`      | Save an answer as a bridge page    |
| GET    | `/lint`             | Run lint checks                    |
| GET    | `/graph`            | Concept graph as JSON              |

## Useful Cognee CLI Commands

```bash
cognee-cli remember "Cognee turns documents into AI memory."
cognee-cli recall "What does Cognee do?"
cognee-cli forget --all
cognee-cli -ui     # local graph viewer at http://localhost:3000
```

## Docker (full app)

```powershell
docker build -t courseatlas .
docker run -p 8000:8000 courseatlas
```

## Status

MVP scaffold. The ingest pipeline is rule-based; the query path combines BM25 over markdown with cognee semantic recall. Next steps: wire `backend/memory.py` to the two-tier `session_id` pattern, add the skill self-improvement loop, polish the graph view, and harden the linter.
