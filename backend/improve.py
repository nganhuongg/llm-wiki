"""Demo skill improvement loop for P3.

The real Cognee skill proposal API is available for deeper integration, but the
hackathon demo needs a deterministic propose/apply path that returns a visible
SKILL.md diff. This module keeps that loop explicit and file-backed.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from . import config

SKILL_DIR = config.SKILLS_DIR / "personalized-explainer"
SKILL_PATH = SKILL_DIR / "SKILL.md"

DEFAULT_SKILL = """---
description: Explain course concepts using the student's current context and saved wiki memory.
allowed-tools: memory_search
---

# Personalized Explainer

Use the student's course materials and profile to answer clearly.

When answering:
- Start with the student's question.
- Use relevant course concepts and source pages.
- Connect the answer to the student's stated confusion.
- End with a short study checklist.
"""


def ensure_skill() -> Path:
    SKILL_DIR.mkdir(parents=True, exist_ok=True)
    if not SKILL_PATH.exists():
        SKILL_PATH.write_text(DEFAULT_SKILL, encoding="utf-8")
    return SKILL_PATH


def read_skill() -> str:
    return ensure_skill().read_text(encoding="utf-8")


def propose_rewrite(question: str, last_score: float | None = None) -> tuple[str, str]:
    before = read_skill()
    score_text = "unknown" if last_score is None else f"{last_score:.2f}"
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")

    improvement_block = f"""

## Improvement Notes

Last updated: {stamp}

The last answer scored {score_text}. For future answers to questions like:

> {question}

Add these constraints:
- Name the exact research design before explaining details.
- Separate claim, evidence, assumption, and limitation.
- Use the student's weak topics as the structure of the explanation.
- Include one sentence that the student could say out loud in discussion.
"""

    marker = "## Improvement Notes"
    if marker in before:
        after = before.split(marker)[0].rstrip() + improvement_block
    else:
        after = before.rstrip() + improvement_block
    return before, after


def apply_rewrite(question: str, last_score: float | None = None) -> dict:
    before, after = propose_rewrite(question, last_score)
    ensure_skill().write_text(after, encoding="utf-8")
    return {
        "skill": "personalized-explainer",
        "path": str(SKILL_PATH.relative_to(config.ROOT)),
        "before": before,
        "after": after,
    }
