import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'

const SEVERITY_CONFIG = {
  error:   { color: 'bg-red-50 border-red-200 text-red-700',   dot: 'bg-red-500',   label: 'Error' },
  warning: { color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', label: 'Warning' },
  info:    { color: 'bg-sky-50 border-sky-200 text-sky-700',   dot: 'bg-sky-500',   label: 'Info' },
}

function LintItem({ issue }) {
  const sev = SEVERITY_CONFIG[issue.severity ?? 'warning']
  return (
    <div className={`rounded-lg border px-4 py-3 flex gap-3 items-start ${sev.color}`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />
      <div className="min-w-0">
        <p className="font-medium text-sm">{issue.title}</p>
        {issue.detail && (
          <p className="text-xs mt-0.5 opacity-80">{issue.detail}</p>
        )}
        {issue.pages?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {issue.pages.map(p => (
              <span key={p} className="text-xs font-mono bg-white/60 border border-current/30 rounded px-1.5 py-0.5">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="ml-auto shrink-0 text-xs font-medium opacity-60 self-start mt-0.5">{sev.label}</span>
    </div>
  )
}

export default function LintReport() {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('all')

  const runLint = async () => {
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const res = await fetch(`${API}/lint`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setReport(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runLint() }, [])

  const issues = report?.issues ?? []
  const counts = {
    error:   issues.filter(i => i.severity === 'error').length,
    warning: issues.filter(i => (i.severity ?? 'warning') === 'warning').length,
    info:    issues.filter(i => i.severity === 'info').length,
  }
  const filtered = filter === 'all' ? issues : issues.filter(i => (i.severity ?? 'warning') === filter)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lint Report</h1>
          <p className="text-gray-500 text-sm mt-1">
            Checks wiki health: missing pages, orphans, weak bridges, and personalization gaps.
          </p>
        </div>
        <button
          onClick={runLint}
          disabled={loading}
          className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running…' : '▶ Run Lint'}
        </button>
      </div>

      {/* Summary pills */}
      {report && (
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'all',     label: 'All',       count: issues.length, style: 'bg-gray-100 text-gray-700 border-gray-200' },
            { key: 'error',   label: 'Errors',    count: counts.error,   style: 'bg-red-50 text-red-700 border-red-200' },
            { key: 'warning', label: 'Warnings',  count: counts.warning, style: 'bg-amber-50 text-amber-700 border-amber-200' },
            { key: 'info',    label: 'Info',       count: counts.info,   style: 'bg-sky-50 text-sky-700 border-sky-200' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${tab.style} ${
                filter === tab.key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 font-bold">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Status / content */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-400">Analyzing wiki…</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-600 text-sm">
          {error}
        </div>
      )}

      {report && !loading && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-700 font-medium">
                {filter === 'all' ? 'Wiki looks healthy — no issues found!' : `No ${filter}s found.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((issue, i) => (
                <LintItem key={i} issue={issue} />
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-400 text-right">
            {report.generated_at && <>Report generated {new Date(report.generated_at).toLocaleString()}</>}
            {report.wiki_page_count != null && <> · {report.wiki_page_count} pages scanned</>}
          </div>
        </>
      )}
    </div>
  )
}
