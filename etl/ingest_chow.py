#!/usr/bin/env python3
"""
ingest_chow.py — ingest CMS Change-of-Ownership (CHOW) records into the Atlas.

Source: CMS publishes Skilled Nursing Facility "Change of Ownership" files as
part of public provider-enrollment data (data.cms.gov). Each record is a
facility ownership transfer: the facility keeps its CCN while the operating
organization changes from a seller to a buyer on an effective date.

This is public CMS enrollment data — no ADP data or ADP-derived methodology.

Drop the CMS SNF CHOW CSV(s) in etl/raw/chow/ (any CMS naming) and run:
    python3 etl/ingest_chow.py

Output (data/seed/national/):
    chow.json       { ccn: [ {date, buyer, seller, type, year}, ... ] }  (newest first)
    chow_meta.json  { total, distinct_facilities, latest_date, by_year: {yr: n}, recent: [...] }
"""
from __future__ import annotations

import csv
import glob
import json
import os
from collections import defaultdict

from common import archive_capture

RAW_DIR = os.path.join("etl", "raw", "chow")
OUT_DIR = os.path.join("data", "seed", "national")

# Tolerant column lookup (CMS headers vary in spacing/case).
def pick(row: dict, *names):
    for n in names:
        for k in row:
            if k.strip().lower() == n.strip().lower():
                v = (row[k] or "").strip()
                if v:
                    return v
    return ""


def main() -> None:
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.csv")))
    if not files:
        raise SystemExit(f"No CSVs in {RAW_DIR}/ (drop the CMS SNF CHOW file[s] there).")

    by_ccn: dict[str, list[dict]] = defaultdict(list)
    by_year: dict[str, int] = defaultdict(int)
    seen: set[tuple] = set()
    archive_rows = []

    for path in files:
        with open(path, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                ccn = pick(row, "CCN - BUYER", "CCN", "PROVNUM")
                if not ccn:
                    continue
                date = pick(row, "EFFECTIVE DATE", "CHOW EFFECTIVE DATE")
                buyer = pick(row, "ORGANIZATION NAME - BUYER", "BUYER")
                seller = pick(row, "ORGANIZATION NAME - SELLER", "SELLER")
                ctype = pick(row, "CHOW TYPE TEXT", "CHOW TYPE") or "Change of Ownership"
                year = (pick(row, "yr") or (date[:4] if date else ""))
                key = (ccn, date, buyer, seller)
                if key in seen:
                    continue
                seen.add(key)
                by_ccn[ccn].append({"date": date, "buyer": buyer, "seller": seller,
                                    "type": ctype.title(), "year": year})
                if year:
                    by_year[year] += 1
                archive_rows.append({"ccn": ccn, "date": date, "buyer": buyer, "seller": seller})

    # newest first per facility
    for ccn in by_ccn:
        by_ccn[ccn].sort(key=lambda t: t["date"], reverse=True)

    all_tx = [dict(ccn=c, **t) for c, txs in by_ccn.items() for t in txs]
    all_tx.sort(key=lambda t: t["date"], reverse=True)
    latest_date = all_tx[0]["date"] if all_tx else ""

    archive_capture("chow", archive_rows, key_fields=("ccn", "date"))

    os.makedirs(OUT_DIR, exist_ok=True)
    _write(os.path.join(OUT_DIR, "chow.json"), by_ccn)
    _write(os.path.join(OUT_DIR, "chow_meta.json"), {
        "dataset": "CMS Skilled Nursing Facility Change of Ownership",
        "source": "https://data.cms.gov/ (provider enrollment / CHOW)",
        "total": len(all_tx),
        "distinct_facilities": len(by_ccn),
        "latest_date": latest_date,
        "by_year": dict(sorted(by_year.items())),
        "recent": all_tx[:25],
    })
    print(f"Wrote {len(all_tx)} CHOW transactions across {len(by_ccn)} facilities "
          f"(latest {latest_date}) -> {OUT_DIR}")


def _write(path: str, obj) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
