"""Concept graph builder."""
from __future__ import annotations

import json

from . import config


def build() -> dict:
    nodes: list[dict] = []
    edges: list[dict] = []

    courses: dict = {}
    concepts: dict = {}
    if config.COURSES_JSON.exists():
        courses = json.loads(config.COURSES_JSON.read_text(encoding="utf-8"))
    if config.CONCEPTS_JSON.exists():
        concepts = json.loads(config.CONCEPTS_JSON.read_text(encoding="utf-8"))

    for slug, entry in courses.items():
        nodes.append({"id": f"course:{slug}", "label": entry["name"], "type": "course"})
        for concept in entry.get("concepts", []):
            cslug = concept.lower().replace(" ", "_")
            edges.append({"from": f"course:{slug}", "to": f"concept:{cslug}", "label": "covers"})

    for slug, entry in concepts.items():
        nodes.append({"id": f"concept:{slug}", "label": entry["name"], "type": "concept"})

    for p in config.BRIDGES_DIR.glob("*.md"):
        nodes.append({"id": f"bridge:{p.stem}", "label": p.stem, "type": "bridge"})

    graph = {"nodes": nodes, "edges": edges}
    config.GRAPH_JSON.write_text(json.dumps(graph, indent=2), encoding="utf-8")
    return graph
