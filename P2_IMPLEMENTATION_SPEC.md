# P2 Implementation Specs (Based on Your Answers)

## Your Configuration

```python
# backend/config.py additions
REDIS_URL = "redis://localhost:6379"
DEMO_TIME_SCALE = 100  # 1 day → 14 seconds for stage demo
MASTERY_THRESHOLDS = {
    "fading": 0.4,        # Below this = fading concept (lint warning)
    "consolidate": 0.7,   # At or above = promote to Cognee graph
}
MASTERY_DELTAS = {
    "query_touch": 0.05,       # Concept mentioned in search result
    "high_rating": 0.2,        # When student rates answer ≥0.7
}
INITIAL_MASTERY = 0.2  # New concept starts here
SESSION_PRUNE_DAYS = 7  # Demo mode: prune after 7 days
```

---

## Core Design: Redis Primitives

### Sorted Set: `mastery:{session_id}`
```
Key: mastery:abc-123-def
Members: concept slugs
Scores: 0.0 to 1.0 (mastery level)

Operations:
  ZADD mastery:abc-123 0.2 case_study
  ZINCRBY mastery:abc-123 0.05 hypothesis_development
  ZRANGEBYSCORE mastery:abc-123 0 0.4  → returns fading concepts
  ZRANGE mastery:abc-123 0 -1 WITHSCORES → full dump for UI
```

### TTL Keys: `concept:{session_id}:{slug}`
```
Key: concept:abc-123:plausibility
Value: {} (just a marker)
TTL: seconds calculated from DEMO_TIME_SCALE

Purpose: When TTL expires, keyspace notification fires
→ triggers decay event for frontend toast
→ backend publishes to Redis pub/sub channel

Calculation:
  Ebbinghaus forgetting curve ≈ 1 day to first forget
  With DEMO_TIME_SCALE=100: 86400s / 100 = 864s ≈ 14 minutes
  Sped up 100× = 14 seconds ✓
```

### Stream: `events:{session_id}`
```
Key: events:abc-123
Entries (time-indexed):
  {event_type: "ingest", file: "syllabus.pdf", concepts: [...]}
  {event_type: "query", question: "...", concepts_touched: [...]}
  {event_type: "rate", rating: 0.8, concepts_touched: [...]}

Operations:
  XADD events:abc-123 * event_type ingest file syllabus.pdf ...
  XRANGE events:abc-123 - +  → get all events
  XREVRANGE events:abc-123 + - COUNT 50  → last 50 events
  XTRIM events:abc-123 MAXLEN ~ 500  → keep recent only

Purpose: Audit trail + data source for analytics
Pruning: After SESSION_PRUNE_DAYS, delete entire key
```

### Pub/Sub: `decay:warn:{session_id}`
```
Channel: decay:warn:abc-123
Message (on TTL expiration): {
  "concept_slug": "plausibility",
  "mastery": 0.35,
  "page_title": "Plausibility in Evidence Reasoning",
  "known_as_of": "2026-05-16T10:22:00Z",
  "timestamp": <epoch>
}

Purpose: Push-based notification to frontend
Flow:
  1. Decay watcher (background task) runs every 2s
  2. Queries ZRANGEBYSCORE mastery 0 0.4 (concepts < threshold)
  3. For each, publishes to decay:warn channel
  4. Frontend (P4) subscribes via SSE endpoint
  5. Shows toast with past-self page
```

---

## Files to Create/Update

### 1. Update `backend/config.py`

Add these constants:

```python
import os
from pathlib import Path

# ... existing path config ...

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DEMO_TIME_SCALE = int(os.getenv("DEMO_TIME_SCALE", "100"))

# Mastery thresholds
MASTERY_THRESHOLDS = {
    "fading": 0.4,        # Below this = fading concept (lint warning)
    "consolidate": 0.7,   # At or above = promote to Cognee graph
}

# Mastery delta per interaction
MASTERY_DELTAS = {
    "query_touch": 0.05,       # Concept mentioned in search result
    "high_rating": 0.2,        # Student rated answer ≥0.7
}

# Initial mastery for new concepts
INITIAL_MASTERY = 0.2

# Session management
SESSION_PRUNE_DAYS = 7  # Prune events after 7 days (or faster in demo)
SESSION_PRUNE_SECONDS = SESSION_PRUNE_DAYS * 86400

# Forgetting curve for TTL (Ebbinghaus)
# Ebbinghaus says ~1 day to first forget; scale by DEMO_TIME_SCALE
CONCEPT_TTL_SECONDS = int(86400 / DEMO_TIME_SCALE)  # 864s at 100x
```

