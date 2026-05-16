import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api.js";

export default function QueryBox({ onSaved }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [concept, setConcept] = useState("");
  const [courses, setCourses] = useState("");

  async function ask(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      setResult(await api.query(q));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result || !concept || !courses) return;
    await api.saveAnswer({
      concept,
      courses: courses.split(",").map((c) => c.trim()).filter(Boolean),
      answer_md: result.answer,
    });
    setConcept("");
    setCourses("");
    onSaved?.();
  }

  return (
    <div className="max-w-3xl space-y-4">
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask the wiki..."
          className="flex-1 border border-slate-300 rounded px-3 py-2"
        />
        <button disabled={busy} className="bg-ink text-cream px-4 py-2 rounded">
          {busy ? "..." : "Ask"}
        </button>
      </form>

      {result && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">memory backend: <code>{result.backend}</code></div>
          <article className="prose-wiki border border-slate-200 rounded p-4 bg-white">
            <ReactMarkdown>{result.answer}</ReactMarkdown>
          </article>

          <div className="border border-slate-200 rounded p-3 bg-white">
            <h3 className="font-semibold text-sm mb-2">Save as bridge page</h3>
            <div className="flex gap-2">
              <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="concept" className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" />
              <input value={courses} onChange={(e) => setCourses(e.target.value)} placeholder="courses (comma-separated)" className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" />
              <button onClick={save} className="bg-ink text-cream text-sm px-3 py-1 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
