# StudyAtlas: A Personalized LLM Wiki for Students

## 1. Project Summary

**StudyAtlas** is a personalized LLM wiki for students. It turns scattered course materials, personal notes, and study activity into a persistent knowledge base that is tailored to each student.

Instead of only answering questions from uploaded files, StudyAtlas builds and maintains a structured wiki that reflects:

- what the student is learning
- how concepts connect across courses
- which topics the student struggles with
- what study context matters right now
- which explanations and summaries were useful before

The result is not just a course document viewer. It is a learning memory system that becomes more useful over time for one specific student.

## 2. Core Problem

Students usually manage learning across many disconnected places:

- course syllabi
- lecture slides
- reading PDFs
- assignment instructions
- class notes
- personal study notes
- office hour notes
- saved chat answers

Normal RAG or document Q&A tools can answer questions from these files, but they usually do not preserve long-term structure or student-specific context.

This creates several problems:

- knowledge does not accumulate
- answers disappear into chat history
- the system does not remember what this student already knows
- the system cannot adapt explanations to the student's courses or weak areas
- cross-course connections are easy to miss
- there is no maintained map of the student's learning progress

## 3. Proposed Solution

StudyAtlas creates a persistent, personalized student wiki that grows with every upload and every useful interaction.

The system maintains:

- course pages
- concept pages
- source summary pages
- student profile pages
- study guide pages
- cross-course bridge pages
- an index
- a changelog
- a lint report

The core idea is that the wiki is not manually maintained. The system generates and updates it automatically, using both course content and student context.

## 4. Hackathon Fit

The hackathon asks participants to build an Agent LLM Wiki with three base operations:

1. **Ingest**
2. **Query + Self-improve**
3. **Lint**

StudyAtlas directly implements all three.

It remains hackathon-fit because the MVP is still a clear memory loop:

```text
Ingest -> Build Wiki -> Query -> Save New Knowledge -> Lint
```

The personalization layer does not make the system bigger than necessary. It simply changes what the wiki stores and how answers are shaped.

## 5. Main User

The main user is a university student taking multiple courses and wanting a study assistant that remembers their own context.

Example users:

- a first-year student trying to connect ideas across classes
- a pre-med student balancing biology, chemistry, and statistics
- a humanities student juggling writing-heavy courses with research methods
- an engineering student reviewing prerequisites across math, physics, and programming

## 6. Example Use Case

A student uploads materials from three courses:

- Introduction to Psychology
- Statistics 101
- Academic Writing

They also add:

- their own lecture notes
- a short statement of study goals
- a list of concepts they find confusing

The system builds pages such as:

- `courses/intro_to_psychology.md`
- `courses/statistics_101.md`
- `courses/academic_writing.md`
- `concepts/correlation.md`
- `concepts/evidence.md`
- `student/profile.md`
- `student/confusing_topics.md`
- `study_guides/evidence_for_this_student.md`
- `bridges/evidence_across_psychology_statistics_writing.md`

The student asks:

> Explain evidence in a way that helps me compare psychology, statistics, and writing, and focus on where I usually get confused.

The system retrieves the relevant wiki pages, generates an answer, and saves the result as a personalized study guide or bridge page.

## 7. Core Features

### 7.1 Document and Context Ingestion

Students upload course materials and optionally add personal context.

Supported MVP inputs:

- PDF syllabi
- text notes
- markdown files
- assignment instructions
- short student profile text
- short list of weak topics or study goals

The ingestion system extracts:

- course name
- course description
- units or weeks
- topics
- concepts
- learning objectives
- assignments
- readings
- important terms
- student goals
- confusing topics
- preferred examples or study focus

This information is added to the persistent wiki.

### 7.2 Personalized Living Wiki Generation

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

  sources/
    psychology_syllabus.md
    statistics_week_1_reading.md
    writing_assignment_guide.md

  student/
    profile.md
    goals.md
    confusing_topics.md

  study_guides/
    evidence_for_this_student.md
    hypothesis_testing_review.md

  bridges/
    evidence_across_psychology_statistics_writing.md

  index.md
  changelog.md
  lint_report.md
