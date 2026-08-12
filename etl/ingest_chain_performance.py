#!/usr/bin/env python3
"""
ingest_chain_performance.py — ingest the CMS "Nursing Home Chain Performance
Measures" dataset into the Atlas's real chain layer.

Source: https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures

This is REAL, national, chain-level CMS data (~635 operating chains) — CMS's own
chain grouping with performance already aggregated. It powers the real Operators
& chains directory and real chain profiles. (It is chain-level only; it carries
no facility→chain CCN mapping, so facility-level drill-down still comes from the
Provider Information ETL.)

Drop one CSV per monthly vintage in etl/raw/chain_performance/ named YYYY-MM.csv.
Multiple vintages produce month-over-month history + the point-in-time archive
diff (Business Plan §3). Run:

    python3 etl/ingest_chain_performance.py
"""
from __future__ import annotations

import csv
import glob
import json
import os
import re

from common import archive_capture

RAW_DIR = os.path.join("etl", "raw", "chain_performance")
OUT_DIR = os.path.join("data", "seed", "chains_cms")

# Chain descriptor columns (0-based index -> field name).
DESCRIPTOR_COLS = {
    2: "num_facilities", 3: "num_states", 4: "sff", 5: "sff_candidates",
    6: "abuse_count", 7: "abuse_pct", 8: "pct_for_profit",
    9: "pct_non_profit", 10: "pct_government",
}

# Performance metric columns (index -> metric_key). Keys reuse the facility-level
# metric keys where the meaning aligns (chain averages), plus chain-only keys.
METRIC_COLS = {
    11: "overall_star", 12: "health_inspection_star", 13: "staffing_star", 14: "qm_star",
    15: "total_nurse_hprd", 16: "weekend_nurse_hprd", 17: "rn_hprd",
    18: "total_nurse_turnover_pct", 19: "rn_turnover_pct", 20: "admin_departures",
    21: "fines_count", 23: "fines_total_usd", 24: "fines_avg_usd",
    25: "payment_denials_total",
    27: "rehosp_pct", 28: "ed_visit_pct",
    36: "ls_antipsychotic_pct", 37: "ls_falls_major_pct", 38: "ls_pressure_ulcer_pct",
    39: "ls_uti_pct", 50: "preventable_readmit_pct",
}


def clean(v: str):
    v = (v or "").strip()
    if v in ("", "N/A", "NA", "-"):
        return None
    v = v.replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        return float(v)
    except ValueError:
        return None


def period_from_path(path: str) -> str:
    m = re.search(r"(\d{4})-(\d{2})", os.path.basename(path))
    return f"{m.group(1)}-{m.group(2)}" if m else os.path.splitext(os.path.basename(path))[0]


def main() -> None:
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.csv")))
    if not files:
        raise SystemExit(f"No CSVs in {RAW_DIR}/ (name them YYYY-MM.csv).")

    chains: dict[str, dict] = {}
    metrics: list[dict] = []
    national: dict = {}
    periods: list[str] = []

    for path in files:
        period = period_from_path(path)
        periods.append(period)
        vintage = f"{period}-01"
        with open(path, encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
        raw_rows_for_archive = []
        for row in rows[1:]:
            if len(row) < 51:
                continue
            name = row[0].strip()
            cid = row[1].strip()
            raw_rows_for_archive.append({"chain_id": cid or "national", **{str(i): row[i] for i in range(len(row))}})
            if name == "National":
                # Store the National benchmark row (latest period wins).
                national = {"period": period, "vintage_date": vintage,
                            **{k: clean(row[i]) for i, k in {**DESCRIPTOR_COLS, **METRIC_COLS}.items()}}
                continue
            if not cid:
                continue
            chain_id = f"cms-{cid}"
            # Descriptor from the latest period seen (files processed in order).
            chains[chain_id] = {
                "id": chain_id, "cms_chain_id": cid, "name": name,
                **{field: clean(row[idx]) for idx, field in DESCRIPTOR_COLS.items()},
            }
            for idx, key in METRIC_COLS.items():
                val = clean(row[idx])
                if val is not None:
                    metrics.append({"chain_id": chain_id, "metric_key": key, "period": period,
                                    "value": val, "vintage_date": vintage, "source": "chain_performance"})
        archive_capture("chain_performance", raw_rows_for_archive, key_fields=("chain_id",))
        print(f"  ingested {period}: {sum(1 for m in metrics if m['period']==period)} chain-metric rows")

    os.makedirs(OUT_DIR, exist_ok=True)
    _write(os.path.join(OUT_DIR, "chains.json"), list(chains.values()))
    _write(os.path.join(OUT_DIR, "chain_metrics.json"), metrics)
    _write(os.path.join(OUT_DIR, "national.json"), national)
    _write(os.path.join(OUT_DIR, "meta.json"), {
        "dataset": "CMS Nursing Home Chain Performance Measures",
        "source": "https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures",
        "synthetic": False,
        "periods": sorted(set(periods)),
        "latest_period": sorted(set(periods))[-1],
        "chains": len(chains),
        "national_facilities": int(national.get("num_facilities") or 0),
    })
    print(f"Wrote {len(chains)} chains, {len(metrics)} chain-metric rows, "
          f"periods={sorted(set(periods))} -> {OUT_DIR}")


def _write(path: str, obj) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