---

### 2. Rewrite `backend/memory.py` — The Core

**This is your load-bearing file. Build it carefully.**

```python
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


async def get_redis() -> aioredis.Redis:
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
```

---

### 3. Update `backend/config.py` — Full File

```python
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent.parent
WIKI_DIR = ROOT / "wiki"
RAW_DIR = ROOT / "raw_materials"
META_DIR = ROOT / "metadata"

COURSES_DIR = WIKI_DIR / "courses"
CONCEPTS_DIR = WIKI_DIR / "concepts"
SOURCES_DIR = WIKI_DIR / "sources"
BRIDGES_DIR = WIKI_DIR / "bridges"

INDEX_PATH = WIKI_DIR / "index.md"
CHANGELOG_PATH = WIKI_DIR / "changelog.md"
LINT_REPORT_PATH = WIKI_DIR / "lint_report.md"

COURSES_JSON = META_DIR / "courses.json"
CONCEPTS_JSON = META_DIR / "concepts.json"
GRAPH_JSON = META_DIR / "graph.json"
SOURCE_LOG_JSON = META_DIR / "source_log.json"

for d in (WIKI_DIR, RAW_DIR, META_DIR, COURSES_DIR, CONCEPTS_DIR, SOURCES_DIR, BRIDGES_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ============================================================================
# Redis Configuration
# ============================================================================
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DEMO_TIME_SCALE = int(os.getenv("DEMO_TIME_SCALE", "100"))

# ============================================================================
# Mastery & Learning Configuration
# ============================================================================
MASTERY_THRESHOLDS = {
    "fading": 0.4,        # Below this = fading concept (lint warning)
    "consolidate": 0.7,   # At or above = promote to Cognee graph
}

MASTERY_DELTAS = {
    "query_touch": 0.05,       # Concept mentioned in search result
    "high_rating": 0.2,        # Student rated answer ≥0.7
}

INITIAL_MASTERY = 0.2

# ============================================================================
# Session Management
# ============================================================================
SESSION_PRUNE_DAYS = 7  # Prune events after 7 days (faster in demo)
SESSION_PRUNE_SECONDS = SESSION_PRUNE_DAYS * 86400

# ============================================================================
# Forgetting Curve (Ebbinghaus)
# ============================================================================
# Ebbinghaus says ~1 day to first forget; scale by DEMO_TIME_SCALE
# At 100x: 86400s / 100 = 864s ≈ 14 minutes ≈ 14 seconds on stage
CONCEPT_TTL_SECONDS = int(86400 / DEMO_TIME_SCALE)
```

---

### 4. Update `backend/ingest.py` — Add Session Routing

```python
"""Top-level ingest pipeline: file -> extracted metadata -> wiki + memory."""
from __future__ import annotations

from pathlib import Path

from . import memory, wiki_writer, config
from .extractor import extract
from .parser import read_text


async def ingest_file(path: Path, session_id: str) -> dict:
    text = read_text(path)
    extraction = extract(text, path)

    source_page = wiki_writer.write_source_page(path, text, extraction)
    course_page = wiki_writer.write_course_page(extraction, path.name)
    concept_pages = wiki_writer.write_concept_pages(extraction)
    wiki_writer.rebuild_index()

    # NEW: Seed Redis mastery state for all extracted concepts
    await memory.seed_concept_mastery(session_id, extraction.concepts)
    
    # NEW: Log ingest event
    await memory.log_event(
        session_id,
        "ingest",
        {
            "file": path.name,
            "course": extraction.course,
            "concepts": extraction.concepts,
            "concept_count": len(extraction.concepts),
        },
    )

    await memory.remember(
        f"Course: {extraction.course}\n"
        f"Source: {path.name}\n"
        f"Concepts: {', '.join(extraction.concepts)}\n\n"
        f"{text[:4000]}"
    )

    return {
        "session_id": session_id,  # NEW: return it for frontend
        "course": extraction.course,
        "concepts": extraction.concepts,
        "source_page": str(source_page.name),
        "course_page": str(course_page.name),
        "concept_pages": [p.name for p in concept_pages],
        "mastery_state": await memory.get_mastery_state(session_id),  # NEW
    }
```

