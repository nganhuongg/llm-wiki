"""Top-level ingest pipeline: file -> extracted metadata -> wiki + memory."""
from __future__ import annotations

from pathlib import Path

from . import memory, wiki_writer
from .extractor import extract
from .parser import read_text


async def ingest_file(path: Path, session_id: str | None = None) -> dict:
    text = read_text(path)
    extraction = extract(text, path)

    source_page = wiki_writer.write_source_page(path, text, extraction)
    course_page = wiki_writer.write_course_page(extraction, path.name)
    concept_pages = wiki_writer.write_concept_pages(extraction)
    wiki_writer.rebuild_index()

    await memory.remember(
        f"Course: {extraction.course}\n"
        f"Source: {path.name}\n"
        f"Concepts: {', '.join(extraction.concepts)}\n\n"
        f"{text[:4000]}"
    )
    if session_id:
        await memory.remember(
            f"Session source: {path.name}\nConcepts: {', '.join(extraction.concepts)}",
            session_id=session_id,
        )
        await memory.seed_mastery(session_id, extraction.concepts[:12], text)

    return {
        "course": extraction.course,
        "concepts": extraction.concepts,
        "source_page": str(source_page.name),
        "course_page": str(course_page.name),
        "concept_pages": [p.name for p in concept_pages],
    }
