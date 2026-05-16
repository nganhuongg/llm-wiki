# CourseAtlas: A Self-Improving LLM Wiki for University Courses

## 1. Project Summary

**CourseAtlas** is a self-improving LLM wiki for students. It turns scattered course materials, such as syllabi, readings, slides, notes, and assignment guides, into a persistent, connected knowledge base that grows over time.

Instead of only retrieving raw documents at query time, CourseAtlas incrementally builds and maintains a structured wiki. Each new document updates the existing knowledge base by creating course pages, concept pages, source summaries, and cross-course concept bridges.

The project is designed for students at any university, not just one specific curriculum. A student can upload materials from multiple courses, and the system will help them understand how concepts connect across classes.

## 2. Core Problem

Students often have learning materials scattered across many places:

- Course syllabi
- Lecture slides
- Reading PDFs
- Personal notes
- Assignment instructions
- Discussion notes
- External resources

Normal document Q&A or RAG systems can answer questions from these files, but they usually do not preserve long-term structure. Every time the user asks a question, the system re-retrieves chunks from the original documents and reconstructs the answer from scratch.

This creates several problems:

- Knowledge does not accumulate.
- Cross-course connections are easy to miss.
- Useful answers disappear into chat history.
- Students do not get a maintained map of what they are learning.
- The system cannot easily detect missing concepts, weak links, or contradictions.

## 3. Proposed Solution

CourseAtlas creates a persistent course wiki that grows with every uploaded document and every useful question.

The system maintains:

- Course pages
- Concept pages
- Source summary pages
- Cross-course bridge pages
- An index
- A changelog
- A lint report

The key idea is that the wiki is not manually written by the student. The system generates and updates it automatically.

## 4. Hackathon Fit

The hackathon asks participants to build an Agent LLM Wiki with three base operations:

1. **Ingest**
2. **Query + Self-improve**
3. **Lint**

CourseAtlas directly implements all three.

The project is not a generic chatbot. It is a persistent memory system for learning. The chatbot interface is only one way to interact with the wiki; the real product is the evolving knowledge base.

## 5. Main User

The main user is a university student taking multiple courses at the same time.

Example users:

- A first-year student trying to understand how foundational concepts connect across courses
- A biology student taking biology, chemistry, statistics, and writing
- A social science student taking psychology, statistics, sociology, and research methods
- An engineering student taking physics, calculus, programming, and design

## 6. Example Use Case

A student uploads materials from three courses:

- Introduction to Psychology
- Statistics 101
- Academic Writing

The system builds pages such as:

- `courses/intro_to_psychology.md`
- `courses/statistics_101.md`
- `courses/academic_writing.md`
- `concepts/correlation.md`
- `concepts/evidence.md`
- `concepts/hypothesis_testing.md`
- `bridges/evidence_across_psychology_statistics_writing.md`

The student asks:

> How does evidence mean different things in psychology, statistics, and writing?

The system retrieves the relevant wiki pages, generates an answer, and saves the answer as a new bridge page.

## 7. Core Features

### 7.1 Document Ingestion

Students upload course materials.

Supported inputs for the MVP:

- PDF syllabi
- Text notes
- Markdown files
- Assignment instructions

The ingestion system extracts:

- Course name
- Course description
- Units or weeks
- Topics
- Concepts
- Learning objectives
- Assignments
- Readings
- Important terms

The extracted information is added to the persistent wiki.

### 7.2 Living Wiki Generation

The system creates and updates markdown files.

Example structure:

```text
wiki/
  courses/
    intro_to_psychology.md
    statistics_101.md
    academic_writing.md

  concepts/
    evidence.md
    correlation.md
    hypothesis_testing.md
    cognitive_bias.md

  sources/
    psychology_syllabus.md
    statistics_week_1_reading.md
    writing_assignment_guide.md

  bridges/
    evidence_across_psychology_statistics_writing.md
    correlation_across_psychology_and_statistics.md

  index.md
  changelog.md
  lint_report.md
```

### 7.3 Query the Wiki

The student can ask questions against the accumulated wiki.

Example questions:

- How does correlation in statistics relate to research methods in psychology?
- What concepts do I need to understand before hypothesis testing?
- Which assignments require evidence-based reasoning?
- How does the concept of bias appear across psychology, statistics, and writing?

The system retrieves relevant wiki pages and generates an answer using the accumulated knowledge base.

### 7.4 Query + Self-Improve

A key feature is that good answers can be saved back into the wiki.

For example, if the student asks:

> Compare how evidence is used in biology, statistics, and writing.

The system can generate and save:

```text
bridges/evidence_across_biology_statistics_writing.md
```

This makes the wiki compound over time. The next time the student asks about evidence, the system does not need to reconstruct everything from raw documents.