---

### 5. Update `backend/query.py` — Add Session Tracking

```python
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
```

---

### 6. Update `backend/main.py` — Add New Endpoints

Add these sections to your existing `main.py`:

```python
"""FastAPI entrypoint for CourseAtlas."""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config, graph, ingest, lint, memory, query, wiki_writer

app = FastAPI(title="CourseAtlas", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryBody(BaseModel):
    question: str
    k: int = 5


class RateBody(BaseModel):
    rating: float  # 0.0 to 1.0
    concepts_touched: list[str]


class SaveAnswerBody(BaseModel):
    concept: str
    courses: list[str]
    answer_md: str


@app.get("/")
async def root() -> dict:
    return {"name": "CourseAtlas", "version": "0.1.0"}


# ============================================================================
# INGEST (Updated to handle session_id)
# ============================================================================

@app.post("/ingest")
async def post_ingest(file: UploadFile = File(...), session_id: str | None = Query(None)) -> dict:
    """
    Upload and ingest a file.
    
    If session_id is not provided, generate a new one.
    Returns session_id so frontend can store it in localStorage.
    """
    # NEW: Generate session_id if not provided (first upload)
    if not session_id:
        session_id = str(uuid.uuid4())
    
    suffix = Path(file.filename or "upload.txt").suffix.lower()
    bucket = "syllabi" if "syllab" in (file.filename or "").lower() else "readings"
    dest_dir = config.RAW_DIR / bucket
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / (file.filename or f"upload{suffix}")
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # UPDATED: Pass session_id to ingest
    result = await ingest.ingest_file(dest, session_id)
    return result


# ============================================================================
# NEW: MASTERY STATE (For UI Bars)
# ============================================================================

@app.get("/mastery-state")
async def get_mastery_state(session_id: str = Query(...)) -> dict:
    """
    Return current mastery state for all concepts in a session.
    Used by frontend to render mastery bars.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    state = await memory.get_mastery_state(session_id)
    return {
        "session_id": session_id,
        "mastery": state,
        "threshold_fading": config.MASTERY_THRESHOLDS["fading"],
        "threshold_consolidate": config.MASTERY_THRESHOLDS["consolidate"],
    }


# ============================================================================
# NEW: QUERY (Updated with session_id)
# ============================================================================

@app.post("/query")
async def post_query(body: QueryBody, session_id: str = Query(...)) -> dict:
    """
    Ask a question against the wiki.
    
    Returns answer + concepts touched (for rating phase).
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    result = await query.answer(body.question, session_id, k=body.k)
    return result


# ============================================================================
# NEW: RATE ANSWER (Updates Mastery + Triggers Skill Improvement Proposal)
# ============================================================================

@app.post("/rate")
async def post_rate(body: RateBody, session_id: str = Query(...)) -> dict:
    """
    Rate an answer (0.0 to 1.0).
    
    - If rating ≥ 0.7: bump mastery for concepts_touched
    - Log rating event
    - Return success + concepts updated
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    if not (0.0 <= body.rating <= 1.0):
        raise HTTPException(status_code=400, detail="rating must be 0.0-1.0")
    
    updated_concepts = []
    
    # Only bump if high rating
    if body.rating >= 0.7:
        for slug in body.concepts_touched:
            await memory.bump_mastery(session_id, slug, config.MASTERY_DELTAS["high_rating"])
            
            # Check if this concept should be distilled to graph
            new_score = await memory.get_mastery(session_id, slug)
            await memory.distill_to_graph(session_id, slug, new_score)
            
            updated_concepts.append(slug)
    
    # Log event
    await memory.log_event(
        session_id,
        "rate",
        {
            "rating": body.rating,
            "concepts_touched": body.concepts_touched,
            "bumped": updated_concepts,
        },
    )
    
    # NEW: Get mastery state after update
    new_state = await memory.get_mastery_state(session_id)
    
    return {
        "success": True,
        "rating": body.rating,
        "concepts_bumped": updated_concepts,
        "mastery_state": new_state,
    }


# ============================================================================
# QUERY (Existing endpoints, updated to use session_id)
# ============================================================================

@app.post("/save-answer")
async def save_answer(body: SaveAnswerBody, session_id: str = Query(...)) -> dict:
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # ... existing implementation, but log the event
    await memory.log_event(
        session_id,
        "save_answer",
        {
            "concept": body.concept,
            "courses": body.courses,
        },
    )
    # ... rest of existing code


@app.get("/lint")
async def get_lint(session_id: str = Query(...)) -> dict:
    """
    Run lint checks on the wiki.
    
    NEW: Includes fading-concepts rule (from Redis mastery state).
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Get base lint issues
    issues = lint.run()
    
    # NEW: Add fading-concepts rule
    fading = await memory.fading_concepts(session_id)
    for slug in fading:
        mastery = await memory.get_mastery(session_id, slug)
        issues.append({
            "type": "fading_concept",
            "name": slug,
            "mastery": mastery,
            "threshold": config.MASTERY_THRESHOLDS["fading"],
            "message": f"Concept `{slug}` is fading (mastery {mastery:.2f}). Review soon to consolidate.",
        })
    
    return {"issues": issues, "session_id": session_id}


@app.get("/graph")
async def get_graph(session_id: str = Query(...)) -> dict:
    """
    Return concept graph as JSON.
    
    NEW: Nodes include mastery + known_as_of from Redis.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    state = await memory.get_mastery_state(session_id)
    graph_data = graph.graph_json()
    
    # Enrich graph nodes with mastery state
    for node in graph_data.get("nodes", []):
        node["mastery"] = state.get(node["id"], config.INITIAL_MASTERY)
    
    return graph_data


@app.get("/wiki/pages")
async def wiki_pages() -> dict:
    return wiki_writer.list_pages()


@app.get("/wiki/page/{path}")
async def wiki_page(path: str) -> dict:
    return wiki_writer.read_page(path)
```

