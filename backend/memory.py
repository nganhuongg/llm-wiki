"""Redis-backed memory engine with mastery tracking and event logging.

Combines:
- Cognee for permanent semantic memory (graph)
- Redis for student's working memory (mastery state + event log)
- TTL-based forgetting curve (Ebbinghaus)
- Distillation rule: mastery ≥ 0.7 → promote to Cognee graph
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import redis.asyncio as aioredis
from redis.exceptions import ConnectionError, ResponseError

from . import config

try:
    import cognee  # type: ignore
    _COGNEE = True
except Exception:  # pragma: no cover
    cognee = None  # type: ignore
    _COGNEE = False

# Global async Redis client (lazy-initialized)
_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis | None:
    """Lazy-initialize Redis client."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = await aioredis.from_url(
                config.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            # Test connection
            await _redis_client.ping()
        except (ConnectionError, ResponseError) as e:
            print(f"⚠️  Redis connection failed: {e}")
            print("Continuing with fallback (no mastery tracking)")
            _redis_client = None
    return _redis_client


async def close_redis() -> None:
    """Close Redis client on shutdown."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


# ============================================================================
# MASTERY STATE (Sorted Set: mastery:{session_id})
# ============================================================================


async def set_mastery(session_id: str, concept_slug: str, score: float) -> None:
    """Set mastery score for a concept in a session (0.0 to 1.0)."""
    if not session_id or not concept_slug:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
    key = f"mastery:{session_id}"
    await redis_cli.zadd(key, {concept_slug: score})


async def bump_mastery(session_id: str, concept_slug: str, delta: float) -> None:
    """Increment mastery score (used after interactions)."""
    if not session_id or not concept_slug:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    key = f"mastery:{session_id}"
    # Increment and clamp
    score = await redis_cli.zincrby(key, delta, concept_slug)
    if score > 1.0:
        await redis_cli.zadd(key, {concept_slug: 1.0})


async def get_mastery(session_id: str, concept_slug: str) -> float:
    """Get current mastery score for a concept."""
    if not session_id or not concept_slug:
        return 0.0
    redis_cli = await get_redis()
    if not redis_cli:
        return config.INITIAL_MASTERY
    key = f"mastery:{session_id}"
    score = await redis_cli.zscore(key, concept_slug)
    return float(score) if score is not None else config.INITIAL_MASTERY


async def fading_concepts(
    session_id: str, threshold: float | None = None
) -> list[str]:
    """Return concepts below mastery threshold (fading or forgotten)."""
    if not session_id:
        return []
    if threshold is None:
        threshold = config.MASTERY_THRESHOLDS["fading"]
    redis_cli = await get_redis()
    if not redis_cli:
        return []
    key = f"mastery:{session_id}"
    # ZRANGEBYSCORE returns all members with score in [min, max]
    fading = await redis_cli.zrangebyscore(key, 0, threshold)
    return list(fading)


async def get_mastery_state(session_id: str) -> dict[str, float]:
    """Return full mastery state for a session (for UI)."""
    if not session_id:
        return {}
    redis_cli = await get_redis()
    if not redis_cli:
        return {}
    key = f"mastery:{session_id}"
    # ZRANGE with WITHSCORES returns [(slug, score), ...]
    pairs = await redis_cli.zrange(key, 0, -1, withscores=True)
    return {slug: float(score) for slug, score in pairs}


async def seed_concept_mastery(
    session_id: str, concepts: list[str]
) -> None:
    """Initialize mastery state for newly ingested concepts."""
    if not session_id or not concepts:
        return
    for slug in concepts:
        await set_mastery(session_id, slug, config.INITIAL_MASTERY)
        # Also set a TTL key to trigger decay event
        await _set_concept_ttl(session_id, slug)


async def _set_concept_ttl(session_id: str, concept_slug: str) -> None:
    """Set a TTL key for this concept (triggers forgetting curve)."""
    if not session_id or not concept_slug:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    ttl_key = f"concept:{session_id}:{concept_slug}"
    # Set a marker value with TTL
    await redis_cli.setex(
        ttl_key,
        config.CONCEPT_TTL_SECONDS,
        json.dumps({"slug": concept_slug, "seeded_at": time.time()}),
    )


# ============================================================================
# EVENT LOG (Stream: events:{session_id})
# ============================================================================


async def log_event(
    session_id: str,
    event_type: str,
    metadata: dict[str, Any] | None = None,
) -> str:
    """Log an event to the session's event stream."""
    if not session_id or not event_type:
        return ""
    redis_cli = await get_redis()
    if not redis_cli:
        return ""
    
    key = f"events:{session_id}"
    metadata = metadata or {}
    metadata["event_type"] = event_type
    metadata["timestamp"] = time.time()
    
    # XADD appends to stream
    event_id = await redis_cli.xadd(key, metadata)
    return str(event_id)


