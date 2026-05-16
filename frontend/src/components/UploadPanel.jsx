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
function fileIcon(name) { return FILE_ICONS[name.split('.').pop().toLowerCase()] ?? '📁' }
function fmtSize(b) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export default function UploadPanel({ onWikiBuilt }) {
  // Pre-existing assets from assets/ folder
  const [assets, setAssets]           = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [loadingAssets, setLoadingAssets] = useState(true)

  // New files dragged/clicked in
  const [newFiles, setNewFiles]       = useState([])  // { file, status: 'pending'|'uploaded'|'error', msg }

  const [studentContext, setStudentContext] = useState('')
  const [buildStatus, setBuildStatus] = useState('idle') // idle | running | done | error
  const [buildMsg, setBuildMsg]       = useState('')
  const [progress, setProgress]       = useState('')

  // ── Load assets ─────────────────────────────────────────────────────────────
  const loadAssets = useCallback(async () => {
    setLoadingAssets(true)
    try {
      const res = await fetch(`${API}/assets`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const files = data.files ?? []
      setAssets(files)
      setSelected(new Set(files.map(f => f.name)))
    } catch {
      setAssets([])
    } finally {
      setLoadingAssets(false)
    }
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  // ── Dropzone ─────────────────────────────────────────────────────────────────
  const onDrop = useCallback(accepted => {
    setNewFiles(prev => {
      const existing = new Set(prev.map(f => f.file.name))
      const fresh = accepted
        .filter(f => !existing.has(f.name))
        .map(f => ({ file: f, status: 'pending', msg: '' }))
      return [...prev, ...fresh]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  })

  const removeNew = name =>
    setNewFiles(prev => prev.filter(f => f.file.name !== name))

  // ── Asset selection ───────────────────────────────────────────────────────────
  const toggleAll = () =>
    setSelected(selected.size === assets.length ? new Set() : new Set(assets.map(f => f.name)))
  const toggle = name => {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    setSelected(next)
  }

  // ── Build Wiki ───────────────────────────────────────────────────────────────
  const handleBuild = async () => {
    const selectedAssets = [...selected]
    if (selectedAssets.length === 0 && newFiles.length === 0) {
      setBuildMsg('Select or upload at least one file.')
      setBuildStatus('error')
      return
    }
    setBuildStatus('running')
    setBuildMsg('')
    try {
      // 1. Upload any new dragged-in files (backend saves them to assets/)
      for (let i = 0; i < newFiles.length; i++) {
        const entry = newFiles[i]
        setProgress(`Uploading ${i + 1}/${newFiles.length}: ${entry.file.name}`)
        const form = new FormData()
        form.append('file', entry.file)
        const res = await fetch(`${API}/ingest?session_id=${encodeURIComponent(SESSION_ID)}`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(`Failed to upload ${entry.file.name}`)
        setNewFiles(prev => prev.map(f =>
          f.file.name === entry.file.name ? { ...f, status: 'uploaded' } : f
        ))
      }

      // 2. Ingest selected pre-existing assets
      for (let i = 0; i < selectedAssets.length; i++) {
        const name = selectedAssets[i]
        setProgress(`Ingesting ${i + 1}/${selectedAssets.length}: ${name}`)
        const res = await fetch(`${API}/ingest-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: name, session_id: SESSION_ID }),
        })
        if (!res.ok) throw new Error(`Failed to ingest ${name}`)
      }

      // 3. Student context
      if (studentContext.trim()) {
        setProgress('Saving student context…')
        await fetch(`${API}/student-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: studentContext, session_id: SESSION_ID }),
        })
      }

      setBuildStatus('done')
      setProgress('')
      setBuildMsg(`Wiki built from ${selectedAssets.length} asset(s) and ${newFiles.length} upload(s).`)
      await loadAssets() // refresh asset list in case new files were added
      onWikiBuilt()
    } catch (err) {
      setBuildStatus('error')
      setProgress('')
      setBuildMsg(err.message)
    }
  }

  const busy = buildStatus === 'running'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ingest Course Materials</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Select files already in <code className="bg-gray-100 px-1 rounded text-xs">assets/</code> or
          drag in new ones. Add a student note, then click Build Wiki.
        </p>
      </div>

      {/* ── Pre-existing assets ─────────────────────────────────────────────── */}
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
                    disabled={busy}
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

      {/* ── Upload new files ────────────────────────────────────────────────── */}
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
            {newFiles.map(({ file, status }) => (
              <li key={file.name} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <span>{fileIcon(file.name)}</span>
                <span className="truncate flex-1 text-gray-800">{file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{fmtSize(file.size)}</span>
                <span className="text-xs shrink-0">
                  {status === 'uploaded' ? '✓' : status === 'error' ? '✗' : ''}
                </span>
                {status === 'pending' && (
                  <button
                    onClick={() => removeNew(file.name)}
                    className="text-gray-300 hover:text-red-400 ml-1 shrink-0"
                    aria-label="Remove"
                  >✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Student context ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Student Context <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={studentContext}
          onChange={e => setStudentContext(e.target.value)}
          rows={4}
          disabled={busy}
          placeholder="e.g. I understand the readings separately but struggle to connect case studies, evidence, hypothesis development, and plausibility…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 mt-1">
          Describe weak topics, goals, or courses — this personalizes the wiki for you.
        </p>
      </div>

      {/* ── Progress ────────────────────────────────────────────────────────── */}
      {progress && (
        <div className="flex items-center gap-2 text-sm text-sky-600">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
          {progress}
        </div>
      )}

      {/* ── Build button ─────────────────────────────────────────────────────── */}
      <button
        onClick={handleBuild}
        disabled={busy || (selected.size === 0 && newFiles.length === 0)}
        className="w-full py-3 rounded-xl bg-sky-600 text-white font-semibold text-base hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? 'Building Wiki…' : '🚀 Build Wiki'}
      </button>

      {buildMsg && !progress && (
        <p className={`text-sm text-center ${buildStatus === 'done' ? 'text-green-600' : 'text-red-500'}`}>
          {buildMsg}
        </p>
      )}
    </div>
  )
}
