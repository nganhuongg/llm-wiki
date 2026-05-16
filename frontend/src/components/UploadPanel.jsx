import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain':    ['.txt'],
  'text/markdown': ['.md'],
}

const FILE_ICONS = { pdf: '📄', docx: '📝', txt: '📃', md: '📋' }
const fileIcon = name => FILE_ICONS[name.split('.').pop().toLowerCase()] ?? '📁'
const fmtSize  = b => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

export default function UploadPanel({ onWikiBuilt }) {
  const [assets, setAssets]               = useState([])
  const [selected, setSelected]           = useState(new Set())
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [newFiles, setNewFiles]           = useState([])
  const [studentContext, setStudentContext] = useState('')

  const [building, setBuilding]   = useState(false)
  const [stepLabel, setStepLabel] = useState('')
  const [pct, setPct]             = useState(0)     // 0–100
  const [done, setDone]           = useState(false)

  // ── Load assets ───────────────────────────────────────────────────────────
  const loadAssets = useCallback(async () => {
    setLoadingAssets(true)
    try {
      const res = await fetch(`${API}/assets`)
      if (res.ok) {
        const data = await res.json()
        const files = data.files ?? []
        setAssets(files)
        setSelected(new Set(files.map(f => f.name)))
        return
      }
    } catch { /* backend not up yet — that's fine */ }
    setAssets([])
    setLoadingAssets(false)
  }, [])

  useEffect(() => {
    loadAssets().finally(() => setLoadingAssets(false))
  }, [loadAssets])

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(accepted => {
    setNewFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...accepted.filter(f => !existing.has(f.name))]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT, multiple: true })

  // ── Asset selection ────────────────────────────────────────────────────────
  const toggleAll = () =>
    setSelected(selected.size === assets.length ? new Set() : new Set(assets.map(f => f.name)))
  const toggle = name => {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    setSelected(next)
  }

  // ── Build Wiki ────────────────────────────────────────────────────────────
  const handleBuild = async () => {
    if (selected.size === 0 && newFiles.length === 0) return

    setBuilding(true)
    setDone(false)
    setPct(0)

    const selectedAssets = Array.from(selected)
    const total = newFiles.length + selectedAssets.length + (studentContext.trim() ? 1 : 0)
    let step = 0
    const tick = label => {
      step += 1
      setStepLabel(label)
      setPct(Math.round((step / Math.max(total, 1)) * 100))
    }

    try {
      // 1. Upload any new dragged-in files (backend saves them to assets/)
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        tick(`Uploading ${i + 1}/${newFiles.length}: ${file.name}…`)
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${API}/ingest?session_id=${encodeURIComponent(SESSION_ID)}`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`)
      }

      // 2. Ingest selected pre-existing assets
      for (let i = 0; i < selectedAssets.length; i++) {
        const name = selectedAssets[i]
        tick(`Ingesting ${i + 1}/${selectedAssets.length}: ${name}…`)
        const res = await fetch(`${API}/ingest-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name, session_id: SESSION_ID }),
        })
        if (!res.ok) throw new Error(`Failed to ingest ${name}`)
      }

      // 3. Student context
      if (studentContext.trim()) {
        tick('Saving student context…')
        await fetch(`${API}/student-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: studentContext, session_id: SESSION_ID }),
        })
      }

      setPct(100)
      setStepLabel('Wiki ready!')
      setBuilding(false)
      setDone(true)
      await loadAssets()
      await new Promise(r => setTimeout(r, 600))
      onWikiBuilt()
    } catch (err) {
      setStepLabel(`Error: ${err.message}`)
      setBuilding(false)
    }
  }

  const canBuild = (selected.size > 0 || newFiles.length > 0) && !building && !done

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ingest Course Materials</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Select files from <code className="bg-gray-100 px-1 rounded text-xs">assets/</code> or
          drag in new ones, add a student note, then click Build Wiki.
        </p>
      </div>

      {/* ── Pre-existing assets ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Files in <code className="text-xs bg-gray-100 px-1 rounded">assets/</code>
          </span>
          {assets.length > 0 && (
            <button onClick={toggleAll} className="text-xs text-sky-600 hover:underline">
              {selected.size === assets.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {loadingAssets ? (
          <p className="text-sm text-gray-400 text-center py-5">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-5">
            No files in <code className="text-xs bg-gray-100 px-1 rounded">assets/</code> yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {assets.map(f => (
              <li key={f.name}>
                <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.has(f.name)}
                    onChange={() => toggle(f.name)}
                    disabled={building}
                    className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-400"
                  />
                  <span className="text-base leading-none">{fileIcon(f.name)}</span>
                  <span className="text-sm text-gray-800 truncate flex-1">{f.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {assets.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {selected.size} of {assets.length} selected
          </div>
        )}
      </div>

      {/* ── Upload new files ────────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Upload additional files</p>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-sky-500 bg-sky-50'
              : 'border-gray-300 hover:border-sky-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-3xl mb-1">📂</div>
          <p className="text-sm text-gray-600 font-medium">
            {isDragActive ? 'Drop here…' : 'Drag & drop course files'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, TXT, MD — or click to browse</p>
        </div>

        {newFiles.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {newFiles.map(f => (
              <li key={f.name} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <span>{fileIcon(f.name)}</span>
                <span className="truncate flex-1 text-gray-800">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                <button
                  onClick={() => setNewFiles(prev => prev.filter(x => x.name !== f.name))}
                  disabled={building}
                  className="text-gray-300 hover:text-red-400 ml-1 shrink-0 disabled:opacity-30"
                  aria-label="Remove"
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Student context ──────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Student Context <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={studentContext}
          onChange={e => setStudentContext(e.target.value)}
          rows={4}
          disabled={building}
          placeholder="e.g. I understand the readings separately but struggle to connect case studies, evidence, hypothesis development, and plausibility…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none disabled:opacity-50"
        />
      </div>

      {/* ── Fake progress bar ────────────────────────────────────────────── */}
      {(building || done) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className={done ? 'text-green-600 font-medium' : ''}>{stepLabel}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${done ? 'bg-green-500' : 'bg-sky-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Build button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleBuild}
        disabled={!canBuild}
        className={`w-full py-3 rounded-xl font-semibold text-base transition-colors ${
          done
            ? 'bg-green-500 text-white cursor-default'
            : 'bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {done ? '✓ Wiki Built — switching…' : building ? 'Building Wiki…' : '🚀 Build Wiki'}
      </button>
    </div>
  )
}
