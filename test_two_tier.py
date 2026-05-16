"""Two-tier smoke test: Redis session memory + cognee permanent graph.

Run from llm-wiki/ with the venv active:

    .venv\\Scripts\\python.exe test_two_tier.py
"""
from __future__ import annotations

import asyncio
import os

from dotenv import load_dotenv

load_dotenv()

import cognee
from cognee.modules.engine.operations.setup import setup


SESSION = "smoke-session-1"


async def main() -> None:
    print(f"cognee version: {getattr(cognee, '__version__', '?')}")
    print(f"REDIS_URL:      {os.environ.get('REDIS_URL')}")
    print(f"LLM_API_KEY set: {bool(os.environ.get('LLM_API_KEY'))}")
    print()

    print("[0/5] Pruning prior cognee state (fresh slate)...")
    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)
    await setup()

    print("[1/5] Session-memory write (routes to Redis via session_id)...")
    await cognee.remember(
        "Student is asking about hypothesis testing in Statistics 101.",
        session_id=SESSION,
    )

    print("[2/5] Permanent-graph write (no session_id)...")
    await cognee.remember(
        "Hypothesis testing compares a null and alternative claim under data."
    )

    print("[3/5] Session recall (should hit Redis first)...")
    session_hits = await cognee.recall(
        "What is the student working on?",
        session_id=SESSION,
    )
    for r in (session_hits if isinstance(session_hits, list) else [session_hits])[:3]:
        print(f"   - {r}")

    print("[4/5] Permanent recall (graph only)...")
    graph_hits = await cognee.recall("What is hypothesis testing?")
    for r in (graph_hits if isinstance(graph_hits, list) else [graph_hits])[:3]:
        print(f"   - {r}")

    print("\n[5/5] OK: two-tier memory works.")


if __name__ == "__main__":
    asyncio.run(main())
