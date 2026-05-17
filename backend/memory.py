"""Redis-backed memory engine with mastery tracking, auto-decay, and event logging.
Combines:
- Cognee for permanent semantic memory (graph)
- Redis for student's working memory (mastery state + event log)
- Background decay watcher + Pub/Sub for live UI toasts
- Distillation rule: mastery >= 0.7 -> promote to Cognee graph
"""
from __future__ import annotations
import asyncio
import json
import re
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
            await _redis_client.ping()
        except (ConnectionError, ResponseError) as e:
            print(f"Redis connection failed: {e}")
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
    if not session_id or not concept_slug:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    score = max(0.0, min(1.0, score))
    key = f"mastery:{session_id}"
    await _mark_active_session(redis_cli, session_id)
    await redis_cli.zadd(key, {concept_slug: score})

async def bump_mastery(session_id: str, concept_slug: str, delta: float) -> None:
    if not session_id or not concept_slug:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    current = await get_mastery(session_id, concept_slug)
    await set_mastery(session_id, concept_slug, current + delta)

async def get_mastery(session_id: str, concept_slug: str) -> float:
    if not session_id or not concept_slug:
        return 0.0
    redis_cli = await get_redis()
    if not redis_cli:
        return config.INITIAL_MASTERY
    key = f"mastery:{session_id}"
    score = await redis_cli.zscore(key, concept_slug)
    return float(score) if score is not None else config.INITIAL_MASTERY

async def fading_concepts(session_id: str, threshold: float | None = None) -> list[str]:
    if not session_id:
        return []
    if threshold is None:
        threshold = config.MASTERY_THRESHOLDS["fading"]
    redis_cli = await get_redis()
    if not redis_cli:
        return []
    key = f"mastery:{session_id}"
    fading = await redis_cli.zrangebyscore(key, 0, threshold)
    return list(fading)

async def get_mastery_state(session_id: str) -> dict[str, float]:
    if not session_id:
        return {}
    redis_cli = await get_redis()
    if not redis_cli:
        return {}
    key = f"mastery:{session_id}"
    pairs = await redis_cli.zrange(key, 0, -1, withscores=True)
    return {slug: float(score) for slug, score in pairs}

async def seed_concept_mastery(session_id: str, concepts: list[str]) -> None:
    if not session_id or not concepts:
        return
    for concept in concepts:
        slug = slugify(concept)
        if not slug:
            continue
        await set_mastery(session_id, slug, config.INITIAL_MASTERY)
        await _set_concept_ttl(session_id, slug)

async def _set_concept_ttl(session_id: str, concept_slug: str) -> None:
    if not session_id or not concept_slug:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    ttl_key = f"concept:{session_id}:{concept_slug}"
    await redis_cli.setex(
        ttl_key,
        config.CONCEPT_TTL_SECONDS,
        json.dumps({"slug": concept_slug, "seeded_at": time.time()}),
    )

# ============================================================================
# EVENT LOG (Stream: events:{session_id})
# ============================================================================
async def log_event(session_id: str, event_type: str, metadata: dict[str, Any] | None = None) -> str:
    if not session_id or not event_type:
        return ""
    redis_cli = await get_redis()
    if not redis_cli:
        return ""
    await _mark_active_session(redis_cli, session_id)
    key = f"events:{session_id}"
    metadata = metadata or {}
    metadata["event_type"] = event_type
    metadata["timestamp"] = time.time()
    event_id = await redis_cli.xadd(key, _redis_stream_fields(metadata))
    return str(event_id)


async def _mark_active_session(redis_cli: aioredis.Redis, session_id: str) -> None:
    await redis_cli.sadd("sessions:active", session_id)


def _redis_stream_fields(metadata: dict[str, Any]) -> dict[str, str | int | float]:
    fields: dict[str, str | int | float] = {}
    for key, value in metadata.items():
        if isinstance(value, (str, int, float)):
            fields[key] = value
        elif value is None:
            fields[key] = ""
        else:
            fields[key] = json.dumps(value)
    return fields

async def get_recent_events(session_id: str, limit: int = 50) -> list[dict]:
    if not session_id:
        return []
    redis_cli = await get_redis()
    if not redis_cli:
        return []
    key = f"events:{session_id}"
    events = await redis_cli.xrevrange(key, count=limit)
    result = []
    for event_id, event_data in events:
        event_data["id"] = str(event_id)
        result.append(event_data)
    return result

