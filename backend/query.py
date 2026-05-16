"""Answer a question against the wiki. Combines BM25 over markdown +
semantic recall from cognee memory, anchored to student's mastery state."""
from __future__ import annotations

from . import config, memory, search


async def answer(question: str, session_id: str, k: int = 5) -> dict:
    hits = search.search(question, k=k)
    recalled = await memory.recall(question, limit=k)

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

    sections = []
    for h in hits:
        sections.append(f"### {h['path']}\n{h['snippet']}")
    for i, r in enumerate(recalled, 1):
        sections.append(f"### memory:{i}\n{r}")

    if not sections:
        answer_md = "_No relevant wiki pages or memories yet. Ingest some materials first._"
    else:
        answer_md = (
            f"**Question:** {question}\n\n"
            f"Pulled {len(hits)} wiki page(s) and {len(recalled)} memory snippet(s).\n\n"
            + "\n\n".join(sections)
        )

    return {
        "question": question,
        "answer": answer_md,
        "concepts_touched": concepts_touched,  # NEW: for rating phase
        "hits": hits,
        "recalled": recalled,
        "backend": memory.backend_name(),
    }
