# StudyAtlas

StudyAtlas is a personalized LLM wiki for students. It uses Cognee as long-term memory, Redis as session memory, and markdown files as the visible wiki artifact for the hackathon demo.

The core loop is:

```text
Ingest -> Build Wiki -> Query + Self-Improve -> Lint
```

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

Create a local `.env` file. This file is ignored by git.

```env
LLM_API_KEY=your-api-key
REDIS_URL=redis://localhost:6379
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

Redis is the fast session-memory layer. Cognee uses it when `REDIS_URL` is set and calls include a `session_id`.

Docker, all platforms:

```bash
docker run -p 6379:6379 redis:latest
```

macOS with Homebrew Redis:

```bash
brew services start redis
```

To stop the Homebrew Redis service:

```bash
brew services stop redis
```

Keep this container running while using the app.

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

## Planned Backend Run Command

Once the FastAPI backend is added, run it with:

```bash
uvicorn backend.main:app --reload
```

The planned API surface is:

```text
POST /ingest
POST /student-context
GET  /wiki/pages
GET  /wiki/page/{path}
POST /query
POST /save-answer
GET  /lint
GET  /graph
```

## Project Files

```text
courseatlas_project_plan.md   Project plan and hackathon scope
docs/setup_guideline.md       Hackathon setup and Cognee/Redis reference
requirements.txt              Python dependencies
test.py                       Minimal Cognee smoke test
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
