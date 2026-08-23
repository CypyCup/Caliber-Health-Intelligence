#!/usr/bin/env python3
"""
ingest_chain_performance.py — ingest the CMS "Nursing Home Chain Performance
Measures" dataset into the Atlas's real chain layer.

Source: https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures

Real, national, chain-level CMS data. Columns are matched BY NAME (not position),
so it handles both single monthly CMS files and the combined multi-snapshot
archive, and it survives CMS's schema shifts (the Affiliated Entity -> Chain
rename, the RN-hours typo fix, appended legacy columns).

Drop CMS chain files (single monthly, or a combined archive with a
`snapshot_release` column) in etl/raw/chain_performance/ and run:
    python3 etl/ingest_chain_performance.py

Handling per the CMS archive notes:
  * The `National` row is the all-facility benchmark, not a chain — pulled out
    and stored per period (national_history) with the latest as the baseline.
  * Values are text with suppression markers / blanks — cast to numeric, blanks
    -> null.
  * Three quality measures were redefined in Jan 2025; we map pressure-ulcer to
    the current all-resident column and do not stitch it across the boundary.
"""
from __future__ import annotations

import csv
import glob
import json
import os
from collections import defaultdict

from common import archive_capture, period_from_filename

RAW_DIR = os.path.join("etl", "raw", "chain_performance")
OUT_DIR = os.path.join("data", "seed", "chains_cms")

# Descriptor fields -> exact CMS column name.
DESCRIPTORS = {
    "num_facilities": "Number of facilities",
    "num_states": "Number of states and territories with operations",
    "sff": "Number of Special Focus Facilities (SFF)",
    "sff_candidates": "Number of SFF candidates",
    "abuse_count": "Number of facilities with an abuse icon",
    "abuse_pct": "Percentage of facilities with an abuse icon",
    "pct_for_profit": "Percent of facilities classified as for-profit",
    "pct_non_profit": "Percent of facilities classified as non-profit",
    "pct_government": "Percent of facilities classified as government-owned",
}

# Metric keys -> exact CMS column name.
METRICS = {
    "overall_star": "Average overall 5-star rating",
    "health_inspection_star": "Average health inspection rating",
    "staffing_star": "Average staffing rating",
    "qm_star": "Average quality rating",
    "total_nurse_hprd": "Average total nurse hours per resident day",
    "weekend_nurse_hprd": "Average total weekend nurse hours per resident day",
    "rn_hprd": "Average total Registered Nurse hours per resident day",
    "total_nurse_turnover_pct": "Average total nursing staff turnover percentage",
    "rn_turnover_pct": "Average Registered Nurse turnover percentage",
    "admin_departures": "Average number of administrators who have left the nursing home",
    "fines_count": "Total number of fines",
    "fines_total_usd": "Total amount of fines in dollars",
    "fines_avg_usd": "Average amount of fines in dollars",
    "payment_denials_total": "Total number of payment denials",
    "rehosp_pct": "Average percentage of short-stay residents who were re-hospitalized after a nursing home admission",
    "ed_visit_pct": "Average percentage of short-stay residents who have had an outpatient emergency department visit",
    "ls_antipsychotic_pct": "Average percentage of long-stay residents who received an antipsychotic medication",
    "ls_falls_major_pct": "Average percentage of long-stay residents experiencing one or more falls with major injury",
    "ls_pressure_ulcer_pct": "Average percentage of long-stay residents with pressure ulcers",
    "ls_uti_pct": "Average percentage of long-stay residents with a urinary tract infection",
    "preventable_readmit_pct": "Average rate of potentially preventable hospital readmissions 30 days after discharge from a SNF",
}


