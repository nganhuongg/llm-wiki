import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api.js";

export default function WikiViewer({ path }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!path) { setContent(""); return; }
    api.readPage(path).then((r) => setContent(r.content)).catch((e) => setContent(`# Error\n\n${e.message}`));
  }, [path]);

  if (!path) {
    return (
      <div className="text-slate-500">
        <h2 className="text-xl font-serif mb-2">Pick a page</h2>
        <p>Upload a syllabus, then choose a generated page from the left.</p>
      </div>
    );
  }

  return (
    <article className="prose-wiki max-w-3xl">
      <div className="text-xs text-slate-400 mb-2 font-mono">{path}</div>
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );
}