```

### 7.3 Query the Wiki

The student can ask questions against the accumulated wiki.

Example questions:

- How does correlation in statistics relate to research methods in psychology?
- What do I need to understand before hypothesis testing?
- Which assignments require evidence-based reasoning?
- Explain bias using examples from my current courses.
- Which topics should I review first based on what I said I find confusing?

The system retrieves relevant wiki pages and generates answers using the accumulated knowledge base plus the student's stored context.

### 7.4 Query + Self-Improve

A key feature is that useful answers can be saved back into the wiki.

For example, if the student asks:

> Compare how evidence is used in biology, statistics, and writing for someone who struggles with claims versus data.

The system can generate and save:

```text
study_guides/evidence_claims_vs_data.md
```

or

```text
bridges/evidence_across_biology_statistics_writing.md
```

This makes the wiki compound over time. The next time the student asks a related question, the system can build from the saved explanation instead of reconstructing everything from raw documents.

### 7.5 Lint the Wiki

The lint operation checks the health of the knowledge base and the personalization layer.

It detects:

- concepts mentioned often but missing their own page
- orphan pages with no inbound or outbound links
- duplicate concept pages
- course pages with missing assignment links
- concepts appearing in multiple courses but missing bridge pages
- weak prerequisite links
- possible contradictions between pages
- sources that were ingested but not linked to any concept
- student weak-topic pages with no linked study guide
- repeated question themes that should become a saved guide

Example lint output:

```text
Lint Report

1. Missing concept page: "correlation vs causation"
   Mentioned in psychology_syllabus.md and statistics_week_2.md.

2. Weak bridge: "evidence"
   Appears in Psychology, Statistics, and Writing, but no bridge page exists.

3. Missing personalized guide: "hypothesis testing"
   Marked as a confusing topic in student/confusing_topics.md but no study guide exists.

4. Orphan page: "week_1_notes.md"
   This page has no links to course or concept pages.
```

## 8. Most Creative Feature: Personalized Concept Bridge Generator

The Personalized Concept Bridge Generator explains how the same concept appears across multiple courses, but adapted to one student's learning needs.

Example input:

```text
Concept: evidence
Courses: Statistics, Biology, Writing
Student difficulty: separating claims, data, and interpretation
```

Example output:

```text
# Evidence Across Statistics, Biology, and Writing

## What This Student Keeps Mixing Up
The student often blends together raw data, interpretation, and argument.

## Statistics
Evidence often means data patterns, uncertainty, confidence intervals, and inference.

## Biology
Evidence often means experimental observations, mechanisms, measurements, and reproducible findings.

## Writing
Evidence often means information selected and structured to support a thesis for an audience.

## Cross-Course Connection
Across these courses, evidence is not just "facts." It is information used to justify a claim under the standards of a specific discipline.

## Personalized Study Insight
Before using evidence, ask:
1. What is the claim?
2. What counts as evidence in this course?
3. Am I describing data, interpreting it, or arguing from it?
4. What assumption connects the evidence to the claim?
```

This is the main demo moment because it shows memory, synthesis, and personalization in one step.

## 9. Why This Is More Than a Chatbot

A normal chatbot answers one question at a time.

StudyAtlas maintains a growing, personalized knowledge structure.

| Normal Chatbot / RAG | StudyAtlas |
|---|---|
| Retrieves chunks from raw documents | Maintains a persistent student wiki |
| Answers disappear into chat history | Useful answers become wiki pages |
| No student memory | Stores goals, weak areas, and saved guides |
| Weak cross-document memory | Builds cross-course concept bridges |
| No health check | Lint detects gaps, missing links, and missing guides |

## 10. MVP Scope

For the hackathon, do not build a full academic platform.

Build a small, clear, working demo.

### MVP Inputs

- 2 to 4 course syllabi
- 1 to 2 extra readings or notes
- 1 short student profile or weak-topics note

### MVP Outputs

- generated course pages
- generated concept pages
- generated student profile page
- generated personalized study guide or bridge page
- search/query answer
- lint report

### MVP Demo Flow

```text
1. Upload 2-4 course materials.
2. Add a short student context note.
3. Click "Build Wiki."
4. Show generated course pages, concept pages, and student profile page.
5. Ask a personalized cross-course question.
6. Save the answer as a study guide or bridge page.
7. Run lint.
8. Show missing concepts, weak links, or suggested personalized guides.
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

- keyword search
- BM25
- fuzzy matching

Optional upgrade:

- embeddings
- vector search
- Cognee memory engine

### Graph

- NetworkX for concept graph

### Frontend

- React
- Tailwind CSS
- simple upload page
- wiki viewer
- query box
- graph view
- lint report panel

## 12. File and Folder Structure

```text
studyatlas/
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
    student_context/

  wiki/
    courses/
    concepts/
    sources/
    student/
    study_guides/
    bridges/
    index.md
    changelog.md
    lint_report.md

  metadata/
    courses.json
    concepts.json
    graph.json
    source_log.json
    student_profile.json
```

## 13. Backend Modules

### `ingest.py`

Responsible for processing uploaded files and student context.

Tasks:

- read file text
- identify source type
- extract metadata
- capture student profile notes
- send extracted data to wiki writer

### `extractor.py`

Responsible for extracting concepts and lightweight personalization signals.

For MVP, this can use rules:

- headings
- repeated terms
- known concept lists
- assignment keywords
- simple labels from student notes such as weak topics or goals

Optional LLM upgrade:

