import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { SESSION_ID } from '../session'

const API = 'http://localhost:8000'
const THRESHOLD = 0.4

const NODE_RADIUS = { course: 11, concept: 9, source: 6, student: 9, study_guide: 6, bridge: 8, default: 6 }

const BASE_COLORS = {
  course:      '#0ea5e9',
  source:      '#f59e0b',
  student:     '#10b981',
  study_guide: '#f43f5e',
  bridge:      '#6366f1',
  default:     '#94a3b8',
}

const TYPE_META = {
  course:      { icon: '🎓', label: 'Course'        },
  concept:     { icon: '💡', label: 'Concept'       },
  source:      { icon: '📑', label: 'Source'        },
  student:     { icon: '👤', label: 'Student'       },
  study_guide: { icon: '📋', label: 'Study Guide'   },
  bridge:      { icon: '🌉', label: 'Bridge'        },
}

function conceptColor(score) {
  if (score === undefined || score === null) return '#8b5cf6'
  if (score > 0.7)        return '#22c55e'
  if (score >= THRESHOLD) return '#fbbf24'
  return '#ef4444'
}

// ── Mock EA51 graph ───────────────────────────────────────────────────────────
const MOCK_NODES = [
  { id: 'ea51',                    label: 'EA51 Course',            type: 'course'  },
  { id: 'case_study',              label: 'Case Study',             type: 'concept' },
  { id: 'plausibility',            label: 'Plausibility',           type: 'concept' },
  { id: 'hypothesis_development',  label: 'Hypothesis Dev.',        type: 'concept' },
  { id: 'evidence_based_argument', label: 'Evidence-Based Arg.',    type: 'concept' },
  { id: 'research_design',         label: 'Research Design',        type: 'concept' },
  { id: 'confounders',             label: 'Confounders',            type: 'concept' },
  { id: 'zika_src',                label: 'Zika Case Study',        type: 'source'  },
  { id: 'research_src',            label: 'Research Design PDF',    type: 'source'  },
  { id: 'hypothesis_src',          label: 'Hypothesis Dev. PDF',    type: 'source'  },
  { id: 'plausibility_src',        label: 'Plausibility PDF',       type: 'source'  },
  { id: 'evidence_src',            label: 'Evidence-Based PDF',     type: 'source'  },
  { id: 'student',                 label: 'Student Profile',        type: 'student' },
  { id: 'zika_bridge',             label: 'Zika Bridge',            type: 'bridge'  },
]

const MOCK_LINKS = [
  { source: 'ea51', target: 'case_study' },
  { source: 'ea51', target: 'plausibility' },
  { source: 'ea51', target: 'hypothesis_development' },
  { source: 'ea51', target: 'evidence_based_argument' },
  { source: 'ea51', target: 'research_design' },
  { source: 'ea51', target: 'confounders' },
  { source: 'student', target: 'ea51' },
  { source: 'zika_src', target: 'case_study' },
  { source: 'zika_src', target: 'plausibility' },
  { source: 'zika_src', target: 'hypothesis_development' },
  { source: 'research_src', target: 'research_design' },
  { source: 'research_src', target: 'confounders' },
  { source: 'hypothesis_src', target: 'hypothesis_development' },
  { source: 'plausibility_src', target: 'plausibility' },
  { source: 'evidence_src', target: 'evidence_based_argument' },
  { source: 'case_study', target: 'evidence_based_argument' },
  { source: 'hypothesis_development', target: 'plausibility' },
  { source: 'hypothesis_development', target: 'research_design' },
  { source: 'confounders', target: 'research_design' },
  { source: 'zika_bridge', target: 'case_study' },
  { source: 'zika_bridge', target: 'hypothesis_development' },
  { source: 'zika_bridge', target: 'plausibility' },
]

