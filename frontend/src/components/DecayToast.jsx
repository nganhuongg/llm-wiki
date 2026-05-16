import { useState, useEffect, useRef } from 'react'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'

function Toast({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 350)
    }, 9000)
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [])

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss(toast.id), 350)
  }

  const pct = Math.round((toast.score ?? 0) * 100)

  return (
    <div
      className={`w-80 bg-white rounded-2xl border-2 border-red-300 shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="h-1.5 bg-gradient-to-r from-red-500 to-red-400" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-700 leading-tight">You're losing this</p>
              <p className="text-xs text-gray-400 mt-0.5">Mastery dropped to {pct}% — below threshold</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >✕</button>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-sm font-bold text-gray-800 capitalize mb-1">
            {(toast.concept ?? '').replace(/_/g, ' ')}
          </p>
          {toast.excerpt && (
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{toast.excerpt}</p>
          )}
          {toast.knownAsOf && (
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-red-100">
              Your past self knew this at{' '}
              <span className="font-medium text-gray-600">
                {new Date(toast.knownAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          )}
        </div>

        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full animate-pulse"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Accepts either mock toasts from App state, or real SSE events from backend
export default function DecayToast({ toasts: mockToasts = [], onDismiss: mockDismiss }) {
  const [sseToasts, setSseToasts] = useState([])
  const esRef = useRef(null)

  // Try SSE — silently ignore if backend is not running
  useEffect(() => {
    try {
      const es = new EventSource(
        `${API}/events/decay?session_id=${encodeURIComponent(SESSION_ID)}`
      )
      esRef.current = es
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          setSseToasts(prev => [
            ...prev.slice(-2),
            {
              id:       Date.now(),
              concept:  d.concept,
              score:    d.score ?? 0,
              excerpt:  d.page_excerpt ?? (d.page_content ?? '').slice(0, 220),
              knownAsOf: d.known_as_of,
            },
          ])
        } catch { /* malformed event — ignore */ }
      }
      es.onerror = () => es.close()
    } catch { /* browser blocked SSE — ignore */ }
    return () => esRef.current?.close()
  }, [])

  const dismissSse = id => setSseToasts(prev => prev.filter(t => t.id !== id))

  const all = [...mockToasts, ...sseToasts]
  if (!all.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3">
      {mockToasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={mockDismiss} />
      ))}
      {sseToasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={dismissSse} />
      ))}
    </div>
  )
}
