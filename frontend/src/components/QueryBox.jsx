import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import SkillDiff from './SkillDiff'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'

const EXAMPLE_QUERIES = [
  'Help me explain why the Zika microcephaly reading is a case study, and connect it to evidence-based argument, hypothesis development, and plausibility.',
  'How does hypothesis development connect to research design and plausibility?',
  'Which topics should I review first based on what I find confusing?',
  'Explain evidence-based argument using something I already understand.',
]

const RATING_OPTIONS = [
  { value: 0.1, label: '0.1', desc: 'Not helpful' },
  { value: 0.3, label: '0.3', desc: 'A bit off'   },
  { value: 0.5, label: '0.5', desc: 'Okay'         },
  { value: 0.7, label: '0.7', desc: 'Good'         },
  { value: 0.9, label: '0.9', desc: 'Great'        },
  { value: 1.0, label: '1.0', desc: 'Perfect'      },
]

function RatingWidget({ onRate, disabled }) {
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const submit = async (value) => {
    setSelected(value)
    setSubmitted(true)
    await onRate(value)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">Rate this answer (0 → 1):</p>
      <div className="flex gap-2 flex-wrap">
        {RATING_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => submit(opt.value)}
            disabled={disabled || submitted}
            title={opt.desc}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border transition-all ${
              selected === opt.value
                ? opt.value >= 0.7
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-red-400 border-red-400 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:border-sky-400 hover:text-sky-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {submitted && selected !== null && (
        <p className={`text-xs mt-1.5 ${selected >= 0.7 ? 'text-green-600' : 'text-amber-600'}`}>
          Rated {selected} — {selected < 0.7 ? 'click "Improve" to refine the skill.' : 'great answer logged.'}
        </p>
      )}
    </div>
  )
}

export default function QueryBox() {
  const [query, setQuery]           = useState('')
  const [answer, setAnswer]         = useState(null)
  const [loading, setLoading]       = useState(false)

  const [rating, setRating]         = useState(null)
  const [rateStatus, setRateStatus] = useState('idle') // idle | rating | rated

  const [improving, setImproving]   = useState(false)
  const [diff, setDiff]             = useState(null)   // { before, after }

  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveMsg, setSaveMsg]       = useState('')

  const resetAnswerState = () => {
    setAnswer(null)
    setRating(null)
    setRateStatus('idle')
    setDiff(null)
    setSaveStatus('idle')
    setSaveMsg('')
  }

  const handleQuery = async (q) => {
    const text = q ?? query
    if (!text.trim()) return
    setQuery(text)
    resetAnswerState()
    setLoading(true)
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, session_id: SESSION_ID }),
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

  const handleRate = async (score) => {
    setRating(score)
    setRateStatus('rating')
    try {
      await fetch(`${API}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          answer: answer?.answer ?? '',
          score,
          session_id: SESSION_ID,
        }),
      })
    } catch { /* non-fatal — mastery still updated locally */ }
    setRateStatus('rated')
  }

  const handleImprove = async () => {
    setImproving(true)
    setDiff(null)
    try {
      const res = await fetch(`${API}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, session_id: SESSION_ID }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setDiff({ before: data.before, after: data.after })
    } catch (e) {
      setDiff({ error: e.message })
    } finally {
      setImproving(false)
    }
  }

  const handleSave = async () => {
    if (!answer?.answer) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`${API}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, answer: answer.answer, session_id: SESSION_ID }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setSaveStatus('saved')
      setSaveMsg(`Saved as ${data.path ?? 'study guide'}`)
    } catch (e) {
      setSaveStatus('error')
      setSaveMsg(e.message)
    }
  }

  const showImprove = rateStatus === 'rated' && rating !== null && rating < 0.7

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Query Your Wiki</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Ask a question, rate the answer, then improve the skill — the core self-improvement loop.
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
        <p className="text-xs text-gray-500 mb-2 font-medium">Demo questions:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => handleQuery(q)}
              className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:border-sky-400 hover:text-sky-600 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="inline-block w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">Searching wiki and generating answer…</p>
        </div>
      )}

      {/* Answer */}
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

              {/* Rating + actions */}
              <div className="px-5 py-4 border-t border-gray-100 space-y-4">
                {/* Rating widget */}
                <RatingWidget onRate={handleRate} disabled={rateStatus !== 'idle'} />

                <div className="flex items-center justify-between flex-wrap gap-3">
                  {/* Save */}
                  <div className="text-xs text-gray-500">
                    {saveStatus === 'saved' && <span className="text-green-600">✓ {saveMsg}</span>}
                    {saveStatus === 'error' && <span className="text-red-500">{saveMsg}</span>}
                  </div>

                  <div className="flex gap-2">
                    {/* Improve button — only when rating < 0.7 */}
                    {showImprove && (
                      <button
                        onClick={handleImprove}
                        disabled={improving}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {improving ? 'Improving…' : '✨ Improve Skill'}
                      </button>
                    )}

                    <button
                      onClick={handleSave}
                      disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                      className="px-4 py-1.5 text-xs font-medium rounded-lg border border-sky-300 text-sky-600 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : '💾 Save as Study Guide'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Skill diff */}
      {diff && !diff.error && <SkillDiff before={diff.before} after={diff.after} />}
      {diff?.error && (
        <p className="text-xs text-red-500 text-center">Could not load skill diff: {diff.error}</p>
      )}
    </div>
  )
}
