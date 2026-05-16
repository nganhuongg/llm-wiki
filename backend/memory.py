"""Cognee-backed memory engine.

We hide cognee behind a thin wrapper so the rest of the app calls
`remember(text)` / `recall(query)` without caring about the backend.
If cognee is unavailable we fall back to a tiny in-process store so the
dev loop still runs.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from . import config

try:
    import cognee  # type: ignore
    _COGNEE = True
except Exception:  # pragma: no cover - graceful dev fallback
    cognee = None  # type: ignore
    _COGNEE = False

try:
    import redis.asyncio as redis_async  # type: ignore
    _REDIS_IMPORT = True
except Exception:  # pragma: no cover - graceful dev fallback
    redis_async = None  # type: ignore
    _REDIS_IMPORT = False

_FALLBACK: list[str] = []
_REDIS = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def redis_client():
    global _REDIS
    if not _REDIS_IMPORT:
        return None
    if _REDIS is None:
        _REDIS = redis_async.from_url(config.REDIS_URL, decode_responses=True)
    return _REDIS


def mastery_key(session_id: str) -> str:
    return f"mastery:{session_id}"


def known_key(session_id: str, slug: str) -> str:
    return f"known_as_of:{session_id}:{slug}"


def excerpt_key(session_id: str, slug: str) -> str:
    return f"excerpt:{session_id}:{slug}"


def decay_key(session_id: str, slug: str) -> str:
    return f"decay:{session_id}:{slug}"


def events_channel(session_id: str) -> str:
    return f"events:decay:{session_id}"


def last_score_key(session_id: str) -> str:
    return f"last_score:{session_id}"


async def remember(text: str, metadata: dict[str, Any] | None = None, session_id: str | None = None) -> None:
    if _COGNEE:
        kwargs = {"session_id": session_id} if session_id else {}
        try:
            await asyncio.wait_for(
                cognee.remember(text, **kwargs),  # type: ignore[attr-defined]
                timeout=config.COGNEE_TIMEOUT_SECONDS,
            )
            return
        except Exception:
            _FALLBACK.append(text)
            return
    _FALLBACK.append(text)


async def recall(query: str, limit: int = 5, session_id: str | None = None) -> list[str]:
    if _COGNEE:
        kwargs = {"session_id": session_id} if session_id else {}
        try:
            results = await asyncio.wait_for(
                cognee.recall(query, **kwargs),  # type: ignore[attr-defined]
                timeout=config.COGNEE_TIMEOUT_SECONDS,
            )
            if isinstance(results, list):
                return [str(r) for r in results[:limit]]
            return [str(results)]
        except Exception:
            pass
    q = query.lower()
    scored = sorted(_FALLBACK, key=lambda t: -sum(1 for w in q.split() if w in t.lower()))
    return scored[:limit]


def remember_sync(text: str, metadata: dict[str, Any] | None = None) -> None:
    asyncio.run(remember(text, metadata))


def recall_sync(query: str, limit: int = 5) -> list[str]:
    return asyncio.run(recall(query, limit))


def backend_name() -> str:
    return "cognee" if _COGNEE else "fallback"


async def seed_mastery(session_id: str, concepts: list[str], excerpt: str = "") -> None:
    client = redis_client()
    if client is None:
        return
    now = _now_iso()
    for concept in concepts:
        slug = slugify(concept)
        if not slug:
            continue
        await client.zadd(mastery_key(session_id), {slug: 0.82})
        await client.set(known_key(session_id, slug), now)
        await client.set(excerpt_key(session_id, slug), excerpt[:500])
        await client.set(decay_key(session_id, slug), "1", ex=config.DECAY_TTL_SECONDS)


async def mastery_state(session_id: str) -> list[dict[str, Any]]:
    client = redis_client()
    if client is None:
        return []
    rows = await client.zrange(mastery_key(session_id), 0, -1, withscores=True)
    concepts: list[dict[str, Any]] = []
    for slug, score in rows:
        concepts.append({
            "slug": slug,
            "score": round(float(score), 3),
            "known_as_of": await client.get(known_key(session_id, slug)),
            "page_excerpt": await client.get(excerpt_key(session_id, slug)),
        })
    return concepts


async def adjust_mastery(session_id: str, concepts: list[str], delta: float) -> list[dict[str, Any]]:
    client = redis_client()
    if client is None:
        return []
    for concept in concepts:
        slug = slugify(concept)
        current = await client.zscore(mastery_key(session_id), slug)
        next_score = min(1.0, max(0.0, float(current or 0.5) + delta))
        await client.zadd(mastery_key(session_id), {slug: next_score})
        await client.set(known_key(session_id, slug), _now_iso())
        await client.set(decay_key(session_id, slug), "1", ex=config.DECAY_TTL_SECONDS)
    return await mastery_state(session_id)


async def publish_decay(session_id: str, slug: str, score: float) -> None:
    client = redis_client()
    if client is None:
        return
    payload = {
        "type": "decay:warn",
        "session_id": session_id,
        "concept": slug,
        "score": round(score, 3),
        "known_as_of": await client.get(known_key(session_id, slug)),
        "page_excerpt": await client.get(excerpt_key(session_id, slug)),
    }
    await client.publish(events_channel(session_id), json.dumps(payload))
    await client.xadd(f"stream:decay:{session_id}", payload, maxlen=100, approximate=True)


async def handle_decay_expiration(session_id: str, slug: str) -> None:
    client = redis_client()
    if client is None:
        return
    current = await client.zscore(mastery_key(session_id), slug)
    if current is None:
        return
    score = max(0.0, float(current) - 0.28)
    await client.zadd(mastery_key(session_id), {slug: score})
    if score <= config.DECAY_THRESHOLD:
        await publish_decay(session_id, slug, score)
    if score > 0:
        await client.set(decay_key(session_id, slug), "1", ex=config.DECAY_TTL_SECONDS)


def slugify(name: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


async def set_last_score(session_id: str, score: float) -> None:
    client = redis_client()
    if client is not None:
        await client.set(last_score_key(session_id), str(score), ex=60 * 60)


async def get_last_score(session_id: str) -> float | None:
    client = redis_client()
    if client is None:
        return None
    value = await client.get(last_score_key(session_id))
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None
