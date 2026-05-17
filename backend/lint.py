"""Wiki health checks."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from . import config

WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def _read_pages(dir_: Path) -> dict[Path, str]:
    return {p: p.read_text(encoding="utf-8", errors="ignore") for p in dir_.glob("*.md")}


def run() -> dict:
    courses = _read_pages(config.COURSES_DIR)
    concepts = _read_pages(config.CONCEPTS_DIR)
    sources = _read_pages(config.SOURCES_DIR)
    bridges = _read_pages(config.BRIDGES_DIR)

    issues: list[dict] = []

    mentioned = Counter()
    for text in list(courses.values()) + list(sources.values()):
        for name in WIKILINK_RE.findall(text):
            mentioned[name] += 1

    concept_slugs = {p.stem for p in concepts}
    for name, count in mentioned.items():
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        if slug not in concept_slugs and count >= 2 and slug:
            issues.append({
                "type": "missing_concept",
                "name": name,
                "mentions": count,
                "message": f"`{name}` mentioned {count}x but has no concept page.",
            })

    for path, text in concepts.items():
        if not WIKILINK_RE.search(text) and "Appears in" in text:
            ins = sum(1 for t in list(courses.values()) + list(bridges.values()) if path.stem in t)
            if ins == 0:
                issues.append({
                    "type": "orphan",
                    "name": path.stem,
                    "message": f"Concept page `{path.name}` has no incoming links.",
                })

    concept_to_courses: dict[str, set[str]] = defaultdict(set)
    if config.CONCEPTS_JSON.exists():
        try:
            data = json.loads(config.CONCEPTS_JSON.read_text(encoding="utf-8"))
            for slug, entry in data.items():
                for c in entry.get("courses", []):
                    concept_to_courses[slug].add(c)
        except json.JSONDecodeError:
            pass

    bridge_text_blob = "\n".join(bridges.values()).lower()
    for slug, course_set in concept_to_courses.items():
        if len(course_set) >= 2 and slug.replace("_", " ") not in bridge_text_blob:
            issues.append({
                "type": "weak_bridge",
                "name": slug,
                "courses": sorted(course_set),
                "message": f"Concept `{slug}` appears in {len(course_set)} courses but has no bridge page.",
            })

    course_links_in_sources = "\n".join(sources.values())
    for path in sources:
        if "[[" not in course_links_in_sources:
            issues.append({
                "type": "source_unlinked",
                "name": path.stem,
                "message": f"Source `{path.name}` is not linked to any concept.",
            })
            break

    report_lines = ["# Lint Report\n"]
    if not issues:
        report_lines.append("_Wiki looks clean._\n")
    else:
        for i, issue in enumerate(issues, 1):
            report_lines.append(f"{i}. **{issue['type']}** - {issue['message']}")
    config.LINT_REPORT_PATH.write_text("\n".join(report_lines), encoding="utf-8")

    return {"issues": issues, "report_path": str(config.LINT_REPORT_PATH.relative_to(config.ROOT))}
