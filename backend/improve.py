"""Deterministic skill improvement loop for the hackathon demo."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from . import config


SKILL_NAME = "personalized-explainer"
SKILL_DIR = config.SKILLS_DIR / SKILL_NAME
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


@dataclass
class SkillRunEntry:
    """Record of a single skill run for improvement analysis."""
    session_id: str
    skill_name: str
    success_score: float  # 0.0 to 1.0
    answer_before: str
    answer_after: str | None = None
    proposed_change: str | None = None


async def propose_improvement(
    session_id: str,
    last_answer_score: float,
    skill_name: str = "personalized-explainer",
) -> dict:
    before = read_skill()
    after = _rewrite_skill(before, last_answer_score, "the most recent question")
    return {
        "skill_name": skill_name,
        "session_id": session_id,
        "status": "proposed",
        "before": before,
        "after": after,
    }


async def apply_improvement(
    session_id: str,
    skill_name: str = "personalized-explainer",
) -> dict:
    """Apply the proposed SKILL.md rewrite."""
    before = read_skill()
    after = _rewrite_skill(before, None, "the most recent question")
    ensure_skill().write_text(after, encoding="utf-8")
    return {
        "skill_name": skill_name,
        "session_id": session_id,
        "applied": True,
        "before": before,
        "after": after,
    }


def ensure_skill() -> Path:
    SKILL_DIR.mkdir(parents=True, exist_ok=True)
    if not SKILL_PATH.exists():
        SKILL_PATH.write_text(DEFAULT_SKILL, encoding="utf-8")
    return SKILL_PATH


def read_skill() -> str:
    return ensure_skill().read_text(encoding="utf-8")


def apply_rewrite(question: str, last_score: float | None = None) -> dict:
    before = read_skill()
    after = _rewrite_skill(before, last_score, question)
    ensure_skill().write_text(after, encoding="utf-8")
    return {
        "skill": SKILL_NAME,
        "path": str(SKILL_PATH.relative_to(config.ROOT)),
        "before": before,
        "after": after,
    }


def _rewrite_skill(before: str, last_score: float | None, question: str) -> str:
    score_text = "unknown" if last_score is None else f"{last_score:.2f}"
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    block = f"""

## Improvement Notes

Last updated: {stamp}

The last answer scored {score_text}. For future answers to questions like:

> {question}

Add these constraints:
- Name the exact research design before explaining details.
- Connect concepts as a chain: case study -> evidence -> hypothesis -> plausibility.
- Separate claim, evidence, assumption, and limitation.
- Use the student's strong area, argument structure, as the frame for research-methods vocabulary.
- Include one sentence the student could say out loud in discussion.
"""
    marker = "## Improvement Notes"
    if marker in before:
        return before.split(marker)[0].rstrip() + block
    return before.rstrip() + block
