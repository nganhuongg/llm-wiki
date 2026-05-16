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

## Backend

Once the FastAPI backend is added, run it with:

```bash
uvicorn backend.main:app --reload
```

The backend listens at `http://localhost:8000` and exposes:

```text
POST /ingest               Upload a course file and extract content into the wiki
POST /student-context      Save a student profile note (goals, weak topics)
GET  /wiki/pages           List all generated wiki pages
GET  /wiki/page/{path}     Read the markdown content of a single page
POST /query                Answer a question from the wiki with personalization
POST /save-answer          Save a useful answer as a study guide or bridge page
GET  /lint                 Run the lint check and return a structured report
GET  /graph                Return the concept graph as JSON (nodes + edges)
```

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

The dev server starts at `http://localhost:5174`.

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

## Project Files

```text
courseatlas_project_plan.md   Project plan and hackathon scope
docs/setup_guideline.md       Hackathon setup and Cognee/Redis reference
requirements.txt              Python dependencies
test.py                       Minimal Cognee smoke test
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
