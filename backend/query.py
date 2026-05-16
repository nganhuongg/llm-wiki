"""Answer a question against the wiki. Combines BM25 over markdown +
semantic recall from cognee memory."""
from __future__ import annotations

from . import memory, search


async def answer(question: str, k: int = 5) -> dict:
    hits = search.search(question, k=k)
    recalled = await memory.recall(question, limit=k)

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
        "hits": hits,
        "recalled": recalled,
        "backend": memory.backend_name(),
    }
