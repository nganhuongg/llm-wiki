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
# Redis & Demo Configuration
# ============================================================================
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# P2 HACKATHON FIX: 100x → 6000x so 1 real day ≈ 14.4 demo seconds
DEMO_TIME_SCALE = int(os.getenv("DEMO_TIME_SCALE", "6000"))

# P2 HACKATHON FIX: Prevents 0 or negative TTL during demo scaling
CONCEPT_TTL_SECONDS = max(10, int(86400 / DEMO_TIME_SCALE))

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
# Session & Decay Configuration
# ============================================================================
SESSION_PRUNE_DAYS = 7
SESSION_PRUNE_SECONDS = SESSION_PRUNE_DAYS * 86400

# P2 HACKATHON FIX: Auto-decay parameters
DECAY_DELTA = -0.02
DECAY_CHECK_INTERVAL_SECONDS = 2