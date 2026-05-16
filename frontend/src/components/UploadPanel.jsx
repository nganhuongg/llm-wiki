import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

const API = 'http://localhost:8000'

export default function UploadPanel({ onWikiBuilt }) {
  const [files, setFiles]               = useState([])
  const [studentContext, setStudentContext] = useState('')
  const [status, setStatus]             = useState('idle') // idle | uploading | building | done | error
  const [message, setMessage]           = useState('')

  const onDrop = useCallback(accepted => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...accepted.filter(f => !existing.has(f.name))]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
  })

  const removeFile = name => setFiles(prev => prev.filter(f => f.name !== name))

  const handleBuild = async () => {
    if (files.length === 0) {
      setMessage('Please upload at least one course material.')
      return
    }
    try {
      setStatus('uploading')
      setMessage('Uploading files...')

      // Ingest each file
      for (const file of files) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${API}/ingest`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(`Failed to ingest ${file.name}`)
      }

      // Save student context if provided
      if (studentContext.trim()) {
        setMessage('Saving student context...')
        const res = await fetch(`${API}/student-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: studentContext }),
        })
        if (!res.ok) throw new Error('Failed to save student context')
      }

      setStatus('done')
      setMessage(`Successfully ingested ${files.length} file(s) and built the wiki.`)
      onWikiBuilt()
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  const statusColors = {
    idle:      '',
    uploading: 'text-sky-600',
    building:  'text-amber-600',
    done:      'text-green-600',
    error:     'text-red-600',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ingest Course Materials</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Upload syllabi, readings, or notes. Then add a short student context to personalize your wiki.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-sky-500 bg-sky-50'
            : 'border-gray-300 hover:border-sky-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-2">📂</div>
        <p className="text-gray-600 font-medium">
          {isDragActive ? 'Drop files here…' : 'Drag & drop course files here'}
        </p>
        <p className="text-gray-400 text-sm mt-1">PDF, TXT, MD, DOCX — or click to browse</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map(f => (
            <li key={f.name} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-2 text-sm">
              <span className="text-gray-700 truncate mr-2">{f.name}</span>
              <span className="text-gray-400 text-xs mr-auto">{(f.size / 1024).toFixed(1)} KB</span>
              <button
                onClick={() => removeFile(f.name)}
                className="text-gray-400 hover:text-red-500 ml-3"
                aria-label="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Student context */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Student Context <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={studentContext}
          onChange={e => setStudentContext(e.target.value)}
          rows={4}
          placeholder="e.g. I struggle with hypothesis testing and often confuse claims, evidence, and interpretation. My main courses are Statistics, Biology, and Academic Writing."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Describe your weak topics, goals, or courses. This personalizes the wiki just for you.
        </p>
      </div>

      {/* Build button */}
      <button
        onClick={handleBuild}
        disabled={status === 'uploading' || status === 'building'}
        className="w-full py-3 rounded-xl bg-sky-600 text-white font-semibold text-base hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'uploading' ? 'Uploading…' : status === 'building' ? 'Building Wiki…' : '🚀 Build Wiki'}
      </button>

      {/* Status message */}
      {message && (
        <p className={`text-sm text-center ${statusColors[status]}`}>{message}</p>
      )}

      {/* Demo hint */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-sm text-sky-700">
        <strong>Demo tip:</strong> Upload 2–4 course syllabi and add a short student note, then click Build Wiki. The system will extract concepts, create wiki pages, and build a personalized knowledge base for you.
      </div>
    </div>
  )
}
