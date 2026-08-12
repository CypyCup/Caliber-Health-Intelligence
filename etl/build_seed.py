#!/usr/bin/env python3
"""Join the raw CMS pulls into the seed JSON the Atlas consumes.

Inputs  (produced by the fetch_*.py scripts, in etl/raw/):
    provider_info.json, ownership.json, deficiencies.json, penalties.json, pbj_agg.json
Outputs (data/seed/texas/):
    facilities.json, owners.json, chains.json, metric_snapshots.json
    and data/seed/seed_metadata.json  (synthetic=False)

This mapper is deliberately defensive about CMS column names, which drift across
publications: pick() tries several candidate keys. When a field can't be found
it warns rather than crashing, so a column rename degrades gracefully.

NOTE ON TRENDS: PBJ gives true multi-quarter staffing history, so staffing
metrics trend immediately. Care Compare (turnover, star ratings) is a current
snapshot — its history accrues as CHI archives the monthly pull over time, which
is exactly how the Atlas's trend advantage compounds. On a first run those
metrics carry a single period.
"""
from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import date, timedelta

from common import read_raw
from config import OUT_DIR, QUARTERS

META_DIR = os.path.join(OUT_DIR, "..")


def pick(row: dict, *keys, default=None):
    for k in keys:
        for cand in (k, k.lower(), k.upper()):
            if cand in row and row[cand] not in (None, ""):
                return row[cand]
    return default


def num(v, default=None):
    try:
        return float(str(v).replace(",", "").replace("$", ""))
    except (TypeError, ValueError):
        return default


def quarter_end(period: str) -> date:
    y, q = int(period[:4]), int(period[-1])
    month = q * 3
    if month == 12:
        return date(y, 12, 31)
    return date(y, month + 1, 1) - timedelta(days=1)


def pbj_vintage(period: str) -> str:
    # PBJ publishes roughly 4–5 months after quarter close.
    return (quarter_end(period) + timedelta(days=135)).isoformat()


def build() -> None:
    provider = read_raw("provider_info")
    ownership = _safe_read("ownership")
    deficiencies = _safe_read("deficiencies")
    penalties = _safe_read("penalties")
    pbj = _safe_read("pbj_agg")

    run_vintage = date.today().isoformat()

    # ---- owners & chains from ownership + affiliated entity ------------------
    owners: dict[str, dict] = {}
    chains: dict[str, dict] = {}
    pe_ccns, reit_ccns = _classify_ownership(ownership)

    facilities = []
    snapshots = []

    for row in provider:
        ccn = str(pick(row, "cms_certification_number_ccn", "federal_provider_number", "provnum") or "").strip()
        if not ccn:
            continue

        affiliated = pick(row, "affiliated_entity_name")
        affiliated_id = pick(row, "affiliated_entity_id")
        chain_id = None
        if affiliated and affiliated_id:
            chain_id = f"aff-{affiliated_id}"
            chains.setdefault(chain_id, {"id": chain_id, "name": affiliated,
                                         "owner_id": chain_id, "headquarters_state": pick(row, "state")})

        is_pe = ccn in pe_ccns
        is_reit = ccn in reit_ccns
        owner_id = chain_id or f"own-{ccn}"
        owners.setdefault(owner_id, {
            "id": owner_id,
            "name": affiliated or (pick(row, "provider_name", "provname") or ccn),
            "private_equity": is_pe,
            "reit": is_reit,
            "reit_name": "Identified via CMS ownership records" if is_reit else None,
            "pe_sponsor_name": "Identified via CMS ownership records" if is_pe else None,
        })
        # A chain inherits PE/REIT if any member has it.
        if chain_id:
            owners[owner_id]["private_equity"] |= is_pe
            owners[owner_id]["reit"] |= is_reit

        facilities.append({
            "ccn": ccn,
            "name": pick(row, "provider_name", "provname", default=ccn),
            "address": pick(row, "provider_address", "address", default=""),
            "city": pick(row, "citytown", "city", default=""),
            "state": pick(row, "state", default=""),
            "county": pick(row, "countyparish", "county_name", default=""),
            "zip": str(pick(row, "zip_code", "zip", default="")),
            "ownership_type": _norm_ownership_type(pick(row, "ownership_type", default="")),
            "certified_beds": int(num(pick(row, "number_of_certified_beds"), 0) or 0),
            "avg_residents_per_day": int(num(pick(row, "average_number_of_residents_per_day"), 0) or 0),
            "chain_id": chain_id,
            "owner_id": owner_id,
            "independent": chain_id is None,
        })

        # ---- current-snapshot metrics from Provider Information --------------
        latest = QUARTERS[-1]
        for key, *cands in [
            ("total_nurse_turnover_pct", "total_nursing_staff_turnover"),
            ("rn_turnover_pct", "registered_nurse_turnover"),
            ("overall_star", "overall_rating"),
            ("staffing_star", "staffing_rating"),
            ("health_inspection_star", "health_inspection_rating"),
            ("qm_star", "qm_rating"),
        ]:
            val = num(pick(row, *cands))
            if val is not None:
                snapshots.append({"ccn": ccn, "metric_key": key, "period": latest,
                                  "value": val, "vintage_date": run_vintage, "source": "provider"})

    # ---- PBJ staffing time-series -------------------------------------------
    for r in pbj:
        ccn = str(r.get("ccn") or "").strip()
        period = r.get("period")
        if not ccn or period not in QUARTERS:
            continue
        vint = pbj_vintage(period)
        for key in ("total_nurse_hprd", "rn_hprd", "lpn_hprd", "cna_hprd",
                    "contract_staff_pct", "weekend_nurse_hprd"):
            if r.get(key) is not None:
                snapshots.append({"ccn": ccn, "metric_key": key, "period": period,
                                  "value": r[key], "vintage_date": vint, "source": "pbj"})

    # ---- regulatory: deficiencies & penalties -------------------------------
    _add_deficiencies(deficiencies, snapshots)
    _add_penalties(penalties, snapshots)

    # ---- write --------------------------------------------------------------
    os.makedirs(OUT_DIR, exist_ok=True)
    _write(os.path.join(OUT_DIR, "facilities.json"), facilities)
    _write(os.path.join(OUT_DIR, "owners.json"), list(owners.values()))
    _write(os.path.join(OUT_DIR, "chains.json"), list(chains.values()))
    _write(os.path.join(OUT_DIR, "metric_snapshots.json"), snapshots)
    _write(os.path.join(META_DIR, "seed_metadata.json"), {
        "dataset": "Caliber Workforce Atlas — CMS Data Seed",
        "synthetic": False,
        "disclaimer": "Built from public CMS datasets via the etl/ pipeline.",
        "generated_from": "etl/build_seed.py",
        "facilities": len(facilities), "chains": len(chains), "owners": len(owners),
        "snapshots": len(snapshots), "quarters": QUARTERS,
        "generated_on": run_vintage,
    })
    print(f"Built {len(facilities)} facilities, {len(chains)} chains, {len(snapshots)} snapshots.")
    if not pbj:
        print("WARNING: no PBJ data — staffing metrics and their trends will be empty. See fetch_pbj.py.")


