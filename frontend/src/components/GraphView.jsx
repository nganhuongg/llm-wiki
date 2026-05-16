import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'
const THRESHOLD = 0.4

// Non-concept nodes keep their fixed color
const BASE_COLORS = {
  course:      '#0ea5e9',
  source:      '#f59e0b',
  student:     '#10b981',
  study_guide: '#f43f5e',
  bridge:      '#6366f1',
  default:     '#94a3b8',
}

const NODE_LABELS = {
  course:      '🎓 Course',
  concept:     '💡 Concept',
  source:      '📑 Source',
  student:     '👤 Student',
  study_guide: '📋 Study Guide',
  bridge:      '🌉 Bridge',
}

function conceptMasteryColor(score) {
  if (score === undefined || score === null) return '#8b5cf6' // unknown → purple
  if (score > 0.7)       return '#22c55e' // strong → green
  if (score >= THRESHOLD) return '#fbbf24' // fading → amber
  return '#ef4444'                        // forgotten → red
}

export default function GraphView() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [mastery, setMastery]     = useState({})  // slug → score
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [hovered, setHovered]     = useState(null)
  const [stats, setStats]         = useState({ nodes: 0, links: 0 })
  const graphRef = useRef()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [graphRes, masteryRes] = await Promise.all([
        fetch(`${API}/graph`),
        fetch(`${API}/mastery-state?session_id=${encodeURIComponent(SESSION_ID)}`),
      ])

      if (!graphRes.ok) throw new Error('Could not load graph')
      const graphJson   = await graphRes.json()
      const masteryJson = masteryRes.ok ? await masteryRes.json() : { concepts: [] }

      const masteryMap = {}
      for (const c of (masteryJson.concepts ?? [])) {
        masteryMap[c.slug] = c.score
      }
      setMastery(masteryMap)

      const nodes = (graphJson.nodes ?? []).map(n => {
        const isConcept = (n.type ?? 'default') === 'concept'
        const score = masteryMap[n.slug] ?? masteryMap[n.id] ?? masteryMap[n.label]
        return {
          id:    n.id,
          label: n.label ?? n.id,
          type:  n.type ?? 'default',
          score: isConcept ? score : undefined,
          color: isConcept
            ? conceptMasteryColor(score)
            : (BASE_COLORS[n.type] ?? BASE_COLORS.default),
        }
      })
      const links = (graphJson.edges ?? graphJson.links ?? []).map(e => ({
        source: e.source,
        target: e.target,
        label:  e.label ?? '',
      }))
      setGraphData({ nodes, links })
      setStats({ nodes: nodes.length, links: links.length })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const radius = 7
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = node.color
    ctx.fill()

    // Pulse ring for forgotten concepts
    if (node.type === 'concept' && node.score !== undefined && node.score < THRESHOLD) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.stroke()
    }

    if (globalScale >= 1.5 || node === hovered) {
      const label    = node.label
      const fontSize = Math.max(10 / globalScale, 4)
      ctx.font      = `${fontSize}px sans-serif`
      ctx.textAlign      = 'center'
      ctx.textBaseline   = 'top'
      ctx.fillStyle      = '#1e293b'
      ctx.fillText(label, node.x, node.y + radius + 2)
    }
  }, [hovered])

  const empty = !loading && !error && graphData.nodes.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Concept Graph</h1>
          <p className="text-gray-500 text-sm mt-1">
            Concept nodes colored by mastery: green → strong, amber → fading, red → forgotten.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '520px' }}>
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm text-gray-400">Loading graph…</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="h-full flex items-center justify-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {empty && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="text-5xl mb-3">🕸</div>
            <p className="text-gray-500 font-medium">No graph data yet</p>
            <p className="text-gray-400 text-sm mt-1">Ingest course materials to generate the concept graph.</p>
          </div>
        )}
        {!loading && !error && graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={() => '#cbd5e1'}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            onNodeHover={node => setHovered(node)}
            backgroundColor="#ffffff"
            height={520}
          />
        )}
      </div>

      {/* Stats + Legend */}
      <div className="flex flex-wrap gap-4 items-start">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-6 text-sm">
          <div>
            <span className="text-2xl font-bold text-sky-600">{stats.nodes}</span>
            <span className="text-gray-500 ml-1">nodes</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-purple-600">{stats.links}</span>
            <span className="text-gray-500 ml-1">edges</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap gap-3">
          {Object.entries(NODE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: type === 'concept' ? '#8b5cf6' : BASE_COLORS[type] }}
              />
              {label}
            </div>
          ))}
          <div className="border-l border-gray-200 pl-3 flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-500">Concept mastery:</p>
            <div className="flex gap-2">
              {[['#22c55e','Strong'],['#fbbf24','Fading'],['#ef4444','Forgotten']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-sm z-50 max-w-xs">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: hovered.color }}
            />
            <span className="font-semibold text-gray-800">{hovered.label}</span>
          </div>
          <div className="text-gray-500 text-xs">
            {NODE_LABELS[hovered.type] ?? hovered.type}
            {hovered.score !== undefined && (
              <span className="ml-2">· mastery {Math.round(hovered.score * 100)}%</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