- extract concepts with an LLM
- generate summaries
- identify prerequisite relationships
- generate tailored explanations

### `wiki_writer.py`

Responsible for creating and updating markdown pages.

Tasks:

- create course pages
- create concept pages
- create source summary pages
- create student profile pages
- create study guide pages
- update index
- update changelog

### `search.py`

Responsible for finding relevant wiki pages.

MVP approach:

- BM25 or keyword matching over markdown files

### `query.py`

Responsible for answering questions from the wiki.

MVP approach:

- retrieve relevant pages
- include student profile context if available
- generate a structured answer from snippets
- optionally save answer as a bridge page or study guide

### `lint.py`

Responsible for checking wiki health.

Rules:

- concept mentioned multiple times but no page exists
- page has no links
- concept appears in multiple courses but no bridge exists
- source not linked to any concept
- student weak topic has no linked study guide

### `graph.py`

Responsible for concept graph generation.

Nodes:

- courses
- concepts
- sources
- student topics
- study guides
- bridge pages

Edges:

- course contains concept
- source mentions concept
- concept relates to concept
- bridge connects concept across courses
- study guide targets concept
- student profile marks topic as important

## 14. Team Split for Two People

### Person 1: Backend and Memory Engine

Responsibilities:

- file ingestion
- text parsing
- concept extraction
- student context extraction
- wiki generation
- search/query logic
- lint logic
- backend API endpoints

Suggested priority:

1. ingest
2. wiki generation
3. search/query
4. lint

### Person 2: Frontend and Demo Experience

Responsibilities:

- upload UI
- student context input box
- wiki page viewer
- query interface
- lint report display
- graph visualization
- demo script
- final pitch

Suggested priority:

1. simple upload page
2. student context input
3. generated wiki viewer
4. query box
5. lint panel
6. graph view if time allows

## 15. API Endpoints

Example FastAPI endpoints:

```text
POST /ingest
Upload and process documents.

POST /student-context
Save short student profile, goals, or confusing topics.

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

Without Cognee, StudyAtlas can still demonstrate the core idea using:

- markdown files
- JSON metadata
- keyword search
- graph relationships
- rule-based linting

If Cognee is available, use it for:

- concept extraction
- semantic retrieval
- memory storage
- cross-document synthesis
- self-improvement suggestions
- personalized study guidance

Recommended strategy:

Build the local markdown-based system first. Then make Cognee an optional upgrade layer.

## 17. Demo Script

### Opening

Students have course materials everywhere, but they also have personal study context that normal RAG tools forget. StudyAtlas turns both course content and student context into a persistent, personalized wiki.

### Step 1: Ingest

Upload syllabi or course notes.

Add a short student note such as:

> I struggle with hypothesis testing and often confuse claims, evidence, and interpretation.

Show that the system extracts:

- courses
- topics
- concepts
- assignments
- readings
- student weak areas

### Step 2: Wiki Generation

Show generated pages:

- course page
- concept page
- student profile page
- index

### Step 3: Query

Ask:

> Explain how evidence connects across statistics, biology, and writing for a student who struggles with claims versus data.

Show answer generated from the wiki.

### Step 4: Self-Improve

Click "Save as Study Guide."

Show new page:

```text
study_guides/evidence_claims_vs_data.md
```

### Step 5: Lint

Run lint.

Show suggestions:

- missing concept page
- weak bridge
- missing study guide for a weak topic
- orphan page

### Closing

StudyAtlas is not just a chatbot. It is a persistent learning memory system that adapts to a student's own courses and confusion points, and becomes more useful over time.

## 18. Final Pitch

> StudyAtlas is a personalized LLM wiki for students. It turns scattered course materials and student study context into a persistent knowledge base that grows with every document and every question. Instead of re-reading raw files every time, it maintains course pages, concept pages, personalized study guides, cross-course bridges, and lint reports over time.

## 19. One-Sentence Version

> StudyAtlas helps students turn course materials and personal study context into a living wiki that explains concepts, connects ideas across courses, and improves itself over time.

## 20. What Not to Build

Avoid overbuilding.

Do not focus on:

- training a new LLM
- building a full agent framework
- multi-agent systems
- complex authentication
- production-scale databases
- perfect UI
- perfect PDF parsing
- detailed learning analytics dashboards

For the hackathon, the important thing is a clear working memory loop:

```text
Ingest -> Build Wiki -> Query -> Save New Knowledge -> Lint
```

## 21. Success Criteria

The demo is successful if it clearly shows:

- raw course materials become structured wiki pages
- the wiki persists after ingestion
- the system stores student-specific context
- the system can answer from the wiki with personalization
- a useful answer can be saved back into the wiki
- the lint system can detect gaps, weak links, or missing personalized guides

The key message is:

> Knowledge should compound over time, and it should compound in a way that is useful to the specific student asking for help.
