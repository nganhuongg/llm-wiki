import { useState, useEffect } from 'react'
import './App.css'
import UploadPanel     from './components/UploadPanel'
import WikiViewer      from './components/WikiViewer'
import QueryBox        from './components/QueryBox'
import MasteryTimeline from './components/MasteryTimeline'
import GraphView       from './components/GraphView'
import LintReport      from './components/LintReport'
import DecayToast      from './components/DecayToast'
import { SESSION_ID }  from './session'

const API = 'http://localhost:8000'
const THRESHOLD = 0.4

const TABS = [
  { id: 'ingest',  label: 'Ingest',  icon: '⬆' },
  { id: 'wiki',    label: 'Wiki',    icon: '📄' },
  { id: 'query',   label: 'Query',   icon: '💬' },
  { id: 'mastery', label: 'Mastery', icon: '🧠' },
  { id: 'graph',   label: 'Graph',   icon: '🕸' },
  { id: 'lint',    label: 'Lint',    icon: '🔍' },
]

function MasteryBadge() {
  const [worst, setWorst] = useState(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API}/mastery-state?session_id=${encodeURIComponent(SESSION_ID)}`)
        if (!res.ok) return
        const data = await res.json()
        const concepts = data.concepts ?? []
        if (!concepts.length) { setWorst(null); return }
        setWorst(concepts.reduce((a, b) => a.score < b.score ? a : b))
      } catch { /* non-critical */ }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  if (!worst) return null
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
  const [activeTab, setActiveTab] = useState('ingest')
  const [wikiReady, setWikiReady] = useState(false)

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
          <MasteryBadge />
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
        {activeTab === 'wiki'    && <WikiViewer ready={wikiReady} />}
        {activeTab === 'query'   && <QueryBox />}
        {activeTab === 'mastery' && <MasteryTimeline />}
        {activeTab === 'graph'   && <GraphView />}
        {activeTab === 'lint'    && <LintReport />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t border-gray-100">
        StudyAtlas — knowledge has a half-life
      </footer>

      <DecayToast />
    </div>
  )
}
