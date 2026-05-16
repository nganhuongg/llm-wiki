# StudyAtlas Frontend

React + Vite + Tailwind CSS. Owned by P4 per plan §10.

## Run

```bash
npm install
npm run dev    # http://localhost:5173
```

The dev server proxies `/api/*` to the FastAPI backend at `http://localhost:8000` (configured in `vite.config.js`, strips the `/api` prefix). Start the backend separately (`uvicorn backend.main:app --reload` from the repo root).

## What's in here today

| File | What it does |
|---|---|
| `src/App.jsx` | Tab shell (Ingest, Wiki, Query, Graph, Lint) |
| `src/components/UploadPanel.jsx` | Drag-and-drop upload + student context note |
| `src/components/WikiViewer.jsx` | Sidebar page list + markdown viewer |
| `src/components/QueryBox.jsx` | Query input, sources, save-as-study-guide |
| `src/components/GraphView.jsx` | Force-directed concept graph |
| `src/components/LintReport.jsx` | Filterable lint issues with severity badges |
| `src/api.js` | API client |

## What P4 builds for the demo (plan §10 P4)

Three demo-critical panels — these are the wow moment:

1. **`MasteryTimeline.jsx`** — reads `/mastery-state`, animates bars 0..1 with a red threshold line at 0.4. Bars must be large enough to read from the back of the room. Color: mastery green → fading amber → forgotten red.
2. **`DecayToast.jsx`** — subscribes to `/events/decay` (SSE). When a `decay:warn` lands, slide in a card showing the concept and its past-self page (returned in the event payload, including `known_as_of`). **This is THE money shot.**
3. **`SkillDiff.jsx`** — renders `/improve` SKILL.md before/after as a side-by-side diff with proper diff highlighting.

Design pass: tighten typography, use a single accent color, no new dependencies (Tailwind only).

## Build

```bash
npm run build      # outputs to dist/
```