async def get_recent_events(session_id: str, limit: int = 50) -> list[dict]:
    """Retrieve recent events from the session's stream."""
    if not session_id:
        return []
    redis_cli = await get_redis()
    if not redis_cli:
        return []
    
    key = f"events:{session_id}"
    # XREVRANGE from most recent backwards
    events = await redis_cli.xrevrange(key, count=limit)
    result = []
    for event_id, event_data in events:
        event_data["id"] = str(event_id)
        result.append(event_data)
    return result


# ============================================================================
# DISTILLATION: Redis → Cognee Graph
# ============================================================================


async def distill_to_graph(
    session_id: str, concept_slug: str, mastery_score: float
) -> None:
    """
    Promote a concept to permanent Cognee graph when mastery ≥ threshold.
    Adds metadata timestamp 'known_as_of' to track when it was consolidated.
    """
    if not _COGNEE:
        return
    
    threshold = config.MASTERY_THRESHOLDS["consolidate"]
    if mastery_score < threshold:
        return  # Not ready yet
    
    # Concept gets promoted to graph with timestamp
    metadata = {
        "known_as_of": time.time(),
        "session_id": session_id,
        "mastery_at_consolidation": mastery_score,
    }
    
    try:
        await cognee.remember(
            f"Consolidated concept: {concept_slug}",
            metadata=metadata,
        )
    except Exception as e:
        print(f"⚠️  Distillation failed for {concept_slug}: {e}")


# ============================================================================
# COGNEE REMEMBER / RECALL (Wrapper)
# ============================================================================


async def remember(
    text: str, metadata: dict[str, Any] | None = None
) -> None:
    """Remember text in Cognee (semantic memory)."""
    if not _COGNEE:
        return
    try:
        await cognee.remember(text, metadata=metadata)
    except Exception as e:
        print(f"⚠️  Cognee remember failed: {e}")


async def recall(query: str, limit: int = 5) -> list[str]:
    """Recall from Cognee memory."""
    if not _COGNEE:
        return []
    try:
        results = await cognee.recall(query)
        if isinstance(results, list):
            return [str(r) for r in results[:limit]]
        return [str(results)]
    except Exception as e:
        print(f"⚠️  Cognee recall failed: {e}")
        return []


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================


async def prune_old_sessions(days: int | None = None) -> int:
    """
    Delete events and mastery state for sessions older than N days.
    Useful for demo cleanup after 7+ days.
    Returns count of sessions pruned.
    """
    if days is None:
        days = config.SESSION_PRUNE_DAYS
    
    redis_cli = await get_redis()
    if not redis_cli:
        return 0
    
    # This is a simple implementation: scan all keys and delete old ones
    # In production, you'd track session creation time more carefully
    cutoff_time = time.time() - (days * 86400)
    
    # For now, manual cleanup only (can enhance later)
    print(f"Session pruning: would remove sessions older than {days} days")
    return 0


async def clear_session(session_id: str) -> None:
    """Completely clear a session's data from Redis."""
    if not session_id:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    
    keys_to_delete = [
        f"mastery:{session_id}",
        f"events:{session_id}",
        f"concept:*",  # Wildcard for TTL keys
    ]
    
    for pattern in keys_to_delete:
        if "*" in pattern:
            # Use SCAN for patterns
            cursor = 0
            while True:
                cursor, keys = await redis_cli.scan(cursor, match=pattern, count=100)
                if keys:
                    await redis_cli.delete(*keys)
                if cursor == 0:
                    break
        else:
            await redis_cli.delete(pattern)


# ============================================================================
# BACKEND DETECTION (for debug)
# ============================================================================


def backend_name() -> str:
    """Return the active memory backend."""
    return "cognee+redis" if _COGNEE else "cognee-only"
