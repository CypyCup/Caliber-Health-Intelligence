#!/usr/bin/env python3
"""
load_supabase.py — push the ingested CMS data (facilities, chains, and all
monthly metric history) into Supabase via PostgREST.

Prereqs:
  * Run supabase/schema.sql in your project first.
  * Export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role — server side
    only; never ship it to the browser).

Usage:
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \\
    python3 etl/load_supabase.py [step ...]

With no arguments every step runs. Pass one or more step names to load only
those tables (handy to resume after a partial run), e.g.:
  python3 etl/load_supabase.py pbj chain_national
Steps: cms_chains  facilities  metric_snapshots  chain_metric_snapshots
       pbj  chain_national

Re-run after each monthly refresh; upserts are idempotent.
"""
from __future__ import annotations

import json
import os
import sys

import requests

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
NATIONAL = os.path.join("data", "seed", "national")
CHAINS = os.path.join("data", "seed", "chains_cms")
BATCH = 1000


def upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    endpoint = f"{URL}/rest/v1/{table}?on_conflict={on_conflict}"
    headers = {
        "apikey": KEY, "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        resp = requests.post(endpoint, headers=headers, data=json.dumps(chunk), timeout=180)
        resp.raise_for_status()
    print(f"  {table}: upserted {len(rows)} rows")


def load_json(path: str):
    with open(path) as f:
        return json.load(f)


def as_int(v):
    return int(v) if v is not None else None


def load_cms_chains() -> None:
    chains = load_json(os.path.join(CHAINS, "chains.json"))
    for c in chains:
        for k in ("num_facilities", "num_states", "sff", "sff_candidates", "abuse_count"):
            c[k] = as_int(c.get(k))
    upsert("cms_chains", chains, "id")


def load_facilities() -> None:
    facilities = load_json(os.path.join(NATIONAL, "facilities.json"))
    upsert("facilities", facilities, "ccn")


def load_metric_snapshots() -> None:
    # Expand the compact history one period at a time to keep memory bounded.
    hist = load_json(os.path.join(NATIONAL, "facility_history.json"))
    for period, by_ccn in hist["periods"].items():
        vintage = f"{period}-01"
        rows = []
        for ccn, vals in by_ccn.items():
            for metric_key, value in vals.items():
                rows.append({"ccn": ccn, "metric_key": metric_key, "period": period,
                             "value": value, "vintage_date": vintage, "source": "provider"})
        upsert("metric_snapshots", rows, "ccn,metric_key,period")
        print(f"    (period {period}: {len(rows)} snapshot rows)")


def load_chain_metric_snapshots() -> None:
    ch = load_json(os.path.join(CHAINS, "chain_history.json"))
    rows = []
    for chain_id, metrics in ch["values"].items():
        for metric_key, by_period in metrics.items():
            for period, value in by_period.items():
                rows.append({"chain_id": chain_id, "metric_key": metric_key, "period": period,
                             "value": value, "vintage_date": f"{period}-01", "source": "chain_performance"})
    upsert("chain_metric_snapshots", rows, "chain_id,metric_key,period")


def load_pbj() -> None:
    # Raw numerators/denominators per facility-quarter. PBJ is a historical
    # superset of facilities (no FK), so every row loads regardless of whether
    # the facility still appears in the current Provider Information snapshot.
    try:
        pbj = load_json(os.path.join(NATIONAL, "..", "pbj", "facility_pbj.json"))
    except FileNotFoundError:
        print("  (no PBJ seed — skipping)")
        return
    cols = pbj["cols"]  # rd,tnh,tnc,rnh,lpnh,aideh,allh,allc,comp
    field = ["resident_days", "total_nurse_hours", "total_nurse_contract_hours", "rn_hours",
             "lpn_hours", "aide_hours", "total_hours_all_staff", "total_contract_hours_all_staff",
             "reporting_completeness_pct"]
    prows = []
    total = 0
    for ccn, byq in pbj["values"].items():
        for q, vals in byq.items():
            row = {"ccn": ccn, "cy_qtr": q}
            row.update({field[i]: vals[i] for i in range(len(cols))})
            prows.append(row)
            if len(prows) >= 50000:
                upsert("pbj_facility_quarter", prows, "ccn,cy_qtr"); total += len(prows); prows = []
    upsert("pbj_facility_quarter", prows, "ccn,cy_qtr"); total += len(prows)
    print(f"    (pbj total: {total} facility-quarter rows)")


def load_chain_national() -> None:
    national = load_json(os.path.join(CHAINS, "national.json"))
    period = national.get("period")
    vintage = national.get("vintage_date")
    nat_rows = [{"metric_key": k, "value": v, "period": period, "vintage_date": vintage}
                for k, v in national.items()
                if k not in ("period", "vintage_date") and isinstance(v, (int, float))]
    upsert("chain_national", nat_rows, "metric_key")


STEPS = {
    "cms_chains": load_cms_chains,
    "facilities": load_facilities,
    "metric_snapshots": load_metric_snapshots,
    "chain_metric_snapshots": load_chain_metric_snapshots,
    "pbj": load_pbj,
    "chain_national": load_chain_national,
}


def main() -> None:
    if not URL or not KEY:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

    requested = sys.argv[1:]
    unknown = [s for s in requested if s not in STEPS]
    if unknown:
        raise SystemExit(f"Unknown step(s): {', '.join(unknown)}. "
                         f"Choose from: {', '.join(STEPS)}")
    to_run = requested or list(STEPS)  # default: all, in order

    for name in STEPS:  # preserve dependency order regardless of arg order
        if name in to_run:
            STEPS[name]()

    print("Done. Set CHI_DATA_SOURCE=supabase (and NEXT_PUBLIC_SUPABASE_* vars) to serve from Postgres.")


if __name__ == "__main__":
    main()
