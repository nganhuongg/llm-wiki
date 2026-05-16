import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const API = 'http://localhost:8000'

const EXAMPLE_QUERIES = [
  'How does correlation in statistics relate to research methods in psychology?',
  'Explain evidence in a way that connects psychology, statistics, and writing.',
  'Which topics should I review first based on what I find confusing?',
  'What do I need to understand before hypothesis testing?',
]

export default function QueryBox() {
  const [query, setQuery]       = useState('')
  const [answer, setAnswer]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [saveMsg, setSaveMsg]   = useState('')
  const [savedPath, setSavedPath] = useState('')

  const handleQuery = async (q) => {
    const text = q ?? query
    if (!text.trim()) return
    setQuery(text)
    setAnswer(null)
    setSaveStatus('idle')
    setSavedPath('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setAnswer(data)
    } catch (e) {
      setAnswer({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!answer?.answer) return
    setSaveStatus('saving')
    setSaveMsg('')
    try {
      const res = await fetch(`${API}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, answer: answer.answer }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setSaveStatus('saved')
      setSavedPath(data.path ?? '')
      setSaveMsg(`Saved as ${data.path ?? 'study guide'}`)
    } catch (e) {
      setSaveStatus('error')
      setSaveMsg(e.message)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Query Your Wiki</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Ask any question. The system retrieves relevant wiki pages and generates a personalized answer.
        </p>
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
        <p className="text-xs text-gray-500 mb-2 font-medium">Example questions:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => handleQuery(q)}
              className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:border-sky-400 hover:text-sky-600 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Answer */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="inline-block w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">Searching wiki and generating answer…</p>
        </div>
      )}

      {answer && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {answer.error ? (
            <div className="p-6 text-red-500 text-sm">{answer.error}</div>
          ) : (
            <>
              {/* Sources */}
              {answer.sources?.length > 0 && (
                <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500 font-medium">Sources:</span>
                  {answer.sources.map(s => (
                    <span key={s} className="text-xs bg-sky-50 text-sky-700 border border-sky-100 rounded-full px-2 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Answer body */}
              <div className="px-6 py-5 prose-wiki max-w-none">
                <ReactMarkdown>{answer.answer}</ReactMarkdown>
              </div>

              {/* Save as study guide */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {saveStatus === 'saved' && (
                    <span className="text-green-600">✓ {saveMsg}</span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-red-500">{saveMsg}</span>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg border border-sky-300 text-sky-600 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'saved'
                    ? '✓ Saved as Study Guide'
                    : '💾 Save as Study Guide'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
