"""Extract course/concept metadata from raw text.

MVP: rule-based with optional LLM upgrade hook. Pulls a course name from
the first non-empty heading or filename, then surfaces repeated capitalized
phrases and explicit hashtag/heading terms as concepts.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

STOPWORDS = {
    "The", "This", "That", "These", "Those", "And", "Or", "But", "For",
    "With", "From", "Into", "Onto", "About", "Course", "Syllabus", "Week",
    "Unit", "Chapter", "Lecture", "Assignment", "Reading", "Notes",
    "Introduction", "Overview", "Section",
}

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
HASHTAG_RE = re.compile(r"(?<!\w)#([A-Za-z][A-Za-z0-9_-]+)")
CAP_PHRASE_RE = re.compile(r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b")
LEARNING_OBJ_RE = re.compile(r"(?im)^\s*(?:-|\*|\d+\.)\s*(?:students? will|you will|learn(?:ing)? objective[s]?:?)\s*(.+)$")

CANONICAL_CONCEPTS = {
    "Case Study": ["case study", "zika", "microcephaly"],
    "Evidence Based Argument": ["evidence based", "evidence-based", "claim", "argument"],
    "Hypothesis Development": ["hypothesis development", "hypothesis"],
    "Plausibility": ["plausibility", "plausible"],
    "Research Design": ["research design", "study design"],
    "Confounders": ["confounder", "confounding"],
}


@dataclass
class Extraction:
    course: str
    description: str = ""
    units: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    concepts: list[str] = field(default_factory=list)
    learning_objectives: list[str] = field(default_factory=list)
    assignments: list[str] = field(default_factory=list)
    readings: list[str] = field(default_factory=list)
    terms: list[str] = field(default_factory=list)


def _guess_course_name(text: str, fallback: str) -> str:
    headings = HEADING_RE.findall(text)
    if headings:
        return headings[0][1].strip()
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:80]
    return fallback


def _top_capitalized(text: str, k: int = 20) -> list[str]:
    counts = Counter()
    for match in CAP_PHRASE_RE.finditer(text):
        phrase = match.group(1).strip()
        if phrase in STOPWORDS or len(phrase) < 4:
            continue
        counts[phrase] += 1
    return [p for p, c in counts.most_common(k) if c >= 2]


def _bullets_under(text: str, header_keywords: list[str]) -> list[str]:
    out: list[str] = []
    lines = text.splitlines()
    capturing = False
    for line in lines:
        stripped = line.strip()
        if HEADING_RE.match(line):
            capturing = any(kw.lower() in stripped.lower() for kw in header_keywords)
            continue
        if capturing and re.match(r"^\s*(?:-|\*|\d+\.)\s+(.+)$", line):
            out.append(re.sub(r"^\s*(?:-|\*|\d+\.)\s+", "", line).strip())
    return out


def extract(text: str, source_path: Path) -> Extraction:
    fallback = source_path.stem.replace("_", " ").replace("-", " ").title()
    course = _guess_course_name(text, fallback)

    description = ""
    for para in text.split("\n\n"):
        para = para.strip()
        if para and not para.startswith("#") and len(para) > 60:
            description = para[:400]
            break

    concepts = set(_top_capitalized(text))
    concepts.update(HASHTAG_RE.findall(text))
    concepts.update(m[1].strip() for m in HEADING_RE.findall(text)[1:6])
    lower = text.lower()
    for concept, needles in CANONICAL_CONCEPTS.items():
        if any(needle in lower for needle in needles):
            concepts.add(concept)

    learning_objs = [m.strip() for m in LEARNING_OBJ_RE.findall(text)]
    assignments = _bullets_under(text, ["assignment", "homework", "project"])
    readings = _bullets_under(text, ["reading", "textbook", "resource"])
    topics = _bullets_under(text, ["topic", "week", "unit", "schedule"])

    return Extraction(
        course=course,
        description=description,
        units=topics,
        topics=topics,
        concepts=sorted(c for c in concepts if c),
        learning_objectives=learning_objs,
        assignments=assignments,
        readings=readings,
        terms=sorted(concepts),
    )
