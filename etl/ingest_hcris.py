#!/usr/bin/env python3
"""
ingest_hcris.py — ingest CMS SNF Medicare cost reports (HCRIS, Form CMS-2540-10)
into the Atlas's financial layer.

Source: CMS Cost Reports (Skilled Nursing Facility 2540-2010 form). 100% public
CMS data. See docs/HCRIS_SOURCING.md.

Input (drop the extracted CSVs in etl/raw/hcris/ — any subfolders are fine):
  * <prefix>_<FY>_rpt.csv   — report index (one row per filed report)
  * <prefix>_<FY>_nmrc.csv  — numeric line items at worksheet/line/column coords
  (the huge *_nmrc.csv is streamed and filtered to ~6 coordinates; *_alpha and
   *_rollup are not needed.)

Coordinates were pinned against a real FY2025 (Form 2540-24) file and validated
by the cost report's own arithmetic identities:
  Margin  — Worksheet G-3 (WKSHT_CD "G300000"), column 00100:
    line 00100 total patient revenue · 00300 net patient revenue
    (= 00100 − 00200 ✓) · 00400 total operating expenses ·
    03200 net income (loss) for the period
  Labor   — Worksheet A (WKSHT_CD "A000000"), grand-total line 10000:
    col 00100 total salaries · col 00200 total contract labor
    (col3 = col1 + col2 identity confirms col2 = contract labor; col1 also
     matches Worksheet S-3 Part II line-1 salaries exactly) · col 00900 total
     cost (≈ G-3 operating expenses)
  Hours   — Worksheet S-3 Part II (WKSHT_CD "S300002") line 00100 col 00500
    total paid hours (bonus; ties to PBJ hours)

Raw dollars are stored (never ratios), so chain roll-ups sum numerators and
denominators — margins/intensities are derived as sum/sum, never averaged.

    python3 etl/ingest_hcris.py
"""
from __future__ import annotations

import csv
import glob
import json
import os
import sys

RAW_DIR = os.path.join("etl", "raw", "hcris")
OUT_DIR = os.path.join("data", "seed", "hcris")

# WKSHT_CD -> {(LINE_NUM, CLMN_NUM): field}
COORDS = {
    "G300000": {
        ("00100", "00100"): "total_patient_rev",
        ("00300", "00100"): "net_patient_rev",
        ("00400", "00100"): "total_operating_exp",
        ("03200", "00100"): "net_income",
    },
    "A000000": {  # grand-total line 100: salaries (col1) + contract labor (col2)
        ("10000", "00100"): "total_salaries",
        ("10000", "00200"): "contract_labor",
        ("10000", "00900"): "wksht_a_total_cost",
    },
    "S300002": {
        ("00100", "00500"): "paid_hours",
    },
}
# Order of the compact stored row.
FIELDS = ["fy_begin", "fy_end", "status", "total_patient_rev", "net_patient_rev",
          "total_operating_exp", "net_income", "total_salaries", "contract_labor",
          "wksht_a_total_cost", "paid_hours"]

csv.field_size_limit(10 * 1024 * 1024)


def _num(v: str):
    v = (v or "").strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def load_reports(rpt_paths: list[str]) -> dict[str, dict]:
    """Parse the RPT files → {rpt_rec_num: report}, de-duplicated to one report
    per (CCN, fiscal-year-end): prefer LAST_RPT_SW='Y', then latest PROC_DT."""
    best: dict[tuple[str, str], dict] = {}
    for path in rpt_paths:
        with open(path, newline="", encoding="utf-8-sig") as f:
            for row in csv.reader(f):
                if len(row) < 10:
                    continue
                rec, ccn, status = row[0].strip(), row[2].strip(), row[4].strip()
                fy_bgn, fy_end, proc_dt = row[5].strip(), row[6].strip(), row[7].strip()
                last_sw = row[9].strip().upper()
                if not rec or not ccn or not fy_end:
                    continue
                rpt = {"rec": rec, "ccn": ccn, "status": status, "fy_begin": fy_bgn,
                       "fy_end": fy_end, "proc_dt": proc_dt, "last_sw": last_sw}
                key = (ccn, fy_end)
                cur = best.get(key)
                if cur is None or _better(rpt, cur):
                    best[key] = rpt
    return {r["rec"]: r for r in best.values()}


