// Simple line-level diff: marks additions and removals without external deps.
function buildDiff(before, after) {
  const bLines = (before ?? '').split('\n')
  const aLines = (after  ?? '').split('\n')

  // Build lookup sets for fast membership test
  const aSet = new Set(aLines)
  const bSet = new Set(bLines)

  // Produce a merged sequence: same → unchanged; in b only → removed; in a only → added.
  // This is a simplified (non-LCS) diff adequate for SKILL.md rewrites.
  const result = []
  let bi = 0, ai = 0
  while (bi < bLines.length || ai < aLines.length) {
    const bl = bLines[bi]
    const al = aLines[ai]
    if (bi >= bLines.length) {
      result.push({ type: 'added',   line: al }); ai++
    } else if (ai >= aLines.length) {
      result.push({ type: 'removed', line: bl }); bi++
    } else if (bl === al) {
      result.push({ type: 'same',    line: bl }); bi++; ai++
    } else if (!aSet.has(bl)) {
      result.push({ type: 'removed', line: bl }); bi++
    } else if (!bSet.has(al)) {
      result.push({ type: 'added',   line: al }); ai++
    } else {
      result.push({ type: 'removed', line: bl }); bi++
      result.push({ type: 'added',   line: al }); ai++
    }
  }
  return result
}

const LINE_STYLE = {
  removed: 'bg-red-50   text-red-800',
  added:   'bg-green-50 text-green-800',
  same:    'text-gray-700',
}

function DiffPane({ title, headerCls, lines, prefix }) {
  return (
    <div className="min-w-0">
      <div className={`px-3 py-2 text-xs font-semibold border-b border-gray-100 ${headerCls}`}>
        {title}
      </div>
      <pre className="text-xs p-3 overflow-auto max-h-72 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {lines.map((d, i) => (
          <div key={i} className={`px-1 rounded ${LINE_STYLE[d.type]}`}>
            <span className="select-none mr-1 opacity-50">{prefix[d.type]}</span>
            {d.line}
          </div>
        ))}
      </pre>
    </div>
  )
}

export default function SkillDiff({ before, after }) {
  if (!before && !after) return null
  const diff = buildDiff(before, after)

  const addedCount   = diff.filter(d => d.type === 'added').length
  const removedCount = diff.filter(d => d.type === 'removed').length

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-gray-800">SKILL.md — Proposed Rewrite</span>
        <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">
          +{addedCount} / −{removedCount}
        </span>
        <span className="ml-auto text-xs text-gray-400">self-improvement applied</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <DiffPane
          title="Before"
          headerCls="bg-red-50 text-red-700"
          lines={diff.filter(d => d.type !== 'added')}
          prefix={{ removed: '−', same: ' ' }}
        />
        <DiffPane
          title="After"
          headerCls="bg-green-50 text-green-700"
          lines={diff.filter(d => d.type !== 'removed')}
          prefix={{ added: '+', same: ' ' }}
        />
      </div>
    </div>
  )
}
