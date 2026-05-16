import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const API = 'http://localhost:8000'

const FOLDER_ICONS = {
  courses:      '🎓',
  concepts:     '💡',
  sources:      '📑',
  student:      '👤',
  study_guides: '📋',
  bridges:      '🌉',
}

// ── Demo pages shown before the backend is ready ─────────────────────────────
const MOCK_PAGES = [
  {
    path:  'courses/ea51_empirical_analyses.md',
    title: 'EA51 Empirical Analyses',
    content: `# EA51 — Empirical Analyses

**Description:** This course teaches students how science communicates evidence. Topics span research design, case study methodology, plausibility reasoning, hypothesis development, and evidence-based argument.

## Units
- Unit 1: Research Design
- Unit 2: Evidence and Argument
- Unit 3: Case Studies and Plausibility
- Unit 4: Hypothesis Development

## Key Concepts
[[case_study]] · [[evidence_based_argument]] · [[hypothesis_development]] · [[plausibility]] · [[research_design]]

## Readings
- EA51 Syllabus
- Science of Science Communication
- Research Design
- Zika Microcephaly Case Study
- Evidence-Based Argument
- Hypothesis Development
- Plausibility`,
  },
  {
    path:  'sources/ea51_syllabus.md',
    title: 'EA51 Syllabus',
    content: `# Source: EA51 Syllabus

**File:** ea51-syllabus.pdf

## Summary
The EA51 syllabus outlines a course on empirical analysis and science communication. Students learn to evaluate evidence, construct arguments, and assess the plausibility of scientific claims across multiple disciplines.

## Topics Covered
- Evidence-based reasoning
- Research design and methodology
- Case study analysis
- Hypothesis testing and development
- Scientific plausibility

## Concepts Extracted
[[evidence_based_argument]] · [[research_design]] · [[case_study]] · [[hypothesis_development]] · [[plausibility]]`,
  },
  {
    path:  'sources/zika_microcephaly_case_study.md',
    title: 'Zika Microcephaly Case Study',
    content: `# Source: Zika Microcephaly Case Study

**File:** casestudy.pdf

## Summary
This reading examines the 2015–2016 Zika virus outbreak and its suspected link to microcephaly in newborns. It serves as a model case study demonstrating how scientists build evidence-based arguments under uncertainty, assess plausibility of causal claims, and develop testable hypotheses.

## Key Ideas
- The Zika–microcephaly link was initially correlational
- Researchers used multiple evidence types: epidemiological, laboratory, and mechanistic
- Plausibility arguments were central before causal proof was established
- The case illustrates the difference between association and causation

## Concepts
[[case_study]] · [[evidence_based_argument]] · [[plausibility]] · [[hypothesis_development]]`,
  },
  {
    path:  'sources/science_of_science_communication.md',
    title: 'Science of Science Communication',
    content: `# Source: Science of Science Communication

**File:** EA51 - Science of Science Communication (1).pdf

## Summary
This reading explores how scientific findings are communicated to different audiences. It examines the gap between scientific evidence and public understanding, and introduces frameworks for presenting complex research clearly and accurately.

## Key Ideas
- Science communication requires translating technical evidence for non-specialist audiences
- Framing affects how evidence is interpreted
- Argument structure matters as much as data quality

## Concepts
[[evidence_based_argument]] · [[research_design]]`,
  },
  {
    path:  'sources/japanese_vocabulary_research_design.md',
    title: 'Japanese Vocabulary Research Design',
    content: `# Source: Research Design — Japanese Vocabulary Study

**File:** Research Design.pdf

## Summary
A worked example of experimental research design using a study on Japanese vocabulary acquisition. Illustrates control groups, randomization, hypothesis formation, and statistical inference.

## Key Ideas
- Experimental vs observational research design
- The role of a null hypothesis
- Controlling for confounders
- Interpreting p-values and effect sizes

## Concepts
[[research_design]] · [[hypothesis_development]]`,
  },
  {
    path:  'concepts/case_study.md',
    title: 'Case Study',
    content: `# Case Study

A **case study** is an in-depth examination of a single instance, event, or phenomenon to understand broader principles.

## Definition
In empirical research, a case study provides rich, contextual evidence about a specific situation. It is not designed to produce statistical generalizations but to generate theoretical insight.

## Why the Zika Reading Is a Case Study
The Zika–microcephaly example is a case study because:
1. It examines one specific outbreak in depth
2. Evidence is gathered across multiple sources (lab, field, clinical)
3. The goal is to establish a causal mechanism, not to generalize a population statistic

## Connection to Other Concepts
- A case study builds an **evidence-based argument** by combining multiple evidence types
- The central claim must pass **plausibility** criteria before causal claims are made
- Researchers must develop and test **hypotheses** throughout the investigation

## Related
[[evidence_based_argument]] · [[plausibility]] · [[hypothesis_development]] · [[research_design]]`,
  },
  {
    path:  'concepts/evidence_based_argument.md',
    title: 'Evidence-Based Argument',
    content: `# Evidence-Based Argument

An **evidence-based argument** is a claim supported by systematically gathered evidence, with explicit reasoning connecting the evidence to the conclusion.

## Structure
1. **Claim** — the central assertion
2. **Evidence** — data, observations, or findings that support the claim
3. **Reasoning** — the logical link between evidence and claim
4. **Acknowledgment of counterevidence**

## In the EA51 Context
Across the course readings, evidence-based argument appears in different disciplinary forms:
- In *statistics*: evidence = data patterns and significance tests
- In *biology/medicine*: evidence = experimental and epidemiological findings
- In *science communication*: evidence = findings presented to a non-specialist audience

## Common Student Confusion
Mixing up **data** (raw observation), **evidence** (data used to support a claim), and **interpretation** (meaning inferred from evidence).

## Related
[[case_study]] · [[plausibility]] · [[hypothesis_development]]`,
  },
  {
    path:  'concepts/hypothesis_development.md',
    title: 'Hypothesis Development',
    content: `# Hypothesis Development

A **hypothesis** is a testable, falsifiable statement about a relationship between variables, derived from prior evidence and theory.

## Steps in Hypothesis Development
1. Identify the phenomenon of interest
2. Review existing evidence
3. Formulate a specific, testable claim (H₁) and a null (H₀)
4. Design a study to test it
5. Revise based on results

## In the EA51 Readings
- The Zika case shows how early epidemiological observations led to the hypothesis that Zika causes microcephaly
- The Japanese vocabulary study illustrates hypothesis testing in an experimental design

## Related
[[evidence_based_argument]] · [[research_design]] · [[plausibility]]`,
  },
  {
    path:  'concepts/plausibility.md',
    title: 'Plausibility',
    content: `# Plausibility

**Plausibility** is the degree to which a claim is consistent with existing knowledge, mechanisms, and prior evidence — before definitive proof is available.

## Why It Matters
In early-stage research, full proof is often unavailable. Scientists assess whether a hypothesis is *plausible enough* to warrant further investigation. Plausibility is not proof; it is a stepping stone.

## Bradford Hill Criteria (related)
One framework for assessing causal plausibility includes:
- Strength of association
- Consistency
- Specificity
- Temporal sequence
- Biological plausibility (mechanism)
- Coherence with existing knowledge

## In the Zika Case
Before laboratory confirmation, researchers argued that the Zika–microcephaly link was *plausible* based on geographic correlation, timing, and biological mechanism. This plausibility argument drove policy responses before causal proof existed.

## Related
[[case_study]] · [[evidence_based_argument]] · [[hypothesis_development]]`,
  },
  {
    path:  'concepts/research_design.md',
    title: 'Research Design',
    content: `# Research Design

**Research design** is the overall plan for how a study collects, measures, and analyzes data to answer a research question.

## Types
- **Experimental** — randomly assigns participants to conditions; allows causal inference
- **Observational** — measures without intervention; correlation only
- **Case study** — in-depth examination of a single case

## Key Elements
- Research question
- Variables (independent, dependent, control)
- Sampling strategy
- Measurement instrument
- Analysis plan

## Related
[[hypothesis_development]] · [[evidence_based_argument]]`,
  },
  {
    path:  'student/profile.md',
    title: 'Student Profile',
    content: `# Student Profile

## Courses
- EA51: Empirical Analyses

## Self-Reported Strengths
- Argument structure
- Written analysis

## Self-Reported Weak Areas
- Connecting case studies to hypothesis development
- Distinguishing plausibility arguments from causal proof
- Research methods vocabulary

## Study Goals
Understand why the Zika microcephaly reading is a case study, and be able to connect it to evidence-based argument, hypothesis development, and plausibility.`,
  },
  {
    path:  'student/confusing_topics.md',
    title: 'Confusing Topics',
    content: `# Confusing Topics

Topics self-reported as difficult or unclear, to be prioritized in study guides and query answers.

1. **Case study vs experiment** — When is something a case study and not an experiment?
2. **Plausibility vs proof** — How much evidence do you need before a claim is "plausible"?
3. **Hypothesis development** — Where does a hypothesis come from, and how specific does it need to be?
4. **Claims vs evidence vs interpretation** — What counts as each, and how do they relate?

## Linked Study Guides
- [[study_guides/zika_case_study_for_this_student]]
- [[bridges/case_study_evidence_hypothesis_plausibility]]`,
  },
  {
    path:  'study_guides/zika_case_study_for_this_student.md',
    title: 'Zika Case Study — Personalized Guide',
    content: `# Zika Case Study — Study Guide for This Student

*Personalized based on your profile: strength in argument structure, weakness in connecting case studies to hypothesis development and plausibility.*

## Why Is the Zika Reading a Case Study?

Because it examines **one specific outbreak in depth** to build theoretical understanding — not to run a controlled experiment or generate a population statistic. The researchers gathered multiple types of evidence (clinical observations, lab results, geographic data) about this one event.

Think of it like this: you know how to build an argument. A case study is an argument built from a single, rich instance rather than from aggregate data.

## The Chain: Case Study → Evidence → Hypothesis → Plausibility

1. **Observation** (the case): Unusual spike in microcephaly cases in Zika-affected regions
2. **Evidence gathering**: Clinical records, lab isolation of Zika in affected infants, geographic overlap
3. **Hypothesis**: Zika virus causes microcephaly in fetuses exposed during pregnancy
4. **Plausibility check**: Is there a known biological mechanism? (Yes — Zika attacks developing neural tissue) Does the timing fit? (Yes) Is it consistent across sites? (Yes)

## What to Remember

- A case study earns its place by making a *plausible* argument from *specific* evidence — it does not need to prove causation outright
- The hypothesis grew FROM the case, not before it
- Plausibility ≠ proof. The Zika hypothesis was plausible enough to act on before randomized trials were possible`,
  },
  {
    path:  'bridges/case_study_evidence_hypothesis_plausibility.md',
    title: 'Bridge: Case Study × Evidence × Hypothesis × Plausibility',
    content: `# Bridge: Case Study, Evidence-Based Argument, Hypothesis Development, Plausibility

*Cross-concept bridge page generated for EA51.*

## The Core Connection

These four concepts form a **chain** in empirical research, not separate topics:

\`\`\`
Case Study
  └─► generates rich Evidence
        └─► evidence is organized into an Argument
              └─► the central claim is a Hypothesis
                    └─► the argument must pass a Plausibility test
\`\`\`

## In the Zika Example

| Concept | Role in Zika |
|---|---|
| Case study | The Zika outbreak is the *case* — one deep, specific instance |
| Evidence-based argument | Multiple evidence types assembled to argue for a causal link |
| Hypothesis | "Zika causes microcephaly in fetuses" — testable, falsifiable |
| Plausibility | Biological mechanism + geographic + temporal coherence made the hypothesis credible *before* RCT proof |

## What This Student Should Remember

You are strong at argument structure. Use that:
- A case study is *an argument from one case*
- Plausibility is *the opening of an argument*: "here is why this is worth believing before we have full proof"
- A hypothesis is *the central claim* of that argument, made precise enough to test`,
  },
]

