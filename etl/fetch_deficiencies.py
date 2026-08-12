#!/usr/bin/env python3
"""Fetch CMS Health Deficiencies for the configured state.

Each row is one deficiency citation with a scope/severity code. build_seed.py
counts total citations and Immediate-Jeopardy (J/K/L) citations per facility for
the latest survey cycle.
"""
from __future__ import annotations

from common import resolve_dataset, query_dataset, write_raw
from config import DATASETS, STATE


def main() -> None:
    ds = DATASETS["deficiencies"]
    ident = resolve_dataset(ds["id"], ds["title"])
    conditions = [{"property": "state", "value": STATE, "operator": "="}] if STATE else None
    print(f"Fetching Health Deficiencies (state={STATE or 'ALL'})…")
    try:
        rows = list(query_dataset(ident, conditions))
    except Exception:
        rows = [
            r for r in query_dataset(ident)
            if not STATE or str(r.get("state") or "").upper() == STATE
        ]
    write_raw("deficiencies", rows)


if __name__ == "__main__":
    main()
