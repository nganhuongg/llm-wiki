import { useState } from 'react'
import './App.css'
import UploadPanel from './components/UploadPanel'
import WikiViewer from './components/WikiViewer'
import QueryBox from './components/QueryBox'
import GraphView from './components/GraphView'
import LintReport from './components/LintReport'

const TABS = [
  { id: 'ingest',  label: 'Ingest',     icon: '⬆' },
  { id: 'wiki',    label: 'Wiki',        icon: '📄' },
  { id: 'query',   label: 'Query',       icon: '💬' },
  { id: 'graph',   label: 'Graph',       icon: '🕸' },
  { id: 'lint',    label: 'Lint',        icon: '🔍' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('ingest')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <span className="text-xl font-bold text-sky-700">StudyAtlas</span>
            <span className="text-xs text-gray-400 ml-1 hidden sm:block">Personalized LLM Wiki for Students</span>
          </div>
          <nav className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === 'ingest' && <UploadPanel onWikiBuilt={() => setActiveTab('wiki')} />}
        {activeTab === 'wiki'   && <WikiViewer />}
        {activeTab === 'query'  && <QueryBox />}
        {activeTab === 'graph'  && <GraphView />}
        {activeTab === 'lint'   && <LintReport />}
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 border-t border-gray-100">
        StudyAtlas — knowledge that compounds
      </footer>
    </div>
  )
}