def _classify_ownership(ownership: list[dict]) -> tuple[set, set]:
    """Heuristic PE / REIT classification from CMS ownership role & name text.
    CMS does not natively flag PE/REIT, so this is a documented heuristic that
    CHI can refine; it looks for tell-tale strings in role/type/name fields."""
    pe, reit = set(), set()
    for row in ownership:
        ccn = str(pick(row, "cms_certification_number_ccn", "provnum") or "").strip()
        if not ccn:
            continue
        blob = " ".join(str(pick(row, k, default="")) for k in
                        ("role_played_by_owner_or_manager_in_facility", "owner_type", "owner_name", "type_of_owner")).upper()
        if "PRIVATE EQUITY" in blob:
            pe.add(ccn)
        if "REIT" in blob or "REAL ESTATE INVESTMENT TRUST" in blob:
            reit.add(ccn)
    return pe, reit


def _add_deficiencies(deficiencies: list[dict], snapshots: list[dict]) -> None:
    counts: dict[str, int] = defaultdict(int)
    ij: dict[str, int] = defaultdict(int)
    vint = date.today().isoformat()
    for row in deficiencies:
        ccn = str(pick(row, "cms_certification_number_ccn", "provnum") or "").strip()
        if not ccn:
            continue
        counts[ccn] += 1
        sev = str(pick(row, "scope_severity_code", "deficiency_category", default="")).upper()
        if sev and sev[-1] in ("J", "K", "L"):
            ij[ccn] += 1
    latest = QUARTERS[-1]
    for ccn in counts:
        snapshots.append({"ccn": ccn, "metric_key": "total_deficiencies", "period": latest,
                          "value": counts[ccn], "vintage_date": vint, "source": "deficiencies"})
        snapshots.append({"ccn": ccn, "metric_key": "ij_deficiencies", "period": latest,
                          "value": ij[ccn], "vintage_date": vint, "source": "deficiencies"})


def _add_penalties(penalties: list[dict], snapshots: list[dict]) -> None:
    cmp_total: dict[str, float] = defaultdict(float)
    cutoff = date.today().replace(year=date.today().year - 3)
    for row in penalties:
        ccn = str(pick(row, "cms_certification_number_ccn", "provnum") or "").strip()
        if not ccn:
            continue
        ptype = str(pick(row, "penalty_type", default="")).upper()
        if "FINE" in ptype or "CMP" in ptype or "CIVIL" in ptype:
            cmp_total[ccn] += num(pick(row, "fine_amount", "penalty_amount"), 0) or 0
    vint = date.today().isoformat()
    latest = QUARTERS[-1]
    for ccn, amt in cmp_total.items():
        snapshots.append({"ccn": ccn, "metric_key": "cmp_amount_trailing", "period": latest,
                          "value": round(amt, 2), "vintage_date": vint, "source": "penalties"})


def _norm_ownership_type(raw: str) -> str:
    r = str(raw).lower()
    if "non" in r and "profit" in r:
        return "Non-profit"
    if "government" in r or "gov" in r:
        return "Government"
    return "For-profit"


def _safe_read(name: str) -> list[dict]:
    try:
        return read_raw(name)
    except FileNotFoundError:
        print(f"  (no {name}.json — skipping)")
        return []


def _write(path: str, obj) -> None:
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    build()