### 7.5 Lint the Wiki

The lint operation checks the health of the knowledge base.

It detects:

- Concepts mentioned often but missing their own page
- Orphan pages with no inbound or outbound links
- Duplicate concept pages
- Course pages with missing assignment links
- Concepts appearing in multiple courses but missing bridge pages
- Weak prerequisite links
- Possible contradictions between pages
- Sources that were ingested but not linked to any concept

Example lint output:

```text
Lint Report

1. Missing concept page: "correlation vs causation"
   Mentioned in psychology_syllabus.md and statistics_week_2.md.

2. Weak bridge: "evidence"
   Appears in Biology, Statistics, and Writing, but no bridge page exists.

3. Orphan page: "week_1_notes.md"
   This page has no links to course or concept pages.

4. Possible duplicate:
   "hypothesis_testing.md" and "testing_hypotheses.md" may describe the same concept.
```

## 8. Most Creative Feature: Concept Bridge Generator

The Concept Bridge Generator explains how the same concept appears across multiple courses.

Example input:

```text
Concept: evidence
Courses: Statistics, Biology, Writing
```

Example output:

```text
# Evidence Across Statistics, Biology, and Writing

## Statistics
Evidence usually means data patterns, uncertainty, confidence intervals, p-values, or model-based inference.

## Biology
Evidence usually means experimental observations, mechanisms, measurements, and reproducible findings.

## Writing
Evidence usually means information selected and structured to support a thesis for a specific audience.

## Cross-Course Connection
Across these courses, evidence is not just "facts." It is information used to justify a claim under the standards of a specific discipline.

## Study Insight
To use evidence well, the student must ask:

1. What claim am I supporting?
2. What kind of evidence counts in this field?
3. How strong is the evidence?
4. What assumptions connect the evidence to the claim?
```

This is the main “wow moment” of the demo.

## 9. Why This Is More Than a Chatbot

A normal chatbot answers one question at a time.

CourseAtlas maintains a growing knowledge structure.

The difference:

| Normal Chatbot / RAG | CourseAtlas |
|---|---|
| Retrieves chunks from raw documents | Maintains a persistent wiki |
| Answers disappear into chat history | Useful answers become wiki pages |
| No long-term structure | Course, concept, source, and bridge pages |
| Weak cross-document memory | Cross-course concept graph |
| No health check | Lint detects missing links and gaps |

## 10. MVP Scope

For the hackathon, do not build a full production system.

Build a small but clear working demo.

### MVP Inputs

- 2 to 4 course syllabi
- 1 to 2 extra readings or notes

### MVP Outputs

- Generated course pages
- Generated concept pages
- Generated bridge page
- Search/query answer
- Lint report

### MVP Demo Flow

```text
1. Upload 2–4 course materials.
2. Click “Build Wiki.”
3. Show generated course pages and concept pages.
4. Ask a cross-course question.
5. Save the answer as a bridge page.
6. Run lint.
7. Show missing concepts, weak links, or suggested bridge pages.
```

## 11. Suggested Tech Stack

### Backend

- Python
- FastAPI
- Markdown file storage
- JSON metadata
- Optional: Cognee if API access is available

### Search

Start simple:

- Keyword search
- BM25
- Fuzzy matching

Optional upgrade:

- Embeddings
- Vector search
- Cognee memory engine

### Graph

- NetworkX for concept graph

### Frontend

- React
- Tailwind CSS
- Simple upload page
- Wiki viewer
- Query box
- Graph view
- Lint report panel

## 12. File and Folder Structure

```text
courseatlas/
  backend/
    main.py
    ingest.py
    parser.py
    extractor.py
    wiki_writer.py
    search.py
    query.py
    lint.py
    graph.py

  frontend/
    src/
      App.jsx
      components/
        UploadPanel.jsx
        WikiViewer.jsx
        QueryBox.jsx
        GraphView.jsx
        LintReport.jsx

  raw_materials/
    syllabi/
    readings/
    notes/

  wiki/
    courses/
    concepts/
    sources/
    bridges/
    index.md
    changelog.md
    lint_report.md

  metadata/
    courses.json
    concepts.json
    graph.json
    source_log.json
```

## 13. Backend Modules

### `ingest.py`

Responsible for processing uploaded files.

Tasks:

- Read file text
- Identify source type
- Extract metadata
- Send extracted data to wiki writer

### `extractor.py`

Responsible for extracting concepts.

For MVP, this can use rules:

- Hashtags
- Headings
- Repeated capitalized terms
- Known concept lists
- Assignment keywords

Optional LLM upgrade:

- Extract concepts with an LLM
- Generate summaries
- Identify prerequisite relationships

### `wiki_writer.py`

Responsible for creating and updating markdown pages.

