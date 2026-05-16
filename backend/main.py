"""FastAPI entrypoint for CourseAtlas."""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config, graph, ingest, lint, memory, query, wiki_writer

app = FastAPI(title="CourseAtlas", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryBody(BaseModel):
    question: str
    k: int = 5


class RateBody(BaseModel):
    rating: float  # 0.0 to 1.0
    concepts_touched: list[str]


class SaveAnswerBody(BaseModel):
    concept: str
    courses: list[str]
    answer_md: str


@app.get("/")
async def root() -> dict:
    return {"name": "CourseAtlas", "version": "0.1.0"}


# ============================================================================
# INGEST (Updated to handle session_id)
# ============================================================================

@app.post("/ingest")
async def post_ingest(file: UploadFile = File(...), session_id: str | None = Query(None)) -> dict:
    """
    Upload and ingest a file.
    
    If session_id is not provided, generate a new one.
    Returns session_id so frontend can store it in localStorage.
    """
    # NEW: Generate session_id if not provided (first upload)
    if not session_id:
        session_id = str(uuid.uuid4())
    
    suffix = Path(file.filename or "upload.txt").suffix.lower()
    bucket = "syllabi" if "syllab" in (file.filename or "").lower() else "readings"
    dest_dir = config.RAW_DIR / bucket
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / (file.filename or f"upload{suffix}")
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # UPDATED: Pass session_id to ingest
    result = await ingest.ingest_file(dest, session_id)
    return {"file": dest.name, **result}


# ============================================================================
# NEW: MASTERY STATE (For UI Bars)
# ============================================================================

@app.get("/mastery-state")
async def get_mastery_state(session_id: str = Query(...)) -> dict:
    """
    Return current mastery state for all concepts in a session.
    Used by frontend to render mastery bars.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    state = await memory.get_mastery_state(session_id)
    return {
        "session_id": session_id,
        "mastery": state,
        "threshold_fading": config.MASTERY_THRESHOLDS["fading"],
        "threshold_consolidate": config.MASTERY_THRESHOLDS["consolidate"],
    }


# ============================================================================
# QUERY (Updated with session_id)
# ============================================================================

@app.post("/query")
async def post_query(body: QueryBody, session_id: str = Query(...)) -> dict:
    """
    Ask a question against the wiki.
    
    Returns answer + concepts touched (for rating phase).
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    result = await query.answer(body.question, session_id, k=body.k)
    return result


# ============================================================================
# NEW: RATE ANSWER (Updates Mastery + Triggers Skill Improvement Proposal)
# ============================================================================

@app.post("/rate")
async def post_rate(body: RateBody, session_id: str = Query(...)) -> dict:
    """
    Rate an answer (0.0 to 1.0).
    
    - If rating ≥ 0.7: bump mastery for concepts_touched
    - Log rating event
    - Return success + concepts updated
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    if not (0.0 <= body.rating <= 1.0):
        raise HTTPException(status_code=400, detail="rating must be 0.0-1.0")
    
    updated_concepts = []
    
    # Only bump if high rating
    if body.rating >= 0.7:
        for slug in body.concepts_touched:
            await memory.bump_mastery(session_id, slug, config.MASTERY_DELTAS["high_rating"])
            
            # Check if this concept should be distilled to graph
            new_score = await memory.get_mastery(session_id, slug)
            await memory.distill_to_graph(session_id, slug, new_score)
            
            updated_concepts.append(slug)
    
    # Log event
    await memory.log_event(
        session_id,
        "rate",
        {
            "rating": body.rating,
            "concepts_touched": body.concepts_touched,
            "bumped": updated_concepts,
        },
    )
    
    # NEW: Get mastery state after update
    new_state = await memory.get_mastery_state(session_id)
    
    return {
        "success": True,
        "rating": body.rating,
        "concepts_bumped": updated_concepts,
        "mastery_state": new_state,
    }


# ============================================================================
# WIKI ENDPOINTS
# ============================================================================

@app.get("/wiki/pages")
async def list_pages() -> dict:
    def listing(dir_: Path) -> list[str]:
        return [p.relative_to(config.WIKI_DIR).as_posix() for p in sorted(dir_.glob("*.md"))]
    return {
        "courses": listing(config.COURSES_DIR),
        "concepts": listing(config.CONCEPTS_DIR),
        "sources": listing(config.SOURCES_DIR),
        "bridges": listing(config.BRIDGES_DIR),
    }


@app.get("/wiki/page/{path:path}")
async def read_page(path: str) -> dict:
    target = (config.WIKI_DIR / path).resolve()
    if not target.is_file() or config.WIKI_DIR.resolve() not in target.parents and target != config.WIKI_DIR:
        raise HTTPException(404, "page not found")
    return {"path": path, "content": target.read_text(encoding="utf-8")}


# ============================================================================
# SAVE & LINT ENDPOINTS (Updated with session_id)
# ============================================================================

@app.post("/save-answer")
async def post_save_answer(body: SaveAnswerBody, session_id: str = Query(...)) -> dict:
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    page = wiki_writer.write_bridge_page(body.concept, body.courses, body.answer_md)
    wiki_writer.rebuild_index()
    
    # NEW: Log the event
    await memory.log_event(
        session_id,
        "save_answer",
        {
            "concept": body.concept,
            "courses": body.courses,
        },
    )
    
    return {"page": page.relative_to(config.WIKI_DIR).as_posix()}


@app.get("/lint")
async def get_lint(session_id: str = Query(...)) -> dict:
    """
    Run lint checks on the wiki.
    
    NEW: Includes fading-concepts rule (from Redis mastery state).
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Get base lint issues
    issues = lint.run()
    
    # NEW: Add fading-concepts rule
    fading = await memory.fading_concepts(session_id)
    for slug in fading:
        mastery = await memory.get_mastery(session_id, slug)
        issues.append({
            "type": "fading_concept",
            "name": slug,
            "mastery": mastery,
            "threshold": config.MASTERY_THRESHOLDS["fading"],
            "message": f"Concept `{slug}` is fading (mastery {mastery:.2f}). Review soon to consolidate.",
        })
    
    return {"issues": issues, "session_id": session_id}


@app.get("/graph")
async def get_graph(session_id: str = Query(...)) -> dict:
    """
    Return concept graph as JSON.
    
    NEW: Nodes include mastery + known_as_of from Redis.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    state = await memory.get_mastery_state(session_id)
    graph_data = graph.build()
    
    # Enrich graph nodes with mastery state
    for node in graph_data.get("nodes", []):
        node["mastery"] = state.get(node["id"], config.INITIAL_MASTERY)
    
    return graph_data

