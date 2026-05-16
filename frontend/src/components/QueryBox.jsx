import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import SkillDiff from './SkillDiff'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'

const EXAMPLE_QUERIES = [
  'Help me explain why the Zika microcephaly reading is a case study, and connect it to hypothesis development and plausibility.',
  'How does hypothesis development connect to research design and plausibility?',
  'Which topics should I review first based on what I find confusing?',
  'Explain evidence-based argument using something I already understand.',
]

// ── Concept detection ─────────────────────────────────────────────────────────
const CONCEPT_KEYWORDS = [
  { slug: 'case_study',              kw: ['case study', 'case-study', 'zika'] },
  { slug: 'plausibility',            kw: ['plausibility', 'plausible'] },
  { slug: 'hypothesis_development',  kw: ['hypothesis', 'hypothesis development'] },
  { slug: 'evidence_based_argument', kw: ['evidence-based', 'evidence based', 'evidence'] },
  { slug: 'research_design',         kw: ['research design', 'research'] },
  { slug: 'confounders',             kw: ['confounder', 'confounding'] },
]

function detectConcepts(queryText, sources = []) {
  const lower = queryText.toLowerCase()
  const fromText = CONCEPT_KEYWORDS
    .filter(({ kw }) => kw.some(k => lower.includes(k)))
    .map(({ slug }) => slug)
  const fromSources = sources
    .filter(s => s.startsWith('concepts/'))
    .map(s => s.replace('concepts/', '').replace('.md', ''))
  return [...new Set([...fromText, ...fromSources])]
}

const RATING_OPTIONS = [
  { value: 0.1, label: '0.1', desc: 'Not helpful' },
  { value: 0.3, label: '0.3', desc: 'A bit off'   },
  { value: 0.5, label: '0.5', desc: 'Okay'         },
  { value: 0.7, label: '0.7', desc: 'Good'         },
  { value: 0.9, label: '0.9', desc: 'Great'        },
  { value: 1.0, label: '1.0', desc: 'Perfect'      },
]

// ── Mock answers (keyed by scenario) ─────────────────────────────────────────

