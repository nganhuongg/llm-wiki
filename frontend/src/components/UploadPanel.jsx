import { useState } from "react";
import { api } from "../api.js";

export default function UploadPanel({ onUploaded }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(`Ingesting ${file.name}...`);
    try {
      const res = await api.ingest(file);
      setStatus(`Ingested ${res.file} → ${res.course} (${res.concepts.length} concepts)`);
      onUploaded?.();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-dashed border-slate-300 rounded p-3 text-center">
      <label className="cursor-pointer">
        <input type="file" className="hidden" onChange={handle} disabled={busy} />
        <div className="text-sm font-medium">{busy ? "Working..." : "Upload syllabus or notes"}</div>
        <div className="text-xs text-slate-500">PDF, TXT, MD</div>
      </label>
      {status && <p className="text-xs text-slate-600 mt-2">{status}</p>}
    </div>
  );
}
