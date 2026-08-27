#!/usr/bin/env python3
"""
ingest_pbj.py — build the Atlas PBJ staffing seed from the verified PBJ atlas
parquet (already extracted / normalized / verified by the toolkit).

Grain: one row per facility (provnum) per calendar quarter. We store the RAW
numerators and denominators per facility-quarter so every roll-up above the
facility is computed the only correct way — sum(numerators) / sum(denominators)
— never by averaging facility percentages. Derived HPRD / agency% are computed
in the app from these sums (null where a denominator is zero).

provnum is text with significant leading zeros — zero-padded to 6 chars, never
an integer.

Input:  etl/raw/pbj/pbj_atlas_facility_quarter_*.parquet (+ national_trend.csv)
Output: data/seed/pbj/
    facility_pbj.json   compact { ccn: { quarter: [rd,tnh,tnc,rnh,lpnh,aideh,allh,allc,comp] } }
    national_trend.json national reference series (37 quarters)
    meta.json           periods, flagged quarters, extraction date, counts
"""
from __future__ import annotations

import glob
import json
import os

import pandas as pd

RAW_DIR = os.path.join("etl", "raw", "pbj")
OUT_DIR = os.path.join("data", "seed", "pbj")

# Columns stored per facility-quarter (order matters — mirrored in lib/data/pbj.ts).
COLS = ["rd", "tnh", "tnc", "rnh", "lpnh", "aideh", "allh", "allc", "comp"]
SRC = {
    "rd": "resident_days", "tnh": "total_nurse_hours", "tnc": "total_nurse_contract_hours",
    "rnh": "rn_hours", "lpnh": "lpn_hours", "aideh": "aide_hours",
    "allh": "total_hours_all_staff", "allc": "total_contract_hours_all_staff",
    "comp": "reporting_completeness_pct",
}
FLAGGED = {
    "2020Q1": "Thin quarter — COVID-era reporting gap (~12,134 vs ~14,900 facilities).",
    "2021Q4": "CMS incompleteness flag on 51,475 facility-day records.",
}


def main() -> None:
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*pbj_atlas_facility_quarter_*.parquet")))
    if not files:
        raise SystemExit(f"No atlas parquet in {RAW_DIR}/ (run the toolkit first).")
    pbj = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    pbj["provnum"] = pbj["provnum"].astype(str).str.zfill(6)

    # Integrity assertion — stop rather than ship a bad panel.
    assert pbj.shape[1] == 59, f"unexpected column count {pbj.shape[1]}"
    periods = sorted(pbj["cy_qtr"].unique())

    def num(v, decimals=0):
        if pd.isna(v):
            return None
        return round(float(v), decimals) if decimals else int(round(float(v)))

    values: dict[str, dict[str, list]] = {}
    for row in pbj.itertuples(index=False):
        d = row._asdict()
        ccn = d["provnum"]
        rec = [
            num(d["resident_days"]), num(d["total_nurse_hours"]), num(d["total_nurse_contract_hours"]),
            num(d["rn_hours"]), num(d["lpn_hours"]), num(d["aide_hours"]),
            num(d["total_hours_all_staff"]), num(d["total_contract_hours_all_staff"]),
            num(d["reporting_completeness_pct"], 1),
        ]
        values.setdefault(ccn, {})[d["cy_qtr"]] = rec

    # National reference series (small).
    nat = pd.read_csv(os.path.join(RAW_DIR, "national_trend.csv"), dtype={"cy_qtr": str})
    national = nat.to_dict(orient="records")

    os.makedirs(OUT_DIR, exist_ok=True)
    _write(os.path.join(OUT_DIR, "facility_pbj.json"), {"cols": COLS, "periods": periods, "values": values})
    _write(os.path.join(OUT_DIR, "national_trend.json"), national)
    _write(os.path.join(OUT_DIR, "meta.json"), {
        "dataset": "CMS Payroll-Based Journal (PBJ) Daily Staffing",
        "source": "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
        "grain": "facility-quarter",
        "periods": periods,
        "latest_period": periods[-1],
        "facilities": len(values),
        "facility_quarters": int(len(pbj)),
        "flagged_quarters": FLAGGED,
        "note": "HPRD is reported, not case-mix adjusted; agency = contract (agency + individual contractors), null where denominator is zero.",
    })
    print(f"Wrote PBJ seed: {len(values)} facilities, {len(pbj)} facility-quarters, "
          f"{len(periods)} quarters ({periods[0]}..{periods[-1]}) -> {OUT_DIR}")


def _write(path: str, obj) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
