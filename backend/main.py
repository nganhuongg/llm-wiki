"""FastAPI entrypoint for StudyAtlas."""
from __future__ import annotations

import asyncio
import json
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import config, graph, improve, ingest, lint, memory, query, wiki_writer

_DECAY_TASK: asyncio.Task | None = None


async def _decay_watcher() -> None:
    client = memory.redis_client()
    if client is None:
        return
    pubsub = client.pubsub()
    await pubsub.psubscribe("__keyevent@*__:expired")
    try:
        async for msg in pubsub.listen():
            if msg.get("type") != "pmessage":
                continue
            key = str(msg.get("data", ""))
            if not key.startswith("decay:"):
                continue
            parts = key.split(":", 2)
            if len(parts) != 3:
                continue
            _, session_id, slug = parts
            await memory.handle_decay_expiration(session_id, slug)
    finally:
        await pubsub.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _DECAY_TASK
    _DECAY_TASK = asyncio.create_task(_decay_watcher())
    improve.ensure_skill()
    try:
        yield
    finally:
        if _DECAY_TASK:
            _DECAY_TASK.cancel()
            try:
                await _DECAY_TASK
            except asyncio.CancelledError:
                pass


app = FastAPI(title="StudyAtlas", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryBody(BaseModel):
    question: str
    k: int = 5
    session_id: str = config.DEFAULT_SESSION_ID


class SaveAnswerBody(BaseModel):
    concept: str | None = None
    courses: list[str] = []
    answer_md: str | None = None
    question: str | None = None
    answer: str | None = None
    session_id: str = config.DEFAULT_SESSION_ID


class AssetIngestBody(BaseModel):
    filename: str
    session_id: str = config.DEFAULT_SESSION_ID


class StudentContextBody(BaseModel):
    context: str
    session_id: str = config.DEFAULT_SESSION_ID


class RateBody(BaseModel):
    question: str
    answer: str = ""
    score: float
    session_id: str = config.DEFAULT_SESSION_ID


class ImproveBody(BaseModel):
    question: str
    session_id: str = config.DEFAULT_SESSION_ID


@app.get("/")
async def root() -> dict:
    return {"name": "StudyAtlas", "version": "0.1.0"}


@app.post("/ingest")
async def post_ingest(
    file: UploadFile = File(...),
    session_id: str = Query(default=config.DEFAULT_SESSION_ID),
) -> dict:
    suffix = Path(file.filename or "upload.txt").suffix.lower()
    bucket = "syllabi" if "syllab" in (file.filename or "").lower() else "readings"
    dest_dir = config.RAW_DIR / bucket
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / (file.filename or f"upload{suffix}")
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    result = await ingest.ingest_file(dest, session_id=session_id)
    return {"file": dest.name, **result}


@app.get("/assets")
async def list_assets() -> dict:
    files = []
    for path in sorted(config.ASSETS_DIR.iterdir()):
        if path.is_file() and path.suffix.lower() in {".pdf", ".docx", ".txt", ".md"}:
            files.append({"name": path.name, "size": path.stat().st_size})
    return {"files": files}


@app.post("/ingest-assets")
async def ingest_asset(body: AssetIngestBody) -> dict:
    target = (config.ASSETS_DIR / body.filename).resolve()
    if not target.is_file() or config.ASSETS_DIR.resolve() not in target.parents:
        raise HTTPException(404, "asset not found")
    result = await ingest.ingest_file(target, session_id=body.session_id)
    return {"file": target.name, **result}


@app.post("/student-context")
async def save_student_context(body: StudentContextBody) -> dict:
    page = wiki_writer.write_student_context(body.context)
    wiki_writer.rebuild_index()
    await memory.remember(f"Student context:\n{body.context}", session_id=body.session_id)
    await memory.remember(f"Durable student profile:\n{body.context}")
    return {"page": page.relative_to(config.WIKI_DIR).as_posix()}


@app.get("/wiki/pages")
async def list_pages() -> dict:
    def listing(dir_: Path) -> list[str]:
        return [p.relative_to(config.WIKI_DIR).as_posix() for p in sorted(dir_.glob("*.md"))]
    return {
        "courses": listing(config.COURSES_DIR),
        "concepts": listing(config.CONCEPTS_DIR),
        "sources": listing(config.SOURCES_DIR),
        "bridges": listing(config.BRIDGES_DIR),
        "student": listing(config.STUDENT_DIR),
        "study_guides": listing(config.STUDY_GUIDES_DIR),
    }


@app.get("/wiki/page/{path:path}")
async def read_page(path: str) -> dict:
    target = (config.WIKI_DIR / path).resolve()
    if not target.is_file() or config.WIKI_DIR.resolve() not in target.parents and target != config.WIKI_DIR:
        raise HTTPException(404, "page not found")
    return {"path": path, "content": target.read_text(encoding="utf-8")}


@app.post("/query")
async def post_query(body: QueryBody) -> dict:
    await memory.remember(f"Current question: {body.question}", session_id=body.session_id)
    return await query.answer(body.question, k=body.k, session_id=body.session_id)


@app.post("/save-answer")
async def post_save_answer(body: SaveAnswerBody) -> dict:
    if body.question or body.answer:
        page = wiki_writer.write_study_guide(body.question or "Saved answer", body.answer or body.answer_md or "")
    else:
        page = wiki_writer.write_bridge_page(body.concept or "concept", body.courses, body.answer_md or "")
    wiki_writer.rebuild_index()
    await memory.remember(
        f"Saved study guide: {body.question or body.concept}\n\n{body.answer or body.answer_md or ''}",
    )
    return {"page": page.relative_to(config.WIKI_DIR).as_posix(), "path": page.relative_to(config.WIKI_DIR).as_posix()}


@app.post("/rate")
async def post_rate(body: RateBody) -> dict:
    concepts = _concepts_from_text(body.question + " " + body.answer)
    delta = 0.12 if body.score >= 0.7 else -0.18
    mastery = await memory.adjust_mastery(body.session_id, concepts, delta)
    await memory.set_last_score(body.session_id, body.score)
    await memory.remember(
        f"Answer rating: {body.score}\nQuestion: {body.question}\nAnswer excerpt: {body.answer[:500]}",
        session_id=body.session_id,
    )
    return {"concepts": concepts, "mastery": mastery}


@app.post("/improve")
async def post_improve(body: ImproveBody) -> dict:
    return improve.apply_rewrite(body.question, await memory.get_last_score(body.session_id))


@app.get("/mastery-state")
async def get_mastery_state(session_id: str = config.DEFAULT_SESSION_ID) -> dict:
    return {
        "session_id": session_id,
        "threshold": config.DECAY_THRESHOLD,
        "concepts": await memory.mastery_state(session_id),
    }


@app.get("/events/decay")
async def decay_events(session_id: str = config.DEFAULT_SESSION_ID):
    async def event_stream():
        client = memory.redis_client()
        if client is None:
            return
        pubsub = client.pubsub()
        await pubsub.subscribe(memory.events_channel(session_id))
        try:
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15)
                if msg and msg.get("type") == "message":
                    yield f"data: {msg['data']}\n\n"
                else:
                    yield ": keepalive\n\n"
        finally:
            await pubsub.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/lint")
async def get_lint() -> dict:
    return lint.run()


@app.get("/graph")
async def get_graph() -> dict:
    return graph.build()


def _concepts_from_text(text: str) -> list[str]:
    known = {
        "case_study": ["case study", "zika", "microcephaly"],
        "evidence_based_argument": ["evidence", "argument", "claim"],
        "hypothesis_development": ["hypothesis"],
        "plausibility": ["plausible", "plausibility", "assumption"],
        "research_design": ["research design", "comparison", "study design"],
    }
    lower = text.lower()
    concepts = [slug for slug, needles in known.items() if any(n in lower for n in needles)]
    return concepts or ["personalized_explanation"]
