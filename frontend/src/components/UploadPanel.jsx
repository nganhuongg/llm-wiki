import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'

const FILE_ICONS = {
  pdf:  '📄',
  docx: '📝',
  txt:  '📃',
  md:   '📋',
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  return FILE_ICONS[ext] ?? '📁'
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPanel({ onWikiBuilt }) {
  const [assets, setAssets]             = useState([])       // files from /assets
  const [selected, setSelected]         = useState(new Set()) // filenames selected for ingest
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [studentContext, setStudentContext] = useState('')
  const [status, setStatus]             = useState('idle')    // idle | ingesting | done | error
  const [message, setMessage]           = useState('')
  const [progress, setProgress]         = useState('')        // per-file progress

  useEffect(() => {
    fetch(`${API}/assets`)
      .then(r => r.json())
      .then(data => {
        const files = data.files ?? []
        setAssets(files)
        setSelected(new Set(files.map(f => f.name)))
      })
      .catch(() => setAssets([]))
      .finally(() => setLoadingAssets(false))
  }, [])

  const toggleAll = () => {
    if (selected.size === assets.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(assets.map(f => f.name)))
    }
  }

  const toggle = name => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleBuild = async () => {
    if (selected.size === 0) {
      setMessage('Select at least one file to ingest.')
      return
    }
    try {
      setStatus('ingesting')
      setMessage('')

      const names = [...selected]
      for (let i = 0; i < names.length; i++) {
        const name = names[i]
        setProgress(`Ingesting ${i + 1} / ${names.length}: ${name}`)
        const res = await fetch(`${API}/ingest-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name }),
        })
        if (!res.ok) throw new Error(`Failed to ingest ${name}`)
      }

      if (studentContext.trim()) {
        setProgress('Saving student context…')
        const res = await fetch(`${API}/student-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: studentContext }),
        })
        if (!res.ok) throw new Error('Failed to save student context')
      }

      setStatus('done')
      setProgress('')
      setMessage(`Ingested ${names.length} file${names.length !== 1 ? 's' : ''}. Wiki is ready.`)
      onWikiBuilt()
    } catch (err) {
      setStatus('error')
      setProgress('')
      setMessage(err.message)
    }
  }

  const statusColors = {
    idle:      'text-gray-500',
    ingesting: 'text-sky-600',
    done:      'text-green-600',
    error:     'text-red-500',
  }

  const busy = status === 'ingesting'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ingest Course Materials</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Select files from the <code className="bg-gray-100 px-1 rounded text-xs">assets/</code> folder, add a student context note, then click Build Wiki.
        </p>
      </div>

      {/* Asset file list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Course files in <code className="text-xs bg-gray-100 px-1 rounded">assets/</code></span>
          {assets.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-sky-600 hover:underline"
            >
              {selected.size === assets.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {loadingAssets ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading files…</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No files found in <code className="text-xs bg-gray-100 px-1 rounded">assets/</code>.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {assets.map(f => (
              <li key={f.name}>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.has(f.name)}
                    onChange={() => toggle(f.name)}
                    disabled={busy}
                    className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-400"
                  />
                  <span className="text-lg leading-none">{fileIcon(f.name)}</span>
                  <span className="text-sm text-gray-800 truncate flex-1">{f.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatSize(f.size)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {assets.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {selected.size} of {assets.length} selected
          </div>
        )}
      </div>

      {/* Student context */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Student Context <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={studentContext}
          onChange={e => setStudentContext(e.target.value)}
          rows={4}
          disabled={busy}
          placeholder="e.g. I struggle with hypothesis testing and often confuse claims, evidence, and interpretation. My main courses are Statistics, Biology, and Academic Writing."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 mt-1">
          Describe your weak topics, goals, or courses. This personalizes the wiki just for you.
        </p>
      </div>

      {/* Progress */}
      {progress && (
        <div className="flex items-center gap-2 text-sm text-sky-600">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
          {progress}
        </div>
      )}

      {/* Build button */}
      <button
        onClick={handleBuild}
        disabled={busy || selected.size === 0}
        className="w-full py-3 rounded-xl bg-sky-600 text-white font-semibold text-base hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? 'Building Wiki…' : '🚀 Build Wiki'}
      </button>

      {/* Status message */}
      {message && !progress && (
        <p className={`text-sm text-center ${statusColors[status]}`}>{message}</p>
      )}
    </div>
  )
}
