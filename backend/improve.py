"""Skill improvement loop: SkillRunEntry → SKILL.md rewrite.

This module is owned by P3 but defined here so the API layer can import it.
"""
from __future__ import annotations

from dataclasses import dataclass


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
    """
    Propose a rewrite of SKILL.md based on student performance.
    
    This is where P3 calls cognee.SkillRunEntry + improve_skill(apply=False).
    """
    # TODO: P3 implements this
    # Should call:
    #   await cognee.remember(SkillRunEntry(...))
    #   await cognee.improve_skill(skill_name, apply=False)
    # Should return the proposed SKILL.md diff
    
    return {
        "skill_name": skill_name,
        "session_id": session_id,
        "status": "todo_p3",
        "proposed_diff": None,
    }


async def apply_improvement(
    session_id: str,
    skill_name: str = "personalized-explainer",
) -> dict:
    """Apply the proposed SKILL.md rewrite."""
    # TODO: P3 implements this
    # Should call:
    #   await cognee.improve_skill(skill_name, apply=True)
    
    return {
        "skill_name": skill_name,
        "session_id": session_id,
        "applied": False,
        "message": "P3 will implement this",
    }
