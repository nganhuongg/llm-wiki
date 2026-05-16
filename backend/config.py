from pathlib import Path

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
