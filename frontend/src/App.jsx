import { useState, useEffect, useRef } from 'react'
import './App.css'
import UploadPanel     from './components/UploadPanel'
import WikiViewer      from './components/WikiViewer'
import QueryBox        from './components/QueryBox'
import MasteryTimeline from './components/MasteryTimeline'
import GraphView       from './components/GraphView'
import LintReport      from './components/LintReport'
import DecayToast      from './components/DecayToast'

const TABS = [
  { id: 'ingest',  label: 'Ingest',  icon: '⬆' },
  { id: 'wiki',    label: 'Wiki',    icon: '📄' },
  { id: 'query',   label: 'Query',   icon: '💬' },
  { id: 'mastery', label: 'Mastery', icon: '🧠' },
  { id: 'graph',   label: 'Graph',   icon: '🕸' },
  { id: 'lint',    label: 'Lint',    icon: '🔍' },
]

// 6 demo concepts seeded on ingest (§5 of the plan)
const INITIAL_MASTERY = [
  { slug: 'case_study',              score: 0.72 },
  { slug: 'plausibility',            score: 0.58 },
  { slug: 'hypothesis_development',  score: 0.66 },
  { slug: 'evidence_based_argument', score: 0.64 },
  { slug: 'research_design',         score: 0.70 },
  { slug: 'confounders',             score: 0.51 },
]

// Decay per second — plausibility crosses 0.40 in ~72 s after ingest (demo 2:02)
const DECAY = {
  case_study:              0.0004,
  plausibility:            0.0025,
  hypothesis_development:  0.0006,
  evidence_based_argument: 0.0007,
  research_design:         0.0003,
  confounders:             0.0013,
}

const THRESHOLD = 0.4

// Excerpt shown in the toast for each concept
const EXCERPTS = {
  plausibility:
    'Plausibility is the degree to which a claim is consistent with existing knowledge before definitive proof is available. In the Zika case, the geographic correlation and biological mechanism made the link plausible enough to act on.',
  confounders:
    'A confounder is a variable that correlates with both the exposure and the outcome, potentially distorting the observed relationship. Controlling for confounders is essential before drawing causal conclusions.',
}

function MasteryBadge({ masteryState }) {
  if (!masteryState.length) return null
  const worst    = masteryState.reduce((a, b) => a.score < b.score ? a : b)
  const score    = Math.round(worst.score * 100)
  const critical = worst.score < THRESHOLD
  return (
    <div
      title={`Lowest mastery: ${worst.slug.replace(/_/g, ' ')} — ${score}%`}
      className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        critical
          ? 'bg-red-50 border-red-300 text-red-600 animate-pulse'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}
    >
      <span>{critical ? '⚠️' : '🧠'}</span>
      <span className="capitalize truncate max-w-[100px]">{worst.slug.replace(/_/g, ' ')}</span>
      <span>{score}%</span>
    </div>
  )
}

export default function App() {
  const [activeTab,    setActiveTab]    = useState('ingest')
  const [wikiReady,    setWikiReady]    = useState(false)
  const [masteryState, setMasteryState] = useState([])
  const [toastQueue,   setToastQueue]   = useState([])
  const prevScores = useRef({})

  // ── Seed mastery + start decay timer after wiki is built ─────────────────
  useEffect(() => {
    if (!wikiReady) return
    const now = new Date().toISOString()
    const initial = INITIAL_MASTERY.map(c => ({ ...c, knownAsOf: now }))
    setMasteryState(initial)
    // seed prevScores so we don't immediately fire toasts
    prevScores.current = Object.fromEntries(initial.map(c => [c.slug, c.score]))

    const interval = setInterval(() => {
      setMasteryState(prev =>
        prev.map(c => ({
          ...c,
          score: Math.max(0, c.score - (DECAY[c.slug] ?? 0.001)),
        }))
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [wikiReady])

  // ── Detect threshold crossings → fire toast ───────────────────────────────
  useEffect(() => {
    for (const c of masteryState) {
      const prev = prevScores.current[c.slug]
      if (prev !== undefined && prev >= THRESHOLD && c.score < THRESHOLD) {
        setToastQueue(q => [
          ...q,
          {
            id:       Date.now() + Math.random(),
            concept:  c.slug,
            score:    c.score,
            knownAsOf: c.knownAsOf,
            excerpt:  EXCERPTS[c.slug] ?? `Your understanding of "${c.slug.replace(/_/g, ' ')}" is fading. Review it now.`,
          },
        ])
      }
      prevScores.current[c.slug] = c.score
    }
  }, [masteryState])

  const dismissToast = id => setToastQueue(q => q.filter(t => t.id !== id))

  const handleWikiBuilt = () => {
    setWikiReady(true)
    setActiveTab('wiki')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2 shrink-0">
            <span className="text-2xl">🎓</span>
            <span className="text-xl font-bold text-sky-700">StudyAtlas</span>
          </div>
          <MasteryBadge masteryState={masteryState} />
          <nav className="flex gap-1 ml-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === 'ingest'  && <UploadPanel onWikiBuilt={handleWikiBuilt} />}
        {activeTab === 'wiki'    && <WikiViewer  ready={wikiReady} masteryState={masteryState} />}
        {activeTab === 'query'   && <QueryBox    masteryState={masteryState} />}
        {activeTab === 'mastery' && <MasteryTimeline masteryState={masteryState} />}
        {activeTab === 'graph'   && <GraphView   masteryState={masteryState} />}
        {activeTab === 'lint'    && <LintReport  masteryState={masteryState} />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t border-gray-100">
        StudyAtlas — knowledge has a half-life
      </footer>

      <DecayToast toasts={toastQueue} onDismiss={dismissToast} />
    </div>
  )
}