# ============================================================================
# DISTILLATION: Redis -> Cognee Graph
# ============================================================================
async def distill_to_graph(session_id: str, concept_slug: str, mastery_score: float | None = None) -> None:
    """Promote a concept to permanent Cognee graph when mastery >= threshold."""
    if not _COGNEE:
        return
    threshold = config.MASTERY_THRESHOLDS["consolidate"]
    
    # P2 HACKATHON FIX: Fetch current mastery if not provided
    if mastery_score is None:
        mastery_score = await get_mastery(session_id, concept_slug)
    if mastery_score < threshold:
        return

    metadata = {
        "known_as_of": time.time(),
        "session_id": session_id,
        "mastery_at_consolidation": mastery_score,
    }

    try:
        text = f"Consolidated concept: {concept_slug}\nMetadata: {json.dumps(metadata)}"
        await asyncio.wait_for(cognee.remember(text), timeout=config.COGNEE_TIMEOUT_SECONDS)
    except Exception as e:
        print(f"Distillation failed for {concept_slug}: {e}")

# ============================================================================
# COGNEE WRAPPER (Async-Safe)
# ============================================================================
async def remember(text: str, metadata: dict[str, Any] | None = None) -> None:
    if not _COGNEE:
        return
    try:
        if metadata:
            text = f"{text}\n\nMetadata: {json.dumps(metadata)}"
        await asyncio.wait_for(cognee.remember(text), timeout=config.COGNEE_TIMEOUT_SECONDS)
    except Exception as e:
        print(f"Cognee remember failed: {e}")

async def recall(query: str, limit: int = 5) -> list[str]:
    if not _COGNEE:
        return []
    try:
        results = await asyncio.wait_for(
            cognee.recall(query),
            timeout=config.COGNEE_TIMEOUT_SECONDS,
        )
        if isinstance(results, list):
            return [str(r) for r in results[:limit]]
        return [str(results)]
    except Exception as e:
        print(f"Cognee recall failed: {e}")
        return []

# ============================================================================
# AUTO-DECAY & PUB/SUB (P2 HACKATHON FIX)
# ============================================================================
async def _publish_decay_event(session_id: str, concept_slug: str, mastery: float) -> None:
    """Publish decay warning to Redis pub/sub for frontend toast."""
    redis_cli = await get_redis()
    if not redis_cli:
        return
    channel = f"decay:warn:{session_id}"
    payload = json.dumps({
        "type": "decay:warn",
        "concept": concept_slug,
        "concept_slug": concept_slug,
        "score": round(mastery, 3),
        "mastery": round(mastery, 3),
        "timestamp": time.time(),
        "threshold": config.MASTERY_THRESHOLDS["fading"],
    })
    await redis_cli.publish(channel, payload)

async def _apply_fading_decay(session_id: str, delta: float = config.DECAY_DELTA) -> list[dict]:
    """Apply decay to all concepts below threshold. Returns newly faded concepts."""
    redis_cli = await get_redis()
    if not redis_cli:
        return []
    
    threshold = config.MASTERY_THRESHOLDS["fading"]
    key = f"mastery:{session_id}"
    faded = []
    
    # Get all concepts currently in Redis for this session
    all_concepts = await redis_cli.zrange(key, 0, -1)
    
    for slug in all_concepts:
        current_score = await get_mastery(session_id, slug)
        new_score = max(0.0, current_score + delta)
        await set_mastery(session_id, slug, new_score)
        
        # Check if it just crossed the fading threshold
        if current_score >= threshold and new_score < threshold:
            await _publish_decay_event(session_id, slug, new_score)
            faded.append({"slug": slug, "mastery": new_score})
            
    return faded

async def start_decay_watcher(app: Any = None) -> None:
    """Background task that runs every N seconds to apply mastery decay."""
    print("Decay watcher started (P2 HACKATHON MODE)")
    while True:
        await asyncio.sleep(config.DECAY_CHECK_INTERVAL_SECONDS)
        redis_cli = await get_redis()
        if not redis_cli:
            continue
        sessions = await redis_cli.smembers("sessions:active")
        if not sessions:
            sessions = {config.DEFAULT_SESSION_ID}
        for session_id in sessions:
            await _apply_fading_decay(str(session_id))

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================
async def prune_old_sessions(days: int | None = None) -> int:
    if days is None:
        days = config.SESSION_PRUNE_DAYS
    redis_cli = await get_redis()
    if not redis_cli:
        return 0
    print(f"Session pruning: would remove sessions older than {days} days")
    return 0

async def clear_session(session_id: str) -> None:
    """Completely clear a session's data from Redis."""
    if not session_id:
        return
    redis_cli = await get_redis()
    if not redis_cli:
        return
    
    # P2 HACKATHON FIX: Safe SCAN for session-specific keys
    keys_to_delete = [
        f"mastery:{session_id}",
        f"events:{session_id}",
    ]
    for key in keys_to_delete:
        await redis_cli.delete(key)
        
    # Delete TTL keys safely
    pattern = f"concept:{session_id}:*"
    async for key in redis_cli.scan_iter(match=pattern, count=100):
        await redis_cli.delete(key)

def backend_name() -> str:
    return "cognee+redis" if _COGNEE else "cognee-only"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
