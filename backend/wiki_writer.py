"""Create and update markdown wiki pages + JSON metadata."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from . import config
from .extractor import Extraction


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return s or "untitled"


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _append_changelog(line: str) -> None:
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entry = f"- `{ts}` {line}\n"
    if not config.CHANGELOG_PATH.exists():
        config.CHANGELOG_PATH.write_text("# Changelog\n\n", encoding="utf-8")
    with config.CHANGELOG_PATH.open("a", encoding="utf-8") as f:
        f.write(entry)


def write_source_page(source_path: Path, text: str, extraction: Extraction) -> Path:
    slug = _slug(source_path.stem)
    page = config.SOURCES_DIR / f"{slug}.md"
    preview = "\n".join(text.splitlines()[:40])
    body = f"""# Source: {source_path.name}

- **Course:** [[{extraction.course}]]
- **Concepts:** {', '.join(f'[[{c}]]' for c in extraction.concepts[:12]) or '_none_'}

## Preview

```
{preview}
```
"""
    page.write_text(body, encoding="utf-8")
    log = _load_json(config.SOURCE_LOG_JSON, [])
    log.append({"file": source_path.name, "course": extraction.course, "page": str(page.relative_to(config.ROOT))})
    _save_json(config.SOURCE_LOG_JSON, log)
    _append_changelog(f"added source page `{page.name}`")
    return page


def write_course_page(extraction: Extraction, source_name: str) -> Path:
    slug = _slug(extraction.course)
    page = config.COURSES_DIR / f"{slug}.md"

    existing = page.read_text(encoding="utf-8") if page.exists() else ""
    sources_block = re.search(r"<!--SOURCES-->(.*?)<!--/SOURCES-->", existing, re.S)
    prior_sources = []
    if sources_block:
        prior_sources = [line.strip("- ").strip() for line in sources_block.group(1).strip().splitlines() if line.strip()]
    if source_name not in prior_sources:
        prior_sources.append(source_name)

    concepts_md = "\n".join(f"- [[{c}]]" for c in extraction.concepts) or "_None yet_"
    objectives_md = "\n".join(f"- {o}" for o in extraction.learning_objectives) or "_None extracted_"
    assignments_md = "\n".join(f"- {a}" for a in extraction.assignments) or "_None extracted_"
    readings_md = "\n".join(f"- {r}" for r in extraction.readings) or "_None extracted_"
    sources_md = "\n".join(f"- {s}" for s in prior_sources)

    body = f"""# {extraction.course}

{extraction.description or '_No description extracted yet._'}

## Concepts
{concepts_md}

## Learning Objectives
{objectives_md}

## Assignments
{assignments_md}

## Readings
{readings_md}

## Sources
<!--SOURCES-->
{sources_md}
<!--/SOURCES-->
"""
    page.write_text(body, encoding="utf-8")

    courses = _load_json(config.COURSES_JSON, {})
    courses[slug] = {
        "name": extraction.course,
        "concepts": extraction.concepts,
        "sources": prior_sources,
    }
    _save_json(config.COURSES_JSON, courses)
    _append_changelog(f"updated course page `{page.name}`")
    return page


def write_concept_pages(extraction: Extraction) -> list[Path]:
    concepts = _load_json(config.CONCEPTS_JSON, {})
    paths: list[Path] = []
    for concept in extraction.concepts:
        slug = _slug(concept)
        if not slug:
            continue
        page = config.CONCEPTS_DIR / f"{slug}.md"
        entry = concepts.setdefault(slug, {"name": concept, "courses": []})
        if extraction.course not in entry["courses"]:
            entry["courses"].append(extraction.course)
        if not page.exists():
            body = f"""# {concept}

## Appears in
{chr(10).join(f'- [[{c}]]' for c in entry['courses'])}

## Summary
_Stub. Will be filled in by query/self-improve cycle._
"""
            page.write_text(body, encoding="utf-8")
            _append_changelog(f"created concept page `{page.name}`")
        else:
            text = page.read_text(encoding="utf-8")
            text = re.sub(
                r"## Appears in\n(?:- \[\[.*\]\]\n)+",
                "## Appears in\n" + "\n".join(f"- [[{c}]]" for c in entry["courses"]) + "\n",
                text,
                count=1,
            )
            page.write_text(text, encoding="utf-8")
        paths.append(page)
    _save_json(config.CONCEPTS_JSON, concepts)
    return paths


def write_bridge_page(concept: str, courses: list[str], answer_md: str) -> Path:
    slug = _slug(f"{concept}_across_" + "_and_".join(courses))
    page = config.BRIDGES_DIR / f"{slug}.md"
    body = f"""# {concept.title()} Across {', '.join(courses)}

{answer_md}

---
_Generated by query/self-improve._
"""
    page.write_text(body, encoding="utf-8")
    _append_changelog(f"saved bridge page `{page.name}`")
    return page


def rebuild_index() -> Path:
    def listing(dir_: Path) -> str:
        files = sorted(dir_.glob("*.md"))
        if not files:
            return "_empty_"
        return "\n".join(f"- [{p.stem}]({p.relative_to(config.WIKI_DIR).as_posix()})" for p in files)

    body = f"""# Wiki Index

## Courses
{listing(config.COURSES_DIR)}

## Concepts
{listing(config.CONCEPTS_DIR)}

## Sources
{listing(config.SOURCES_DIR)}

## Bridges
{listing(config.BRIDGES_DIR)}
"""
    config.INDEX_PATH.write_text(body, encoding="utf-8")
    return config.INDEX_PATH