Tasks:

- Create course pages
- Create concept pages
- Create source summary pages
- Update index
- Update changelog

### `search.py`

Responsible for finding relevant wiki pages.

MVP approach:

- BM25 or keyword matching over markdown files

### `query.py`

Responsible for answering questions from the wiki.

MVP approach:

- Retrieve relevant pages
- Generate a structured answer from snippets
- Optionally save answer as a bridge page

### `lint.py`

Responsible for checking wiki health.

Rules:

- Concept mentioned multiple times but no page exists
- Page has no links
- Concept appears in multiple courses but no bridge exists
- Source not linked to any concept

### `graph.py`

Responsible for concept graph generation.

Nodes:

- Courses
- Concepts
- Sources
- Bridge pages

Edges:

- Course contains concept
- Source mentions concept
- Concept relates to concept
- Bridge connects concept across courses

## 14. Team Split for Two People

### Person 1: Backend and Memory Engine

Responsibilities:

- File ingestion
- Text parsing
- Concept extraction
- Wiki generation
- Search/query logic
- Lint logic
- Backend API endpoints

Suggested priority:

1. Ingest
2. Wiki generation
3. Search/query
4. Lint

### Person 2: Frontend and Demo Experience

Responsibilities:

- Upload UI
- Wiki page viewer
- Query interface
- Lint report display
- Graph visualization
- Demo script
- Final pitch

Suggested priority:

1. Simple upload page
2. Generated wiki viewer
3. Query box
4. Lint panel
5. Graph view if time allows

## 15. API Endpoints

Example FastAPI endpoints:

```text
POST /ingest
Upload and process a document.

GET /wiki/pages
List generated wiki pages.

GET /wiki/page/{path}
Read a wiki page.

POST /query
Ask a question against the wiki.

POST /save-answer
Save a useful answer as a wiki page.

GET /lint
Run lint and return the lint report.

GET /graph
Return the concept graph as JSON.
```

## 16. Optional Cognee Integration

Cognee can be used as the memory backend if API access is available.

However, Cognee is not strictly required for the MVP.

Without Cognee, CourseAtlas can still demonstrate the core idea using:

- Markdown files
- JSON metadata
- Keyword search
- Graph relationships
- Rule-based linting

If Cognee is available, use it for:

- Concept extraction
- Semantic retrieval
- Memory storage
- Cross-document synthesis
- Self-improvement suggestions

Recommended strategy:

Build the local markdown-based system first. Then make Cognee an optional upgrade layer.

## 17. Demo Script

### Opening

Course materials are scattered across PDFs, notes, assignments, and readings. Existing RAG tools can answer questions, but they usually do not build lasting structure. CourseAtlas turns course materials into a persistent, self-improving wiki.

### Step 1: Ingest

Upload syllabi or course notes.

Show that the system extracts:

- Courses
- Topics
- Concepts
- Assignments
- Readings

### Step 2: Wiki Generation

Show generated pages:

- Course page
- Concept page
- Source page
- Index

### Step 3: Query

Ask:

> How does evidence connect across statistics, biology, and writing?

Show answer generated from the wiki.

### Step 4: Self-Improve

Click “Save as Bridge Page.”

Show new page:

```text
bridges/evidence_across_statistics_biology_writing.md
```

### Step 5: Lint

Run lint.

Show suggestions:

- Missing concept page
- Weak bridge
- Orphan page
- Duplicate concept

### Closing

CourseAtlas is not just a chatbot. It is a persistent memory layer for learning. It helps students build a living map of their courses that becomes more useful over time.

## 18. Final Pitch

> CourseAtlas is a self-improving LLM wiki for students. It turns scattered course materials into a persistent, connected knowledge base that grows with every document and every question. Instead of re-reading raw files for every answer, it maintains course pages, concept pages, cross-course bridges, and lint reports over time.

## 19. One-Sentence Version

> CourseAtlas helps students turn course materials into a living wiki that explains concepts, connects ideas across courses, and improves itself over time.

## 20. What Not to Build

Avoid overbuilding.

Do not focus on:

- Training a new LLM
- Building a full agent framework
- Multi-agent systems
- Complex authentication
- Production-scale databases
- Perfect UI
- Perfect PDF parsing

For the hackathon, the important thing is a clear working memory loop:

```text
Ingest → Build Wiki → Query → Save New Knowledge → Lint
```

## 21. Success Criteria

The demo is successful if it clearly shows:

- Raw course materials become structured wiki pages.
- The wiki persists after ingestion.
- The system can answer from the wiki.
- A useful answer can be saved back into the wiki.
- The lint system can detect gaps or weak links.

The key message is:

> Knowledge should compound over time instead of being re-derived from scratch every time a student asks a question.
