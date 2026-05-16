"""Cognee-backed memory engine.

We hide cognee behind a thin wrapper so the rest of the app calls
`remember(text)` / `recall(query)` without caring about the backend.
If cognee is unavailable we fall back to a tiny in-process store so the
dev loop still runs.
"""
from __future__ import annotations

import asyncio
from typing import Any

try:
    import cognee  # type: ignore
    _COGNEE = True
except Exception:  # pragma: no cover - graceful dev fallback
    cognee = None  # type: ignore
    _COGNEE = False

_FALLBACK: list[str] = []


async def remember(text: str, metadata: dict[str, Any] | None = None) -> None:
    if _COGNEE:
        await cognee.remember(text)  # type: ignore[attr-defined]
        return
    _FALLBACK.append(text)


async def recall(query: str, limit: int = 5) -> list[str]:
    if _COGNEE:
        results = await cognee.recall(query)  # type: ignore[attr-defined]
        if isinstance(results, list):
            return [str(r) for r in results[:limit]]
        return [str(results)]
    q = query.lower()
    scored = sorted(_FALLBACK, key=lambda t: -sum(1 for w in q.split() if w in t.lower()))
    return scored[:limit]


def remember_sync(text: str, metadata: dict[str, Any] | None = None) -> None:
    asyncio.run(remember(text, metadata))


def recall_sync(query: str, limit: int = 5) -> list[str]:
    return asyncio.run(recall(query, limit))


def backend_name() -> str:
    return "cognee" if _COGNEE else "fallback"
