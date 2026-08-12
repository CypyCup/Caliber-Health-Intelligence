#!/usr/bin/env python3
"""Fetch CMS Penalties (civil monetary penalties & payment denials).

build_seed.py sums CMP amounts over a trailing window per facility and counts
payment-denial actions.
"""
from __future__ import annotations

from common import resolve_dataset, query_dataset, write_raw
from config import DATASETS, STATE


def main() -> None:
    ds = DATASETS["penalties"]
    ident = resolve_dataset(ds["id"], ds["title"])
    conditions = [{"property": "state", "value": STATE, "operator": "="}] if STATE else None
    print(f"Fetching Penalties (state={STATE or 'ALL'})…")
    try:
        rows = list(query_dataset(ident, conditions))
    except Exception:
        rows = [
            r for r in query_dataset(ident)
            if not STATE or str(r.get("state") or "").upper() == STATE
        ]
    write_raw("penalties", rows)


if __name__ == "__main__":
    main()