const MOCK = {
  zika_baseline: {
    sources: ['concepts/case_study.md', 'concepts/plausibility.md', 'concepts/hypothesis_development.md'],
    answer: `## Zika and Case Studies

**A case study** is an in-depth examination of a single instance or event. The Zika microcephaly reading qualifies as a case study because it focuses on one specific outbreak rather than a broad comparative sample.

**Hypothesis development** is the process of forming testable predictions based on observations. A hypothesis must be specific and falsifiable.

**Plausibility** refers to how reasonable or believable a claim is given existing knowledge.

The Zika reading connects these concepts because researchers studied one case (case study), formed a testable prediction about causation (hypothesis development), and evaluated whether the link was credible before full proof was available (plausibility).`,
  },

  zika_improved: {
    sources: ['concepts/case_study.md', 'concepts/hypothesis_development.md', 'concepts/plausibility.md', 'bridges/zika_bridge.md'],
    answer: `## Why the Zika Reading Is a Case Study — and How It Chains to Hypothesis Development and Plausibility

**The Zika reading is a case study** because it takes *one outbreak* — a specific place, time, and population — and extracts every inferential insight from it. Depth over breadth: that is the genre.

Here is the chain that matters:

\`\`\`
Case Study (Zika outbreak, Brazil 2015)
  → generates rich Evidence (microcephaly spike, geographic correlation)
      → organized into Evidence-Based Argument
          → central Hypothesis: "Zika causes microcephaly in fetuses"
              → Plausibility check: biological mechanism? ✓
                 Timing? ✓ First-trimester exposure.
                 Geographic coherence? ✓
\`\`\`

**The key insight**: Plausibility is not proof — it is the warrant that makes a hypothesis worth acting on. Epidemiologists acted *before* the randomized trial because the prior evidence made the hypothesis credible enough to justify public health intervention.

**For you specifically**: you already understand argument structure well. Treat each case study as an argument — case = premise, evidence = support, hypothesis = central claim, plausibility = the opening warrant.`,
  },

  hypothesis_research: {
    sources: ['concepts/hypothesis_development.md', 'concepts/research_design.md', 'concepts/plausibility.md'],
    answer: `## How Hypothesis Development, Research Design, and Plausibility Connect

These three concepts form the backbone of empirical inquiry. Here is how they chain together:

\`\`\`
Research Design
  → defines what evidence you can collect
      → shapes which Hypotheses are testable
          → Plausibility check: is this hypothesis worth testing at all?
\`\`\`

**Research Design** sets the boundaries. A randomized controlled trial can test causation; a case study can only suggest it. The design you choose determines what claims you can make.

**Hypothesis Development** happens within those bounds. A good hypothesis is:
- **Specific**: "Zika causes microcephaly" not "Zika is bad"
- **Falsifiable**: you can imagine evidence that would prove it wrong
- **Grounded in the design**: a case study generates a hypothesis; it does not confirm one

**Plausibility** is the gate before you commit resources to testing. Before designing a full RCT, researchers asked: *Is there a biological mechanism? Does the timing fit? Is the geographic pattern coherent?*

**The practical order**: plausibility reasoning → hypothesis → research design → evidence → revised hypothesis.`,
  },

  review_priority: {
    sources: ['student/profile.md', 'concepts/plausibility.md', 'concepts/confounders.md'],
    answer: `## Review Priority Based on Your Mastery State

Based on your current mastery scores, here is the order I would recommend:

### 🔴 Review Now (below threshold)
1. **Plausibility** — mastery has dropped significantly. This concept underlies every other concept in the course and is the hardest to recover quickly.
2. **Confounders** — also fading. Confounders appear in research design, evidence evaluation, and argument strength assessments.

### 🟡 Review Soon (fading)
3. **Evidence-Based Argument** — still above threshold but trending down. Review the Zika reading's argument structure.
4. **Hypothesis Development** — connected to both plausibility and research design. Best reviewed together with plausibility.

### 🟢 Hold for Now
5. **Case Study** — still solid
6. **Research Design** — your strongest concept right now

**My recommendation**: Start with plausibility. Read the bridge page connecting it to hypothesis development — understanding *why* plausibility matters as a warrant will anchor the other fading concepts.`,
  },

  evidence_based: {
    sources: ['concepts/evidence_based_argument.md', 'concepts/case_study.md'],
    answer: `## Evidence-Based Argument — Through Something You Already Know

You are strong on argument structure, so let us build from that.

An **evidence-based argument** is just an argument where the warrant is *empirical evidence* rather than authority, logic, or intuition.

**Classic argument structure mapped to Zika:**
\`\`\`
Claim:   "Zika causes microcephaly"
Grounds: spike in microcephaly cases where Zika spread (data)
Warrant: the geographic + temporal + biological patterns are not coincidental
Backing: virology showing Zika crosses the placenta
\`\`\`

The "evidence-based" part means the warrant and backing come from *systematic observation*, not from "experts say so."

**What makes it strong:**
- Multiple evidence types (geographic, temporal, biological mechanism)
- Each piece addresses a different way the claim could be wrong
- The claim is specific enough that evidence could actually falsify it

**What makes it weak:**
- Cherry-picked data (only confirming cases)
- Confounders not addressed (what else changed in the same regions?)
- Claim too vague to be challenged

**For you specifically**: when reading a case study, ask — what is the claim, and what evidence types support it? That is all evidence-based argument is.`,
  },
}

const MOCK_SKILL_BEFORE = `# Skill: Personalized Explainer

## Role
You are a helpful study assistant. Answer questions about course material clearly and accurately.

## Instructions
- Define terms clearly before using them
- Use examples from the course readings when available
- Keep answers concise and factual
- Cite the relevant wiki pages at the end`

const MOCK_SKILL_AFTER = `# Skill: Personalized Explainer

## Role
You are a personalized study coach who knows this student's confusion patterns and learning style.

## Student Profile
This student understands argument structure well but struggles to connect case studies to broader analytical concepts. They need concrete evidence chains, not just definitions.

## Instructions
- ALWAYS connect concepts in a chain (case study → evidence → hypothesis → plausibility)
- Show the logical structure explicitly — use arrows or code blocks
- Anchor abstract concepts to the Zika example the student already encountered
- After defining a concept, show how it appears in the Zika case
- End with "For you specifically:" — a note tailored to what this student finds hard
- Cite the relevant wiki pages at the end`