def clean(v):
    v = (v or "").strip().replace("$", "").replace(",", "").replace("%", "")
    if v in ("", "N/A", "NA", "-", "*", ".", "Not Available"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def norm_header(h: str) -> str:
    return " ".join(h.strip().split()).lower()


def main() -> None:
    files = sorted(glob.glob(os.path.join(RAW_DIR, "*.csv")))
    if not files:
        raise SystemExit(f"No CSVs in {RAW_DIR}/ (drop the Chain Performance file[s] there).")

    # Accumulators
    chains: dict[str, dict] = {}          # chain_id -> descriptor (from newest period)
    chain_desc_period: dict[str, str] = {}  # chain_id -> period the descriptor came from
    # Compact nested history: chain_id -> metric_key -> period -> value
    history: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    national_hist: dict[str, dict] = {}   # period -> {metric: value}
    all_periods: set[str] = set()

    for path in files:
        with open(path, encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader)
            col = {norm_header(h): i for i, h in enumerate(header)}
            has_snap = "snapshot_release" in col
            file_period = period_from_filename(path)

            def idx(name):
                return col.get(norm_header(name))

            i_chain = idx("Chain") if idx("Chain") is not None else idx("Affiliated entity")
            i_cid = idx("Chain ID") if idx("Chain ID") is not None else idx("Affiliated entity ID")
            i_snap = col.get("snapshot_release")
            desc_idx = {k: idx(v) for k, v in DESCRIPTORS.items()}
            met_idx = {k: idx(v) for k, v in METRICS.items()}

            archive_rows = []
            for row in reader:
                if not row or i_chain is None or i_chain >= len(row):
                    continue
                period = (row[i_snap][:7] if has_snap and row[i_snap] else file_period)
                all_periods.add(period)
                vintage = f"{period}-01"
                name = (row[i_chain] or "").strip()
                cid = (row[i_cid] or "").strip() if i_cid is not None else ""

                if name == "National" or not cid:
                    if name == "National":
                        nh = national_hist.setdefault(period, {"period": period, "vintage_date": vintage})
                        for k, ix in {**desc_idx, **met_idx}.items():
                            val = clean(row[ix]) if ix is not None and ix < len(row) else None
                            if val is not None:
                                nh[k] = val
                    continue

                chain_id = f"cms-{cid}"
                archive_rows.append({"chain_id": chain_id, "period": period})
                # descriptor: keep the newest period's values
                if chain_desc_period.get(chain_id, "") <= period:
                    chain_desc_period[chain_id] = period
                    chains[chain_id] = {"id": chain_id, "cms_chain_id": cid, "name": name,
                                        **{k: clean(row[ix]) if ix is not None and ix < len(row) else None
                                           for k, ix in desc_idx.items()}}
                for k, ix in met_idx.items():
                    val = clean(row[ix]) if ix is not None and ix < len(row) else None
                    if val is not None:
                        history[chain_id][k][period] = round(val, 4)
            archive_capture("chain_performance", archive_rows, key_fields=("chain_id", "period"))

    periods = sorted(all_periods)
    latest = periods[-1] if periods else ""
    national_latest = national_hist.get(latest, {})

    # Tag each chain with the newest snapshot it appeared in; "current" chains
    # are those present in the latest snapshot (others entered/exited the file).
    for cid, c in chains.items():
        c["last_period"] = chain_desc_period.get(cid, "")
    current = sum(1 for c in chains.values() if c["last_period"] == latest)

    # Compact nested history (chain_id -> metric -> period -> value).
    hist_out = {cid: {mk: dict(pv) for mk, pv in ms.items()} for cid, ms in history.items()}

    os.makedirs(OUT_DIR, exist_ok=True)
    _write(os.path.join(OUT_DIR, "chains.json"), list(chains.values()))
    _write(os.path.join(OUT_DIR, "chain_history.json"), {"latest_period": latest, "periods": periods, "values": hist_out})
    _write(os.path.join(OUT_DIR, "national.json"), national_latest)
    _write(os.path.join(OUT_DIR, "national_history.json"), {"periods": {p: national_hist[p] for p in periods if p in national_hist}})
    _write(os.path.join(OUT_DIR, "meta.json"), {
        "dataset": "CMS Nursing Home Chain Performance Measures",
        "source": "https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures",
        "synthetic": False,
        "periods": periods,
        "latest_period": latest,
        "chains": current,
        "chains_all_time": len(chains),
        "national_facilities": int(national_latest.get("num_facilities") or 0),
    })
    total_pts = sum(len(pv) for ms in history.values() for pv in ms.values())
    print(f"Wrote {len(chains)} chains ({current} current), {total_pts} metric points, "
          f"{len(periods)} periods ({periods[0]}..{latest}) -> {OUT_DIR}")


# Remove the obsolete flat metrics file if present.
def _cleanup():
    old = os.path.join(OUT_DIR, "chain_metrics.json")
    if os.path.exists(old):
        os.remove(old)


def _write(path: str, obj) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
    _cleanup()
