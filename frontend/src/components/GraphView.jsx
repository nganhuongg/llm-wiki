import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function GraphView() {
  const [graph, setGraph] = useState(null);

  useEffect(() => { api.graph().then(setGraph); }, []);

  if (!graph) return <p className="text-slate-500">Loading graph...</p>;
  if (graph.nodes.length === 0) return <p className="text-slate-500">No nodes yet — ingest some materials.</p>;

  const color = { course: "#0f172a", concept: "#0369a1", bridge: "#9d174d" };
  const cols = Math.ceil(Math.sqrt(graph.nodes.length));
  const positions = Object.fromEntries(
    graph.nodes.map((n, i) => [n.id, { x: 80 + (i % cols) * 180, y: 80 + Math.floor(i / cols) * 100 }])
  );

  const width = 80 + cols * 180;
  const height = 80 + Math.ceil(graph.nodes.length / cols) * 100;

  return (
    <div className="max-w-full overflow-auto border border-slate-200 rounded bg-white">
      <svg width={width} height={height}>
        {graph.edges.map((e, i) => {
          const a = positions[e.from], b = positions[e.to];
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" strokeWidth="1" />;
        })}
        {graph.nodes.map((n) => {
          const p = positions[n.id];
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <circle r="22" fill={color[n.type] || "#64748b"} />
              <text textAnchor="middle" y="40" fontSize="11" fill="#0f172a">{n.label.slice(0, 22)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
