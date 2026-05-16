from pathlib import Path
import os

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

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DEMO_TIME_SCALE = max(float(os.getenv("DEMO_TIME_SCALE", "100")), 1.0)
DEFAULT_SESSION_ID = os.getenv("DEFAULT_SESSION_ID", "demo")
DECAY_THRESHOLD = float(os.getenv("DECAY_THRESHOLD", "0.4"))
DECAY_BASE_SECONDS = int(os.getenv("DECAY_BASE_SECONDS", str(24 * 60 * 60)))
DECAY_TTL_SECONDS = max(int(DECAY_BASE_SECONDS / DEMO_TIME_SCALE), 5)
COGNEE_TIMEOUT_SECONDS = float(os.getenv("COGNEE_TIMEOUT_SECONDS", "8"))

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
