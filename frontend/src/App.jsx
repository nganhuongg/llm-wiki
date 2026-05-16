import { useEffect, useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import WikiViewer from "./components/WikiViewer.jsx";
import QueryBox from "./components/QueryBox.jsx";
import LintReport from "./components/LintReport.jsx";
import GraphView from "./components/GraphView.jsx";
import { api } from "./api.js";

export default function App() {
  const [pages, setPages] = useState({ courses: [], concepts: [], sources: [], bridges: [] });
  const [activePath, setActivePath] = useState(null);
  const [tab, setTab] = useState("wiki");

  const refresh = () => api.listPages().then(setPages).catch(console.error);
  useEffect(() => { refresh(); }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white">
        <div>
          <h1 className="text-2xl font-serif font-bold">CourseAtlas</h1>
          <p className="text-xs text-slate-500">A self-improving wiki for your courses</p>
        </div>
        <nav className="flex gap-1 text-sm">
          {["wiki", "query", "lint", "graph"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded ${tab === t ? "bg-ink text-cream" : "hover:bg-slate-100"}`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-slate-200 bg-white overflow-y-auto p-4 space-y-4">
          <UploadPanel onUploaded={refresh} />
          <Sidebar pages={pages} onSelect={(p) => { setActivePath(p); setTab("wiki"); }} active={activePath} />
        </aside>

        <section className="flex-1 overflow-y-auto p-6">
          {tab === "wiki" && <WikiViewer path={activePath} />}
          {tab === "query" && <QueryBox onSaved={refresh} />}
          {tab === "lint" && <LintReport />}
          {tab === "graph" && <GraphView />}
        </section>
      </main>
    </div>
  );
}

function Sidebar({ pages, onSelect, active }) {
  const groups = [
    ["Courses", pages.courses],
    ["Concepts", pages.concepts],
    ["Sources", pages.sources],
    ["Bridges", pages.bridges],
  ];
  return (
    <div className="space-y-3 text-sm">
      {groups.map(([label, items]) => (
        <div key={label}>
          <h3 className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider mb-1">{label}</h3>
          {items.length === 0 ? (
            <p className="text-slate-400 text-xs italic">empty</p>
          ) : (
            <ul className="space-y-0.5">
              {items.map((p) => (
                <li key={p}>
                  <button
                    onClick={() => onSelect(p)}
                    className={`text-left w-full px-2 py-1 rounded hover:bg-slate-100 ${active === p ? "bg-slate-200" : ""}`}
                  >
                    {p.split("/").pop().replace(/\.md$/, "")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
