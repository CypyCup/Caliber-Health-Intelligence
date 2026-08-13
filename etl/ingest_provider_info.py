#!/usr/bin/env python3
"""
ingest_provider_info.py — ingest the CMS Nursing Home Provider Information
(Care Compare) file into the Atlas's real national facility layer.

Source: https://data.cms.gov/provider-data/dataset/4pq5-n9py

This is the keystone dataset: ~14,700 facilities with real staffing, turnover,
ratings, deficiencies, fines, ownership, Special Focus status, and abuse icons —
AND the Chain Name / Chain ID that links each facility to the CMS Chain
Performance Measures (a verified facility→chain crosswalk).

Drop one CSV per monthly vintage in etl/raw/provider_info/ named YYYY-MM.csv.
Multiple vintages give month-over-month trends. Run:

    python3 etl/ingest_provider_info.py
"""
from __future__ import annotations

import csv
import glob
import json
import os

from common import archive_capture, period_from_filename

RAW_DIR = os.path.join("etl", "raw", "provider_info")
OUT_DIR = os.path.join("data", "seed", "national")

# Facility metric columns available in Provider Information (index -> metric_key).
METRIC_COLS = {
    50: "total_nurse_hprd", 48: "rn_hprd", 47: "lpn_hprd", 46: "cna_hprd",
    51: "weekend_nurse_hprd", 54: "total_nurse_turnover_pct", 56: "rn_turnover_pct",
    58: "admin_departures", 32: "overall_star", 42: "staffing_star",
    34: "health_inspection_star", 36: "qm_star", 73: "total_deficiencies",
    89: "infection_citations", 90: "fines_count", 91: "cmp_amount_trailing",
    92: "payment_denials",
}


def num(v):
    v = (v or "").strip().replace("%", "").replace("$", "").replace(",", "")
    if v in ("", "N/A", "NA"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def norm_ownership(raw: str) -> str:
    r = (raw or "").lower()
    if r.startswith("non profit") or "non-profit" in r:
        return "Non-profit"
    if r.startswith("government"):
        return "Government"
    return "For-profit"


def main() -> None:
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.csv")))
    if not files:
        raise SystemExit(f"No CSVs in {RAW_DIR}/ (drop the Provider Information CSVs there).")

    facilities: dict[str, dict] = {}
    # Compact per-period values store: {period: {ccn: {metric_key: value}}}.
    values_by_period: dict[str, dict[str, dict]] = {}
    periods: list[str] = []

    # Process oldest -> newest so the newest file wins for descriptor fields.
    for path in sorted(files, key=period_from_filename):
        period = period_from_filename(path)
        periods.append(period)
        vintage = f"{period}-01"
        values_by_period[period] = {}
        with open(path, encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            next(reader)  # header
            archive_rows = []
            for row in reader:
                if len(row) < 93:
                    continue
                ccn = row[0].strip()
                if not ccn:
                    continue
                archive_rows.append({"ccn": ccn, **{str(i): row[i] for i in (0, 1, 18, 19, 32, 50)}})
                chain_cid = row[19].strip()
                chain_id = f"cms-{chain_cid}" if chain_cid else None
                # Missing/incomplete PBJ: CMS footnotes 26/27 on the turnover
                # measures (total nursing, RN, administrator) mean staffing/
                # turnover could not be computed from submitted PBJ data.
                pbj_incomplete = any(row[i].strip() in ("26", "27") for i in (55, 57, 59))
                facilities[ccn] = {
                    "ccn": ccn,
                    "name": row[1].strip(),
                    "address": row[2].strip(),
                    "city": row[3].strip(),
                    "state": row[4].strip(),
                    "zip": row[5].strip(),
                    "county": row[8].strip(),
                    "ownership_type": norm_ownership(row[10]),
                    "certified_beds": int(num(row[11]) or 0),
                    "avg_residents_per_day": int(num(row[12]) or 0),
                    "chain_id": chain_id,
                    "chain_name": row[18].strip() or None,
                    "owner_id": chain_id,
                    "independent": chain_id is None,
                    "chain_confidence": ("verified" if chain_id else None),
                    "special_focus": (row[26].strip() or None),
                    "abuse_icon": (row[27].strip().upper() == "Y"),
                    "changed_ownership_12mo": (row[29].strip().upper() == "Y"),
                    "pbj_incomplete": pbj_incomplete,
                }
                vals = {}
                for idx, key in METRIC_COLS.items():
                    val = num(row[idx])
                    if val is not None:
                        vals[key] = round(val, 4)
                # Occupancy rate = avg residents / certified beds (Provider Info,
                # current). Capped at 100% to suppress bed/census data anomalies.
                beds = num(row[11])
                residents = num(row[12])
                if beds and beds > 0 and residents is not None:
                    vals["occupancy_rate"] = round(min(100 * residents / beds, 100), 1)
                # Per-period PBJ completeness (1 = incomplete) so it can be
                # tracked over time and rolled up per chain.
                if pbj_incomplete:
                    vals["pbj_incomplete"] = 1
                values_by_period[period][ccn] = vals
        archive_capture("provider_info", archive_rows, key_fields=("ccn",))
        print(f"  ingested {period}: {len(values_by_period[period])} facilities")

    latest = sorted(set(periods))[-1]
    os.makedirs(OUT_DIR, exist_ok=True)
    _write(os.path.join(OUT_DIR, "facilities.json"), list(facilities.values()))
    # Compact per-period values (all vintages). The backend derives latest +
    # month-over-month from this; a single file means one period (no trend yet).
    _write(os.path.join(OUT_DIR, "facility_history.json"), {
        "source": "provider", "latest_period": latest, "vintage_date": f"{latest}-01",
        "periods": {p: values_by_period[p] for p in sorted(set(periods))},
    })
    chained = sum(1 for x in facilities.values() if x["chain_id"])
    _write(os.path.join(OUT_DIR, "meta.json"), {
        "dataset": "CMS Nursing Home Provider Information",
        "source": "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        "synthetic": False,
        "facilities": len(facilities),
        "chained_facilities": chained,
        "independent_facilities": len(facilities) - chained,
        "periods": sorted(set(periods)),
        "latest_period": latest,
    })
    print(f"Wrote {len(facilities)} facilities ({chained} chained), periods={sorted(set(periods))} -> {OUT_DIR}")


def _write(path: str, obj) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