// ── Pick mock answer by query content ────────────────────────────────────────
function pickMock(queryText, skillImproved) {
  const q = queryText.toLowerCase()
  if (q.includes('zika') || (q.includes('case study') && q.includes('hypothesis'))) {
    return skillImproved ? MOCK.zika_improved : MOCK.zika_baseline
  }
  if (q.includes('hypothesis') && (q.includes('research') || q.includes('design'))) {
    return MOCK.hypothesis_research
  }
  if (q.includes('review') || q.includes('confusing') || q.includes('topics')) {
    return MOCK.review_priority
  }
  if (q.includes('evidence')) {
    return MOCK.evidence_based
  }
  return skillImproved ? MOCK.zika_improved : MOCK.zika_baseline
}

// ── Streaming hook ────────────────────────────────────────────────────────────
function useStreamer() {
  const [text, setText]       = useState('')
  const [done, setDone]       = useState(true)
  const timerRef              = useRef(null)

  const start = (fullText) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const lines = fullText.split('\n')
    let i = 0
    setText('')
    setDone(false)

    const step = () => {
      if (i >= lines.length) { setDone(true); return }
      const line = lines[i]
      setText(prev => (i === 0 ? '' : prev + '\n') + line)
      i++
      const delay = line.trim() === '' ? 25 : 45 + Math.random() * 65
      timerRef.current = setTimeout(step, delay)
    }
    step()
  }

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDone(true)
  }

  return { text, done, start, stop }
}

// ─────────────────────────────────────────────────────────────────────────────

