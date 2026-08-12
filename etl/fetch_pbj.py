#!/usr/bin/env python3
"""Aggregate CMS Payroll-Based Journal (PBJ) daily nurse staffing to per-facility
per-quarter HPRD.

PBJ quarterly files are large bulk downloads, and their per-quarter download
URLs are not stable, so this script reads them from local disk:

    etl/raw/pbj/<QUARTER>.csv        e.g. etl/raw/pbj/2025Q4.csv

Download the "PBJ Daily Nurse Staffing" quarterly files from:
    https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing
and drop each quarter's CSV in etl/raw/pbj/ named <QUARTER>.csv.

For each facility/quarter it computes hours-per-resident-day (HPRD):
    HPRD(role) = sum(role hours over the quarter) / sum(daily MDS census)
and the contract/agency share of total nurse hours, plus weekend HPRD.
"""
from __future__ import annotations

import csv
import glob
import json
import os
from collections import defaultdict
from datetime import datetime

from config import QUARTERS, RAW_DIR, STATE

PBJ_DIR = os.path.join(RAW_DIR, "pbj")

# Employee + contract hour columns in the PBJ public-use file. Care roles only
# (DON/admin RN hours are excluded from care HPRD).
CARE_COLS = {
    "rn": ["Hrs_RN"],
    "lpn": ["Hrs_LPN"],
    "cna": ["Hrs_CNA", "Hrs_NAtrn", "Hrs_MedAide"],
}
CONTRACT_COLS = ["Hrs_RN_ctr", "Hrs_LPN_ctr", "Hrs_CNA_ctr", "Hrs_NAtrn_ctr", "Hrs_MedAide_ctr"]


def _num(row: dict, col: str) -> float:
    try:
        return float(row.get(col) or 0)
    except (TypeError, ValueError):
        return 0.0


def _is_weekend(date_str: str) -> bool:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(date_str, fmt).weekday() >= 5
        except ValueError:
            continue
    return False


def aggregate_quarter(path: str, period: str) -> list[dict]:
    acc: dict[str, dict] = defaultdict(lambda: {
        "census": 0.0, "wknd_census": 0.0,
        "rn": 0.0, "lpn": 0.0, "cna": 0.0, "contract": 0.0,
        "wknd_total": 0.0, "name": "", "city": "", "state": "", "county": "",
    })
    with open(path, newline="", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            state = str(row.get("STATE") or row.get("State") or "").upper()
            if STATE and state != STATE:
                continue
            ccn = str(row.get("PROVNUM") or row.get("provnum") or "").strip()
            if not ccn:
                continue
            a = acc[ccn]
            a["name"] = row.get("PROVNAME") or a["name"]
            a["city"] = row.get("CITY") or a["city"]
            a["state"] = state or a["state"]
            a["county"] = row.get("COUNTY_NAME") or a["county"]
            census = _num(row, "MDScensus")
            rn = sum(_num(row, c) for c in CARE_COLS["rn"])
            lpn = sum(_num(row, c) for c in CARE_COLS["lpn"])
            cna = sum(_num(row, c) for c in CARE_COLS["cna"])
            contract = sum(_num(row, c) for c in CONTRACT_COLS)
            total = rn + lpn + cna
            a["census"] += census
            a["rn"] += rn
            a["lpn"] += lpn
            a["cna"] += cna
            a["contract"] += contract
            wkend = _is_weekend(str(row.get("WorkDate") or row.get("workdate") or ""))
            if wkend:
                a["wknd_census"] += census
                a["wknd_total"] += total

    out = []
    for ccn, a in acc.items():
        c = a["census"] or 1.0
        total_hours = a["rn"] + a["lpn"] + a["cna"]
        out.append({
            "ccn": ccn, "period": period,
            "name": a["name"], "city": a["city"], "state": a["state"], "county": a["county"],
            "total_nurse_hprd": round(total_hours / c, 3),
            "rn_hprd": round(a["rn"] / c, 3),
            "lpn_hprd": round(a["lpn"] / c, 3),
            "cna_hprd": round(a["cna"] / c, 3),
            "contract_staff_pct": round(100 * a["contract"] / total_hours, 2) if total_hours else 0.0,
            "weekend_nurse_hprd": round(a["wknd_total"] / (a["wknd_census"] or 1.0), 3),
        })
    return out


def main() -> None:
    if not os.path.isdir(PBJ_DIR):
        raise SystemExit(
            f"No PBJ files found. Create {PBJ_DIR}/ and add <QUARTER>.csv files.\n"
            "See the module docstring for the download source."
        )
    results: list[dict] = []
    for period in QUARTERS:
        matches = glob.glob(os.path.join(PBJ_DIR, f"{period}.csv"))
        if not matches:
            print(f"  (skip {period}: no file {period}.csv)")
            continue
        print(f"Aggregating PBJ {period}…")
        results.extend(aggregate_quarter(matches[0], period))
    os.makedirs(RAW_DIR, exist_ok=True)
    with open(os.path.join(RAW_DIR, "pbj_agg.json"), "w") as f:
        json.dump(results, f)
    print(f"  wrote {len(results)} facility-quarter rows -> {RAW_DIR}/pbj_agg.json")


if __name__ == "__main__":
    main()
