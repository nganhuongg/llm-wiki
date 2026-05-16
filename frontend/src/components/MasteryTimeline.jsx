import { useState, useEffect, useRef } from 'react'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'
const THRESHOLD = 0.4

function masteryStyle(score) {
  if (score > 0.7)        return { bar: '#22c55e', label: 'Strong',    text: '#15803d' }
  if (score >= THRESHOLD) return { bar: '#fbbf24', label: 'Fading',    text: '#b45309' }
  return                         { bar: '#ef4444', label: 'Forgotten', text: '#b91c1c' }
}

function MasteryBar({ slug, score, knownAsOf }) {
  const pct = Math.round(score * 100)
  const { bar, label, text } = masteryStyle(score)
  const fading = score < THRESHOLD

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-base font-semibold text-gray-800 capitalize">
          {slug.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-3">
          {knownAsOf && (
            <span className="text-xs text-gray-400">
              known {new Date(knownAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: text }}>
            {label} {pct}%
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-6 bg-gray-100 rounded-full overflow-visible">
        {/* Threshold marker at 40% */}
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10"
          style={{ left: `${THRESHOLD * 100}%`, backgroundColor: '#f87171' }}
        >
          <span className="absolute -top-5 left-1 text-xs text-red-400 whitespace-nowrap">40%</span>
        </div>

        {/* Score bar */}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${fading ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: bar }}
        />
      </div>
    </div>
  )
}

export default function MasteryTimeline({ masteryState = [] }) {
  const [apiConcepts, setApiConcepts] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [updated, setUpdated]         = useState(null)
  const timerRef = useRef(null)

  // Use prop data when available; only poll API as fallback
  const useProp = masteryState.length > 0

  const poll = async () => {
    try {
      const res = await fetch(`${API}/mastery-state?session_id=${encodeURIComponent(SESSION_ID)}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setApiConcepts(data.concepts ?? [])
      setUpdated(new Date())
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (useProp) { setLoading(false); return }
    poll()
    timerRef.current = setInterval(poll, 2000)
    return () => clearInterval(timerRef.current)
  }, [useProp])

  // When prop is provided, treat it as always-fresh
  useEffect(() => {
    if (useProp) setUpdated(new Date())
  }, [masteryState])

  const concepts = useProp
    ? masteryState.map(c => ({ slug: c.slug, score: c.score, known_as_of: c.knownAsOf }))
    : apiConcepts

  const sorted = [...concepts].sort((a, b) => a.score - b.score)
  const strong    = concepts.filter(c => c.score > 0.7).length
  const fading    = concepts.filter(c => c.score >= THRESHOLD && c.score <= 0.7).length
  const forgotten = concepts.filter(c => c.score < THRESHOLD).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mastery State</h1>
          <p className="text-gray-500 text-sm mt-1">
            {useProp
              ? 'Decays as you forget, grows as you review. Live from session.'
              : 'Live from Redis — decays as you forget, grows as you review. Polled every 2 s.'}
          </p>
        </div>
        {updated && (
          <span className="text-xs text-gray-400 mt-1 shrink-0">
            {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Summary cards */}
      {concepts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <div className="text-3xl font-bold text-green-700">{strong}</div>
            <div className="text-xs text-green-600 mt-1 font-medium">Strong &gt; 70%</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <div className="text-3xl font-bold text-amber-600">{fading}</div>
            <div className="text-xs text-amber-600 mt-1 font-medium">Fading 40–70%</div>
          </div>
          <div className={`border rounded-xl px-4 py-3 text-center ${forgotten > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`text-3xl font-bold ${forgotten > 0 ? 'text-red-600' : 'text-gray-400'}`}>{forgotten}</div>
            <div className={`text-xs mt-1 font-medium ${forgotten > 0 ? 'text-red-500' : 'text-gray-400'}`}>Forgotten &lt; 40%</div>
          </div>
        </div>
      )}

      {/* Bars panel */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 pt-6 pb-2">
        {loading && (
          <div className="py-12 text-center">
            <div className="inline-block w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-400">Fetching mastery state from Redis…</p>
          </div>
        )}
        {error && !loading && (
          <p className="py-10 text-center text-sm text-red-400">
            Could not load mastery state: {error}
          </p>
        )}
        {!loading && !error && concepts.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-5xl mb-3">🧠</div>
            <p className="text-gray-500 font-medium">No mastery data yet</p>
            <p className="text-gray-400 text-sm mt-1">Ingest course materials to seed mastery state.</p>
          </div>
        )}
        {sorted.map(c => (
          <MasteryBar key={c.slug} slug={c.slug} score={c.score} knownAsOf={c.known_as_of} />
        ))}
      </div>

      {/* Legend */}
      {concepts.length > 0 && (
        <div className="flex flex-wrap items-center gap-5 text-xs text-gray-500 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Strong (&gt; 70%)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Fading (40–70%)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Forgotten (&lt; 40%)
          </div>
          <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-4">
            <span className="w-0.5 h-4 bg-red-400 inline-block rounded" />
            40% threshold line
          </div>
        </div>
      )}
    </div>
  )
}