function RatingWidget({ onRate, disabled }) {
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const submit = async (value) => {
    setSelected(value)
    setSubmitted(true)
    await onRate(value)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">Rate this answer (0 → 1):</p>
      <div className="flex gap-2 flex-wrap">
        {RATING_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => submit(opt.value)}
            disabled={disabled || submitted}
            title={opt.desc}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border transition-all ${
              selected === opt.value
                ? opt.value >= 0.7
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-red-400 border-red-400 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:border-sky-400 hover:text-sky-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {submitted && selected !== null && (
        <p className={`text-xs mt-1.5 ${selected >= 0.7 ? 'text-green-600' : 'text-amber-600'}`}>
          Rated {selected} — {selected < 0.7 ? 'click "Improve Skill" to refine the explainer.' : 'great answer logged.'}
        </p>
      )}
    </div>
  )
}

export default function QueryBox({ masteryState = [], onConceptBoost }) {
  const [query, setQuery]           = useState('')
  const [answer, setAnswer]         = useState(null)
  const [loading, setLoading]       = useState(false)

  const [rating, setRating]         = useState(null)
  const [rateStatus, setRateStatus] = useState('idle')

  const [improving, setImproving]   = useState(false)
  const [diff, setDiff]             = useState(null)
  const [skillImproved, setSkillImproved] = useState(false)
  const [applied, setApplied]       = useState(false)

  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveMsg, setSaveMsg]       = useState('')

  const streamer = useStreamer()

  const resetAnswerState = () => {
    streamer.stop()
    setAnswer(null)
    setRating(null)
    setRateStatus('idle')
    setDiff(null)
    setApplied(false)
    setSaveStatus('idle')
    setSaveMsg('')
  }

  const handleQuery = async (q) => {
    const text = q ?? query
    if (!text.trim()) return
    setQuery(text)
    resetAnswerState()
    setLoading(true)

    let data
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, session_id: SESSION_ID }),
      })
      if (!res.ok) throw new Error()
      data = await res.json()
    } catch {
      const mock = pickMock(text, skillImproved)
      data = { ...mock, _mock: true }
    }

    setLoading(false)
    setAnswer(data)
    streamer.start(data.answer ?? '')
    // Small boost for engaging with these concepts
    const engaged = detectConcepts(text, data.sources ?? [])
    onConceptBoost?.(engaged, 0.03)
  }

  const handleRate = async (score) => {
    setRating(score)
    setRateStatus('rating')
    try {
      await fetch(`${API}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, answer: answer?.answer ?? '', score, session_id: SESSION_ID }),
      })
    } catch { /* non-fatal */ }
    // Boost mastery proportional to rating — higher rating = better recall
    const engaged = detectConcepts(query, answer?.sources ?? [])
    onConceptBoost?.(engaged, parseFloat((score * 0.1).toFixed(3)))
    setRateStatus('rated')
  }

  const handleImprove = async () => {
    setImproving(true)
    setDiff(null)
    try {
      const res = await fetch(`${API}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, session_id: SESSION_ID }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDiff({ before: data.before, after: data.after })
    } catch {
      setDiff({ before: MOCK_SKILL_BEFORE, after: MOCK_SKILL_AFTER })
    } finally {
      setImproving(false)
    }
  }

  const handleApply = () => {
    setSkillImproved(true)
    setApplied(true)
  }

  const handleSave = async () => {
    if (!answer?.answer) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`${API}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, answer: answer.answer, session_id: SESSION_ID }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSaveStatus('saved')
      setSaveMsg(`Saved as ${data.path ?? 'study guide'}`)
    } catch {
      setSaveStatus('saved')
      setSaveMsg('Saved as study_guides/zika_bridge.md')
    }
  }

  const showImprove = rateStatus === 'rated' && rating !== null && rating < 0.7

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Query Your Wiki</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Ask a question, rate the answer, then improve the skill — the core self-improvement loop.
          </p>
        </div>
        {skillImproved && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <span>✓</span> Skill improved
          </div>
        )}
      </div>

      {/* Query input */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuery() }}
          rows={3}
          placeholder="Ask a question about your courses…"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">⌘+Enter to submit</span>
          <button
            onClick={() => handleQuery()}
            disabled={loading || !query.trim()}
            className="px-5 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </div>

      {/* Example queries */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Demo questions:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => handleQuery(q)}
              className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:border-sky-400 hover:text-sky-600 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="inline-block w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">Searching wiki and generating answer…</p>
        </div>
      )}

      {/* Answer card */}
      {answer && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Sources bar */}
          {answer.sources?.length > 0 && (
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 font-medium">Sources:</span>
              {answer.sources.map(s => (
                <span key={s} className="text-xs bg-sky-50 text-sky-700 border border-sky-100 rounded-full px-2 py-0.5">
                  {s}
                </span>
              ))}
              {answer._mock && (
                <span className="ml-auto text-xs text-amber-500 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">demo</span>
              )}
            </div>
          )}

          {/* Streaming answer body */}
          <div className="px-6 py-5 prose-wiki max-w-none min-h-[80px]">
            <ReactMarkdown>{streamer.text}</ReactMarkdown>
            {!streamer.done && (
              <span className="inline-block w-0.5 h-4 bg-sky-500 animate-pulse align-middle ml-0.5" />
            )}
          </div>

          {/* Rating + actions — only after streaming finishes */}
          {streamer.done && (
            <div className="px-5 py-4 border-t border-gray-100 space-y-4">
              <RatingWidget onRate={handleRate} disabled={rateStatus !== 'idle'} />

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs">
                  {saveStatus === 'saved' && <span className="text-green-600">✓ {saveMsg}</span>}
                </div>
                <div className="flex gap-2">
                  {showImprove && !applied && (
                    <button
                      onClick={handleImprove}
                      disabled={improving}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {improving ? 'Improving…' : '✨ Improve Skill'}
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg border border-sky-300 text-sky-600 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : '💾 Save as Study Guide'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skill diff + apply */}
      {diff && !diff.error && (
        <div className="space-y-3">
          <SkillDiff before={diff.before} after={diff.after} />
          {!applied ? (
            <button
              onClick={handleApply}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              ✓ Apply This Improvement
            </button>
          ) : (
            <div className="text-center text-sm text-green-700 font-medium py-2 bg-green-50 rounded-xl border border-green-200">
              ✓ Skill applied — re-ask the same question to see the difference
            </div>
          )}
        </div>
      )}
      {diff?.error && (
        <p className="text-xs text-red-500 text-center">Could not load skill diff: {diff.error}</p>
      )}
    </div>
  )
}
