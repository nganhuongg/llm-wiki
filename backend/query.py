"""Answer a question against the wiki. Combines BM25 over markdown +
semantic recall from cognee memory, then synthesizes a direct answer."""
from __future__ import annotations

from . import llm, memory, search


async def answer(question: str, k: int = 5, session_id: str | None = None) -> dict:
    hits = search.search(question, k=k)
    recalled = await memory.recall(question, limit=k, session_id=session_id)

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
        "hits": hits,
        "recalled": recalled,
        "backend": memory.backend_name(),
        "answer_backend": answer_backend,
    }
