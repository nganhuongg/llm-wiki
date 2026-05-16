"""FastAPI entrypoint for CourseAtlas."""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config, graph, ingest, lint, query, wiki_writer

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


class SaveAnswerBody(BaseModel):
    concept: str
    courses: list[str]
    answer_md: str


@app.get("/")
async def root() -> dict:
    return {"name": "CourseAtlas", "version": "0.1.0"}


@app.post("/ingest")
async def post_ingest(file: UploadFile = File(...)) -> dict:
    suffix = Path(file.filename or "upload.txt").suffix.lower()
    bucket = "syllabi" if "syllab" in (file.filename or "").lower() else "readings"
    dest_dir = config.RAW_DIR / bucket
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / (file.filename or f"upload{suffix}")
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    result = await ingest.ingest_file(dest)
    return {"file": dest.name, **result}


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


@app.post("/query")
async def post_query(body: QueryBody) -> dict:
    return await query.answer(body.question, k=body.k)


@app.post("/save-answer")
async def post_save_answer(body: SaveAnswerBody) -> dict:
    page = wiki_writer.write_bridge_page(body.concept, body.courses, body.answer_md)
    wiki_writer.rebuild_index()
    return {"page": page.relative_to(config.WIKI_DIR).as_posix()}


@app.get("/lint")
async def get_lint() -> dict:
    return lint.run()


@app.get("/graph")
async def get_graph() -> dict:
    return graph.build()
