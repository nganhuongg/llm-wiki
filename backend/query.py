"""Answer a question against the wiki. Combines BM25 over markdown +
semantic recall from cognee memory, anchored to student's mastery state,
then synthesizes a direct answer via the LLM module."""
from __future__ import annotations

from . import config, llm, memory, search


async def answer(question: str, session_id: str, k: int = 5) -> dict:
    hits = search.search(question, k=k)
    recalled = await memory.recall(question, limit=k) if hits and config.ENABLE_COGNEE_RECALL else []

    # NEW: Extract which concepts were touched
    concepts_touched = [h.get("concept_slug", "") for h in hits if h.get("concept_slug")]
    concepts_touched = [c for c in concepts_touched if c]  # Filter empty

    # NEW: Bump mastery slightly for concepts mentioned in results
    for slug in concepts_touched:
        await memory.bump_mastery(session_id, slug, config.MASTERY_DELTAS["query_touch"])

    # NEW: Log query event
    await memory.log_event(
        session_id,
        "query",
        {
            "question": question,
            "concepts_touched": concepts_touched,
            "hit_count": len(hits),
            "recalled_count": len(recalled),
        },
    )

    context_blocks = []
    for h in hits:
        context_blocks.append({
            "source": h["path"],
            "text": h["snippet"],
            "kind": "wiki",
        })
    for i, r in enumerate(recalled, 1):
        context_blocks.append({
            "source": f"memory:{i}",
            "text": r,
            "kind": "memory",
        })

    answer_md, answer_backend = await llm.synthesize_answer(question, context_blocks)

    return {
        "question": question,
        "answer": answer_md,
        "sources": [h["path"] for h in hits],
        "concepts_touched": concepts_touched,  # NEW: for rating phase
        "hits": hits,
        "recalled": recalled,
        "backend": memory.backend_name(),
        "answer_backend": answer_backend,
    }