const MOCK_INDEX = MOCK_PAGES.map(p => ({
  path:  p.path,
  title: p.title,
}))

// ── Helpers ──────────────────────────────────────────────────────────────────
function groupByFolder(pages) {
  const groups = {}
  for (const p of pages) {
    const folder = p.path.includes('/') ? p.path.split('/')[0] : 'root'
    if (!groups[folder]) groups[folder] = []
    groups[folder].push(p)
  }
  return groups
}

const THRESHOLD = 0.4

function masteryColor(score) {
  if (score > 0.7)        return '#22c55e'
  if (score >= THRESHOLD) return '#fbbf24'
  return '#ef4444'
}

function CompactMasteryPanel({ concepts }) {
  return (
    <div className="w-52 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Mastery</span>
        <span className="flex items-center gap-1 text-xs text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
        {concepts.map(c => {
          const pct      = Math.round(c.score * 100)
          const color    = masteryColor(c.score)
          const critical = c.score < THRESHOLD
          return (
            <div key={c.slug}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-medium capitalize truncate"
                  style={{ color: critical ? '#b91c1c' : '#374151' }}
                >
                  {c.slug.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-bold ml-1 shrink-0" style={{ color }}>
                  {pct}%
                </span>
              </div>
              <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                {/* 40% threshold line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-300 z-10"
                  style={{ left: `${THRESHOLD * 100}%` }}
                />
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${critical ? 'animate-pulse' : ''}`}
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2 border-t border-gray-50 flex items-center gap-1.5">
        <span className="w-px h-3 bg-red-300 inline-block rounded" />
        <span className="text-xs text-gray-400">40% threshold</span>
      </div>
    </div>
  )
}

export default function WikiViewer({ ready = false, masteryState = [] }) {
  const [pages, setPages]       = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [demoMode, setDemoMode] = useState(false)

  // Only load pages once the wiki has been built
  useEffect(() => { if (ready) fetchPages() }, [ready])

  const fetchPages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/wiki/pages`)
      if (res.ok) {
        const data = await res.json()
        const real = data.pages ?? []
        if (real.length > 0) {
          setPages(real)
          setDemoMode(false)
          setLoading(false)
          return
        }
      }
    } catch { /* fall through to mock */ }
    // Backend not ready or wiki empty → show pre-built EA51 demo pages
    setPages(MOCK_INDEX)
    setDemoMode(true)
    setLoading(false)
  }

  const openPage = async (page) => {
    setSelected(page)
    setContent('')

    if (demoMode) {
      const mock = MOCK_PAGES.find(m => m.path === page.path)
      setContent(mock?.content ?? '_Page not found._')
      return
    }

    try {
      const res = await fetch(`${API}/wiki/page/${encodeURIComponent(page.path)}`)
      if (!res.ok) throw new Error('Could not load page')
      const data = await res.json()
      setContent(data.content ?? '')
    } catch (e) {
      setContent(`_Error: ${e.message}_`)
    }
  }

  const filtered = pages.filter(p =>
    p.path.toLowerCase().includes(search.toLowerCase()) ||
    (p.title ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const groups = groupByFolder(filtered)

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">Wiki Pages</span>
          <div className="flex items-center gap-2">
            {demoMode && (
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5 font-medium">
                demo
              </span>
            )}
            <button
              onClick={fetchPages}
              title="Refresh"
              className="text-gray-400 hover:text-sky-600 text-sm"
            >
              ↻
            </button>
          </div>
        </div>

        <div className="p-2 border-b border-gray-100">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pages…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-xs text-gray-400 text-center p-4">Loading…</p>}
          {!ready && !loading && (
            <div className="p-5 text-center">
              <p className="text-xs text-gray-400">Go to Ingest and click</p>
              <p className="text-xs font-semibold text-sky-600 mt-0.5">🚀 Build Wiki</p>
            </div>
          )}
          {Object.entries(groups).map(([folder, items]) => (
            <div key={folder} className="mb-1">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <span>{FOLDER_ICONS[folder] ?? '📁'}</span>
                <span>{folder.replace(/_/g, ' ')}</span>
              </div>
              {items.map(page => (
                <button
                  key={page.path}
                  onClick={() => openPage(page)}
                  className={`w-full text-left px-4 py-1.5 text-sm truncate transition-colors ${
                    selected?.path === page.path
                      ? 'bg-sky-50 text-sky-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page.title ?? page.path.split('/').pop().replace(/_/g, ' ').replace('.md', '')}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
              <span className="text-sm text-gray-500 font-mono flex-1">{selected.path}</span>
              {demoMode && (
                <span className="text-xs text-amber-500 shrink-0">demo page</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6 prose-wiki max-w-none">
              {content
                ? <ReactMarkdown>{content}</ReactMarkdown>
                : <p className="text-gray-400 text-sm">Loading…</p>
              }
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="text-5xl mb-4">📄</div>
            <p className="text-gray-500 font-medium">Select a page from the sidebar</p>
            <p className="text-gray-400 text-sm mt-1">
              {!ready
                ? 'Go to Ingest and click Build Wiki first.'
                : demoMode
                ? `${pages.length} demo pages ready`
                : `${pages.length} page${pages.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
        )}
      </div>

      {/* Compact mastery panel — right side, visible after wiki is built */}
      {ready && masteryState.length > 0 && (
        <CompactMasteryPanel concepts={masteryState} />
      )}
    </div>
  )
}
