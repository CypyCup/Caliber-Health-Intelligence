#!/usr/bin/env python3
"""Fetch CMS Provider Information (Care Compare) for the configured state.

Provider Information carries, per facility: identity/location, ownership type,
certified beds, average residents, the four Five-Star ratings, reported nurse
staffing (HPRD), and rolling turnover. We snapshot the current publication; the
builder stamps it with the run's vintage.
"""
from __future__ import annotations

from common import resolve_dataset, query_dataset, write_raw
from config import DATASETS, STATE


def main() -> None:
    ds = DATASETS["provider_info"]
    ident = resolve_dataset(ds["id"], ds["title"])
    conditions = None
    if STATE:
        # Column name is commonly "state" or "provider_state" depending on vintage.
        conditions = [{"property": "state", "value": STATE, "operator": "="}]
    print(f"Fetching Provider Information (state={STATE or 'ALL'})…")
    try:
        rows = list(query_dataset(ident, conditions))
    except Exception:
        # Fall back to unfiltered + local filter if the state column name differs.
        print("  state-filtered query failed; pulling all and filtering locally…")
        rows = [
            r for r in query_dataset(ident)
            if not STATE or str(r.get("state") or r.get("provider_state") or "").upper() == STATE
        ]
    write_raw("provider_info", rows)


if __name__ == "__main__":
    main()