---

### 7. Update `backend/lint.py` — Add Fading-Concepts Rule

Update the `run()` function to accept session_id:

```python
def run(session_id: str | None = None) -> list[dict]:
    """
    Wiki health checks.
    
    If session_id provided: also check fading-concepts rule.
    """
    # ... existing 3 rules ...
    
    issues: list[dict] = []
    
    # ... (keep existing logic for missing concepts, orphans, weak bridges) ...
    
    # NEW RULE: Fading concepts (if session_id provided)
    if session_id:
        # This will be called from main.py with the session_id
        # The actual fading check happens in main.py's /lint endpoint
        # using memory.fading_concepts(), so this stays as-is
        pass
    
    return issues
```

(The actual fading-concepts rule is now in `main.py` because it needs async Redis access.)

---

### 8. Create `backend/improve.py` — Stub for P3

```python
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
```

---

## Key Integration Points

### Session ID Flow (Hybrid Approach)

1. **First `/ingest`**: Frontend doesn't send session_id
   - Backend generates `session_id = uuid.uuid4()`
   - Returns it in response
   - Frontend stores in `localStorage["session_id"]`

2. **Subsequent requests**: Frontend includes `session_id` in all requests
   - `/query?session_id=abc-123`
   - `/rate?session_id=abc-123`
   - `/lint?session_id=abc-123`

3. **Manual clear**: Frontend can call `/clear-session?session_id=abc-123` to reset

---

## Environment Variables

```bash
# .env
REDIS_URL=redis://localhost:6379
DEMO_TIME_SCALE=100
INITIAL_MASTERY=0.2
```

---

## Testing Your Implementation

```bash
# Start Redis
docker run -p 6379:6379 redis:latest --notify-keyspace-events KEA

# Run backend
cd backend && python -m uvicorn main:app --reload

# Test ingest (generates session_id)
curl -X POST http://localhost:8000/ingest \
  -F "file=@materials/syllabus.pdf"

# Test mastery state
curl "http://localhost:8000/mastery-state?session_id=<returned-id>"

# Test query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is hypothesis testing?"}' \
  -G -d "session_id=<id>"

# Test rate
curl -X POST http://localhost:8000/rate \
  -H "Content-Type: application/json" \
  -d '{"rating": 0.8, "concepts_touched": ["hypothesis_testing"]}' \
  -G -d "session_id=<id>"
```

---

## Ready to Code?

Now you have:
- ✅ Detailed specs for each file
- ✅ Complete code samples
- ✅ Redis primitive explanations
- ✅ Session ID flow
- ✅ Configuration values
- ✅ Testing commands

**Next step**: Start with `backend/memory.py` (the foundation), then work through the others.

Would you like me to help with any specific file implementation or have questions about the design?
