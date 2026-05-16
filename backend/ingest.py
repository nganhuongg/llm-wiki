"""Top-level ingest pipeline: file -> extracted metadata -> wiki + memory."""
from __future__ import annotations

from pathlib import Path

from . import memory, wiki_writer
from .extractor import extract
from .parser import read_text


async def ingest_file(path: Path, session_id: str) -> dict:
    text = read_text(path)
    extraction = extract(text, path)

    source_page = wiki_writer.write_source_page(path, text, extraction)
    course_page = wiki_writer.write_course_page(extraction, path.name)
    concept_pages = wiki_writer.write_concept_pages(extraction)
    wiki_writer.rebuild_index()

    # NEW: Seed Redis mastery state for all extracted concepts
    await memory.seed_concept_mastery(session_id, extraction.concepts)
    
    # NEW: Log ingest event
    await memory.log_event(
        session_id,
        "ingest",
        {
            "file": path.name,
            "course": extraction.course,
            "concepts": extraction.concepts,
            "concept_count": len(extraction.concepts),
        },
    )

    await memory.remember(
        f"Course: {extraction.course}\n"
        f"Source: {path.name}\n"
        f"Concepts: {', '.join(extraction.concepts)}\n\n"
        f"{text[:4000]}"
    )

    return {
        "session_id": session_id,  # NEW: return it for frontend
        "course": extraction.course,
        "concepts": extraction.concepts,
        "source_page": str(source_page.name),
        "course_page": str(course_page.name),
        "concept_pages": [p.name for p in concept_pages],
        "mastery_state": await memory.get_mastery_state(session_id),  # NEW
    }
