"""BM25 keyword search across markdown wiki pages."""
from __future__ import annotations

import math
import re
from collections import Counter
from pathlib import Path

from . import config

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]{1,}")


def _tokenize(text: str) -> list[str]:
    return [w.lower() for w in WORD_RE.findall(text)]


def _all_pages() -> list[Path]:
    return [
        p
        for d in (
            config.COURSES_DIR,
            config.CONCEPTS_DIR,
            config.SOURCES_DIR,
            config.BRIDGES_DIR,
            config.STUDENT_DIR,
            config.STUDY_GUIDES_DIR,
        )
        for p in d.glob("*.md")
    ]


def search(query: str, k: int = 5) -> list[dict]:
    pages = _all_pages()
    if not pages:
        return []
    docs = {p: _tokenize(p.read_text(encoding="utf-8", errors="ignore")) for p in pages}
    avgdl = sum(len(t) for t in docs.values()) / len(docs)
    N = len(docs)
    df = Counter()
    for tokens in docs.values():
        df.update(set(tokens))
    q_tokens = _tokenize(query)
    k1, b = 1.5, 0.75
    scored: list[tuple[float, Path]] = []
    for path, tokens in docs.items():
        if not tokens:
            continue
        tf = Counter(tokens)
        score = 0.0
        for term in q_tokens:
            if term not in tf:
                continue
            idf = math.log(1 + (N - df[term] + 0.5) / (df[term] + 0.5))
            denom = tf[term] + k1 * (1 - b + b * len(tokens) / avgdl)
            score += idf * (tf[term] * (k1 + 1)) / denom
        if score > 0:
            scored.append((score, path))
    scored.sort(key=lambda x: -x[0])
    return [
        {
            "path": str(p.relative_to(config.WIKI_DIR).as_posix()),
            "score": round(s, 3),
            "snippet": p.read_text(encoding="utf-8", errors="ignore")[:280],
        }
        for s, p in scored[:k]
    ]
