import { useEffect, useState } from "react";
import { api } from "../api.js";

const BADGES = {
  missing_concept: "bg-amber-100 text-amber-900",
  orphan: "bg-slate-200 text-slate-800",
  weak_bridge: "bg-rose-100 text-rose-900",
  source_unlinked: "bg-sky-100 text-sky-900",
};

export default function LintReport() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try { setData(await api.lint()); }
    finally { setBusy(false); }
  }

  useEffect(() => { run(); }, []);

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">Lint Report</h2>
        <button onClick={run} disabled={busy} className="text-sm bg-ink text-cream px-3 py-1 rounded">
          {busy ? "Running..." : "Re-run"}
        </button>
      </div>
      {!data ? (
        <p className="text-slate-500">Loading...</p>
      ) : data.issues.length === 0 ? (
        <p className="text-emerald-700">No issues. Wiki looks clean.</p>
      ) : (
        <ul className="space-y-2">
          {data.issues.map((i, idx) => (
            <li key={idx} className="border border-slate-200 rounded p-3 bg-white">
              <span className={`text-xs px-2 py-0.5 rounded mr-2 ${BADGES[i.type] || "bg-slate-100"}`}>{i.type}</span>
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
