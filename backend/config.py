from pathlib import Path
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# ============================================================================
# Paths
# ============================================================================
ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "assets"
WIKI_DIR = ROOT / "wiki"
RAW_DIR = ROOT / "raw_materials"
META_DIR = ROOT / "metadata"
SKILLS_DIR = ROOT / "my_skills"

COURSES_DIR = WIKI_DIR / "courses"
CONCEPTS_DIR = WIKI_DIR / "concepts"
SOURCES_DIR = WIKI_DIR / "sources"
BRIDGES_DIR = WIKI_DIR / "bridges"
STUDENT_DIR = WIKI_DIR / "student"
STUDY_GUIDES_DIR = WIKI_DIR / "study_guides"

INDEX_PATH = WIKI_DIR / "index.md"
CHANGELOG_PATH = WIKI_DIR / "changelog.md"
LINT_REPORT_PATH = WIKI_DIR / "lint_report.md"

COURSES_JSON = META_DIR / "courses.json"
CONCEPTS_JSON = META_DIR / "concepts.json"
GRAPH_JSON = META_DIR / "graph.json"
SOURCE_LOG_JSON = META_DIR / "source_log.json"
STUDENT_PROFILE_JSON = META_DIR / "student_profile.json"

# ============================================================================
# Redis / Session
# ============================================================================
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DEFAULT_SESSION_ID = os.getenv("DEFAULT_SESSION_ID", "demo")
DEMO_TIME_SCALE = max(float(os.getenv("DEMO_TIME_SCALE", "100")), 1.0)

# ============================================================================
# Mastery & Learning
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
DECAY_THRESHOLD = float(os.getenv("DECAY_THRESHOLD", "0.4"))

# ============================================================================
# Forgetting curve (Ebbinghaus) — scaled by DEMO_TIME_SCALE
# ============================================================================
# Real-world ~1 day to first forget. At 100x scale: 86400s/100 ≈ 14 minutes.
DECAY_BASE_SECONDS = int(os.getenv("DECAY_BASE_SECONDS", str(24 * 60 * 60)))
DECAY_TTL_SECONDS = max(int(DECAY_BASE_SECONDS / DEMO_TIME_SCALE), 5)
CONCEPT_TTL_SECONDS = int(86400 / DEMO_TIME_SCALE)

SESSION_PRUNE_DAYS = 7
SESSION_PRUNE_SECONDS = SESSION_PRUNE_DAYS * 86400

# ============================================================================
# Cognee / LLM
# ============================================================================
COGNEE_TIMEOUT_SECONDS = float(os.getenv("COGNEE_TIMEOUT_SECONDS", "8"))
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
LLM_API_KEY = (
    os.getenv("LLM_API_KEY")
    or os.getenv("OPENAI_API_KEY")
    or os.getenv("ANTHROPIC_API_KEY")
    or ""
)
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "20"))

# ============================================================================
# Ensure directories exist
# ============================================================================
for d in (
    ASSETS_DIR,
    WIKI_DIR,
    RAW_DIR,
    META_DIR,
    SKILLS_DIR,
    COURSES_DIR,
    CONCEPTS_DIR,
    SOURCES_DIR,
    BRIDGES_DIR,
    STUDENT_DIR,
    STUDY_GUIDES_DIR,
):
    d.mkdir(parents=True, exist_ok=True)
