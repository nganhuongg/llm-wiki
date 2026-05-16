const BASE = "/api";

async function jsonOrThrow(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  ingest(file) {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/ingest`, { method: "POST", body: form }).then(jsonOrThrow);
  },
  listPages() {
    return fetch(`${BASE}/wiki/pages`).then(jsonOrThrow);
  },
  readPage(path) {
    return fetch(`${BASE}/wiki/page/${path}`).then(jsonOrThrow);
  },
  query(question, k = 5) {
    return fetch(`${BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, k }),
    }).then(jsonOrThrow);
  },
  saveAnswer({ concept, courses, answer_md }) {
    return fetch(`${BASE}/save-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept, courses, answer_md }),
    }).then(jsonOrThrow);
  },
  lint() {
    return fetch(`${BASE}/lint`).then(jsonOrThrow);
  },
  graph() {
    return fetch(`${BASE}/graph`).then(jsonOrThrow);
  },
};
