#!/usr/bin/env python3
"""Fetch CMS Nursing Home Ownership records for the configured state.

The Ownership dataset lists ownership roles per CCN, including entities whose
role text identifies private-equity ownership and REIT/landlord relationships.
build_seed.py derives the PE and REIT flags from these role/name fields.
"""
from __future__ import annotations

from common import resolve_dataset, query_dataset, write_raw
from config import DATASETS


def main() -> None:
    ds = DATASETS["ownership"]
    ident = resolve_dataset(ds["id"], ds["title"])
    print("Fetching Ownership records…")
    # Ownership isn't reliably state-filterable by column; pull all, join by CCN.
    rows = list(query_dataset(ident))
    write_raw("ownership", rows)


if __name__ == "__main__":
    main()
