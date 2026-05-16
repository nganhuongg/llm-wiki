import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const API = 'http://localhost:8000'

const FOLDER_ICONS = {
  courses:     '🎓',
  concepts:    '💡',
  sources:     '📑',
  student:     '👤',
  study_guides:'📋',
  bridges:     '🌉',
}

function groupByFolder(pages) {
  const groups = {}
  for (const p of pages) {
    const parts = p.path.split('/')
    const folder = parts.length > 1 ? parts[0] : 'root'
    if (!groups[folder]) groups[folder] = []
    groups[folder].push(p)
  }
  return groups
}

export default function WikiViewer() {
  const [pages, setPages]           = useState([])
  const [selected, setSelected]     = useState(null)
  const [content, setContent]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    fetchPages()
  }, [])

  const fetchPages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/wiki/pages`)
      if (!res.ok) throw new Error('Could not load wiki pages')
      const data = await res.json()
      setPages(data.pages ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openPage = async (page) => {
    setSelected(page)
    setContent('')
    try {
      const res = await fetch(`${API}/wiki/page/${encodeURIComponent(page.path)}`)
      if (!res.ok) throw new Error('Could not load page')
      const data = await res.json()
      setContent(data.content ?? '')
    } catch (e) {
      setContent(`_Error loading page: ${e.message}_`)
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
          <button
            onClick={fetchPages}
            title="Refresh"
            className="text-gray-400 hover:text-sky-600 text-sm"
          >
            ↻
          </button>
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
          {loading && (
            <p className="text-xs text-gray-400 text-center p-4">Loading…</p>
          )}
          {error && !loading && (
            <p className="text-xs text-red-400 text-center p-4">{error}</p>
          )}
          {!loading && !error && pages.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400">No wiki pages yet.</p>
              <p className="text-xs text-gray-400 mt-1">Go to Ingest and build the wiki first.</p>
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
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-mono">{selected.path}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6 prose-wiki max-w-none">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="text-gray-400 text-sm">Loading…</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="text-5xl mb-4">📄</div>
            <p className="text-gray-500 font-medium">Select a page from the sidebar</p>
            <p className="text-gray-400 text-sm mt-1">
              {pages.length === 0
                ? 'Ingest some course materials first to generate wiki pages.'
                : `${pages.length} page${pages.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