// ── Node info side panel ──────────────────────────────────────────────────────
function NodePanel({ node, links, masteryMap, onClose }) {
  const getId = n => (typeof n === 'object' && n !== null ? n.id : n)
  const neighbors = links
    .filter(l => getId(l.source) === node.id || getId(l.target) === node.id)
    .map(l => getId(l.source) === node.id ? getId(l.target) : getId(l.source))

  const score = node.type === 'concept' ? masteryMap[node.id] : undefined
  const pct   = score !== undefined ? Math.round(score * 100) : null
  const color = score !== undefined ? conceptColor(score) : null
  const critical = score !== undefined && score < THRESHOLD
  const meta = TYPE_META[node.type] ?? { icon: '⚙', label: node.type }

  return (
    <div className="w-56 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden self-start">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Node info</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm leading-none">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Identity */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{meta.icon}</span>
            <span className="text-xs text-gray-400 font-medium">{meta.label}</span>
          </div>
          <p className="text-sm font-bold text-gray-800 leading-tight capitalize">
            {(node.label ?? node.id).replace(/_/g, ' ')}
          </p>
        </div>

        {/* Mastery bar — concepts only */}
        {pct !== null && (
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-500">Mastery</span>
              <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
            </div>
            <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 w-px bg-red-300 z-10" style={{ left: '40%' }} />
              <div
                className={`h-full rounded-full transition-all duration-700 ${critical ? 'animate-pulse' : ''}`}
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <p className={`text-xs mt-1 font-medium ${critical ? 'text-red-500' : score > 0.7 ? 'text-green-600' : 'text-amber-600'}`}>
              {critical ? '⚠ Below threshold — review now' : score > 0.7 ? 'Strong' : 'Fading'}
            </p>
          </div>
        )}

        {/* Connections */}
        {neighbors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">
              Connected to <span className="text-gray-400 font-normal">({neighbors.length})</span>
            </p>
            <div className="space-y-1">
              {neighbors.map(nid => (
                <div key={nid} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block shrink-0" />
                  <span className="capitalize truncate">{nid.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GraphView({ masteryState = [] }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading]     = useState(true)
  const [demoMode, setDemoMode]   = useState(false)
  const [selected, setSelected]   = useState(null)
  const [hovered, setHovered]     = useState(null)

  // Refs so nodeCanvasObject stays stable while always reading fresh values
  const masteryRef  = useRef({})
  const selectedRef = useRef(null)
  const hoveredRef  = useRef(null)
  const graphRef    = useRef()

  useEffect(() => {
    masteryRef.current = Object.fromEntries(masteryState.map(c => [c.slug, c.score]))
  }, [masteryState])

  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { hoveredRef.current  = hovered  }, [hovered])

  // Derived mastery map for NodePanel (React render, not canvas)
  const masteryMap = Object.fromEntries(masteryState.map(c => [c.slug, c.score]))

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setSelected(null)
    try {
      const res = await fetch(`${API}/graph`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      const nodes = (json.nodes ?? []).map(n => ({ id: n.id, label: n.label ?? n.id, type: n.type ?? 'default' }))
      const links = (json.edges ?? json.links ?? []).map(e => ({ source: e.source, target: e.target }))
      setGraphData({ nodes, links })
      setDemoMode(false)
    } catch {
      setGraphData({ nodes: MOCK_NODES, links: MOCK_LINKS })
      setDemoMode(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGraph() }, [loadGraph])

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isConcept = node.type === 'concept'
    const score  = isConcept ? masteryRef.current[node.id] : undefined
    const color  = isConcept ? conceptColor(score) : (BASE_COLORS[node.type] ?? BASE_COLORS.default)
    const r      = NODE_RADIUS[node.type] ?? 6
    const isSelected = node.id === selectedRef.current?.id
    const isHovered  = node.id === hoveredRef.current?.id
    const critical   = isConcept && score !== undefined && score < THRESHOLD

    // Glow halo for critical concepts
    if (critical) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(239,68,68,0.12)'
      ctx.fill()
    }

    // Selection / hover ring
    if (isSelected || isHovered) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 3.5, 0, 2 * Math.PI)
      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#94a3b8'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Label — always visible, scale-aware
    const label    = node.label ?? node.id.replace(/_/g, ' ')
    const fontSize = Math.min(12, Math.max(4, 10 / globalScale))
    ctx.font          = `${isSelected ? 'bold ' : ''}${fontSize}px sans-serif`
    ctx.textAlign     = 'center'
    ctx.textBaseline  = 'top'
    ctx.fillStyle     = '#1e293b'
    ctx.fillText(label, node.x, node.y + r + 2)
  }, [])

  const counts = { nodes: graphData.nodes.length, links: graphData.links.length }
  const conceptNodes = graphData.nodes.filter(n => n.type === 'concept')
  const strong    = conceptNodes.filter(n => (masteryMap[n.id] ?? 1) > 0.7).length
  const fading    = conceptNodes.filter(n => { const s = masteryMap[n.id]; return s !== undefined && s >= THRESHOLD && s <= 0.7 }).length
  const forgotten = conceptNodes.filter(n => { const s = masteryMap[n.id]; return s !== undefined && s < THRESHOLD }).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Concept Graph</h1>
          <p className="text-gray-500 text-sm mt-1">
            Concept nodes colored by mastery — green strong, amber fading, red forgotten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {demoMode && (
            <span className="text-xs text-amber-500 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">demo</span>
          )}
          <button
            onClick={loadGraph}
            disabled={loading}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Main area: graph + optional node panel */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '520px' }}>
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-sm text-gray-400">Loading graph…</p>
              </div>
            </div>
          )}

          {!loading && graphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeCanvasObject={nodeCanvasObject}
              nodeCanvasObjectMode={() => 'replace'}
              linkColor={() => '#e2e8f0'}
              linkWidth={1.2}
              linkDirectionalArrowLength={5}
              linkDirectionalArrowRelPos={1}
              linkDirectionalArrowColor={() => '#cbd5e1'}
              onNodeClick={node => setSelected(prev => prev?.id === node.id ? null : node)}
              onNodeHover={node => setHovered(node)}
              onBackgroundClick={() => setSelected(null)}
              backgroundColor="#ffffff"
              height={520}
              cooldownTicks={120}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.4}
            />
          )}
        </div>

        {/* Node info panel */}
        {selected && (
          <NodePanel
            node={selected}
            links={graphData.links}
            masteryMap={masteryMap}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3 items-start">
        {/* Node / edge counts */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-5 text-sm">
          <div>
            <span className="text-2xl font-bold text-sky-600">{counts.nodes}</span>
            <span className="text-gray-500 ml-1 text-xs">nodes</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-purple-500">{counts.links}</span>
            <span className="text-gray-500 ml-1 text-xs">edges</span>
          </div>
        </div>

        {/* Concept mastery summary */}
        {conceptNodes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{strong}</div>
              <div className="text-xs text-gray-400 mt-0.5">Strong</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-500">{fading}</div>
              <div className="text-xs text-gray-400 mt-0.5">Fading</div>
            </div>
            <div className={`text-center ${forgotten > 0 ? '' : 'opacity-40'}`}>
              <div className={`text-xl font-bold ${forgotten > 0 ? 'text-red-500' : 'text-gray-400'}`}>{forgotten}</div>
              <div className="text-xs text-gray-400 mt-0.5">Forgotten</div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(TYPE_META).map(([type, { icon, label }]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: type === 'concept' ? '#8b5cf6' : BASE_COLORS[type] }}
              />
              <span>{icon} {label}</span>
            </div>
          ))}
          <div className="w-full border-t border-gray-100 pt-2 flex gap-3">
            {[['#22c55e', 'Strong > 70%'], ['#fbbf24', 'Fading 40–70%'], ['#ef4444', 'Forgotten < 40%'], ['#8b5cf6', 'Unknown']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: c }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Click hint */}
      {!selected && graphData.nodes.length > 0 && (
        <p className="text-xs text-center text-gray-400">Click any node to inspect · Click background to deselect</p>
      )}
    </div>
  )
}
