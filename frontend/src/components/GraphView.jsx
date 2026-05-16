import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const API = 'http://localhost:8000'

const NODE_COLORS = {
  course:      '#0ea5e9',
  concept:     '#8b5cf6',
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

export default function GraphView() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [hovered, setHovered]     = useState(null)
  const [stats, setStats]         = useState({ nodes: 0, links: 0 })
  const graphRef = useRef()

  const fetchGraph = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/graph`)
      if (!res.ok) throw new Error('Could not load graph')
      const data = await res.json()

      const nodes = (data.nodes ?? []).map(n => ({
        id: n.id,
        label: n.label ?? n.id,
        type: n.type ?? 'default',
        color: NODE_COLORS[n.type] ?? NODE_COLORS.default,
      }))
      const links = (data.edges ?? data.links ?? []).map(e => ({
        source: e.source,
        target: e.target,
        label: e.label ?? '',
      }))
      setGraphData({ nodes, links })
      setStats({ nodes: nodes.length, links: links.length })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const radius = 6
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = node.color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    if (globalScale >= 1.5 || node === hovered) {
      const label = node.label
      const fontSize = Math.max(10 / globalScale, 4)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#1e293b'
      ctx.fillText(label, node.x, node.y + radius + 2)
    }
  }, [hovered])

  const emptyGraph = !loading && !error && graphData.nodes.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Concept Graph</h1>
          <p className="text-gray-500 text-sm mt-1">
            Visual map of courses, concepts, sources, and bridges.
          </p>
        </div>
        <button
          onClick={fetchGraph}
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

        {emptyGraph && (
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
            width={undefined}
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
                style={{ backgroundColor: NODE_COLORS[type] }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>

      {hovered && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-sm z-50 max-w-xs">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: NODE_COLORS[hovered.type] }}
            />
            <span className="font-semibold text-gray-800">{hovered.label}</span>
          </div>
          <div className="text-gray-500 text-xs">
            {NODE_LABELS[hovered.type] ?? hovered.type}
          </div>
        </div>
      )}
    </div>
  )
}