def _mmddyyyy(d: str) -> str:
    # "01/14/2026" -> "2026-01-14" for safe comparison; blank sorts first.
    p = d.split("/")
    return f"{p[2]}-{p[0]}-{p[1]}" if len(p) == 3 else ""


def _better(a: dict, b: dict) -> bool:
    """Is report a a better representative than b for the same (CCN, FY)?"""
    if (a["last_sw"] == "Y") != (b["last_sw"] == "Y"):
        return a["last_sw"] == "Y"
    pa, pb = _mmddyyyy(a["proc_dt"]), _mmddyyyy(b["proc_dt"])
    if pa != pb:
        return pa > pb
    return int(a["rec"]) > int(b["rec"])


def extract_values(nmrc_paths: list[str], keep: dict[str, dict]) -> dict[str, dict]:
    """Stream the (huge) NMRC files, keeping only our coordinates for reports we
    kept. Returns {rpt_rec_num: {field: value}}."""
    vals: dict[str, dict] = {}
    for path in nmrc_paths:
        with open(path, newline="", encoding="utf-8-sig") as f:
            for row in csv.reader(f):
                if len(row) < 5:
                    continue
                rec, wksht = row[0], row[1]
                fields = COORDS.get(wksht)
                if fields is None or rec not in keep:
                    continue
                field = fields.get((row[2], row[3]))
                if field is None:
                    continue
                n = _num(row[4])
                if n is not None:
                    vals.setdefault(rec, {})[field] = n
    return vals


def main() -> None:
    rpt_paths = sorted(glob.glob(os.path.join(RAW_DIR, "**", "*rpt*.csv"), recursive=True))
    nmrc_paths = sorted(glob.glob(os.path.join(RAW_DIR, "**", "*nmrc*.csv"), recursive=True))
    if not rpt_paths or not nmrc_paths:
        raise SystemExit(f"Need *rpt*.csv and *nmrc*.csv in {RAW_DIR}/ (see docs/HCRIS_SOURCING.md).")
    print(f"RPT files: {len(rpt_paths)}  NMRC files: {len(nmrc_paths)}")

    reports = load_reports(rpt_paths)
    print(f"  {len(reports)} de-duplicated reports (one per CCN/fiscal-year)")
    vals = extract_values(nmrc_paths, reports)
    print(f"  extracted financial coordinates for {len(vals)} reports")

    # Build compact per-(CCN, fiscal year) rows. Fiscal year = end year.
    fresh: dict[str, dict[str, list]] = {}
    kept = 0
    for rec, rpt in reports.items():
        v = vals.get(rec)
        if not v or "net_patient_rev" not in v:  # need at least the P&L core
            continue
        fy = _mmddyyyy(rpt["fy_end"])[:4] or rpt["fy_end"][-4:]
        row = [rpt["fy_begin"], rpt["fy_end"], rpt["status"],
               v.get("total_patient_rev"), v.get("net_patient_rev"),
               v.get("total_operating_exp"), v.get("net_income"),
               v.get("total_salaries"), v.get("contract_labor"),
               v.get("wksht_a_total_cost"), v.get("paid_hours")]
        fresh.setdefault(rpt["ccn"], {})[fy] = row
        kept += 1

    # Merge with the existing committed seed so a refresh ADDS fiscal years.
    out_path = os.path.join(OUT_DIR, "facility_year.json")
    merged: dict[str, dict[str, list]] = {}
    if os.path.exists(out_path):
        try:
            with open(out_path, encoding="utf-8") as f:
                prev = json.load(f)
            merged = {ccn: dict(byfy) for ccn, byfy in prev.get("values", {}).items()}
        except Exception:
            merged = {}
    for ccn, byfy in fresh.items():
        merged.setdefault(ccn, {}).update(byfy)  # fresh fiscal years win

    all_years = sorted({fy for byfy in merged.values() for fy in byfy})
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"cols": FIELDS, "years": all_years, "values": merged}, f, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "meta.json"), "w") as f:
        json.dump({"dataset": "CMS SNF Medicare cost report (HCRIS, Form 2540-10)",
                   "source": "https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports",
                   "synthetic": False, "facilities": len(merged), "years": all_years,
                   "latest_year": all_years[-1] if all_years else "",
                   "note": "Structural/lagged tier. Raw dollars; margins derived sum/sum."}, f)
    print(f"Wrote {kept} facility-years this run; seed now covers {len(merged)} facilities "
          f"across years {all_years} -> {OUT_DIR}")


if __name__ == "__main__":
    main()
