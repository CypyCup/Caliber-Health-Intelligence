#!/usr/bin/env python3
"""
build_demo_seed.py — generate the bundled *illustrative* Texas seed.

WHY THIS EXISTS
---------------
The Caliber Workforce Atlas is built on public CMS data (see the fetch_*.py
scripts in this directory, which pull the real datasets). This generator is a
separate, clearly-labeled tool that produces SYNTHETIC demo data so the app
runs immediately without any network access or database.

HONESTY DISCIPLINE (Business Plan §3, §4.1)
-------------------------------------------
Caliber Health Intelligence's entire moat is methodological honesty about data.
Accordingly, this seed:
  * uses FICTIONAL facility names and DEMO certification numbers ("TX-DEMO-###"),
    never real, named operators — so no real facility is ever shown with an
    invented risk flag;
  * is deterministic (fixed random seed) and reproducible;
  * is stamped, in every consuming surface, as illustrative sample data.

To replace it with real CMS Texas data, run the fetch_*.py + build_seed.py
pipeline on a network where data.cms.gov is reachable.
"""
from __future__ import annotations

import json
import os
import random
from datetime import date

SEED = 20260927  # CHI legal formation date, used as a deterministic seed.
rng = random.Random(SEED)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "data", "seed", "texas")
META_DIR = os.path.join(HERE, "..", "data", "seed")

# Quarterly periods for the time-series (PBJ, turnover, star ratings).
QUARTERS = ["2024Q2", "2024Q3", "2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1"]
# Annual periods for the structural / lagged HCRIS financial layer.
FISCAL_YEARS = ["2022Q4", "2023Q4", "2024Q4"]  # stored at Q4 so YoY logic works

# Honest vintage dates per period, reflecting each source's real publication lag.
PBJ_VINTAGE = {  # PBJ lags ~4–5 months after quarter close
    "2024Q2": "2024-11-01", "2024Q3": "2025-02-01", "2024Q4": "2025-05-01",
    "2025Q1": "2025-08-01", "2025Q2": "2025-11-01", "2025Q3": "2026-02-01",
    "2025Q4": "2026-05-01", "2026Q1": "2026-08-01",
}
PROVIDER_VINTAGE = {q: v for q, v in [  # Care Compare refreshes ~monthly
    ("2024Q2", "2024-07-01"), ("2024Q3", "2024-10-01"), ("2024Q4", "2025-01-01"),
    ("2025Q1", "2025-04-01"), ("2025Q2", "2025-07-01"), ("2025Q3", "2025-10-01"),
    ("2025Q4", "2026-01-01"), ("2026Q1", "2026-07-01"),
]}
HCRIS_VINTAGE = {"2022Q4": "2024-06-01", "2023Q4": "2025-04-01", "2024Q4": "2026-02-01"}

TX_CITIES = [
    ("Houston", "Harris", "77002"), ("Houston", "Harris", "77036"),
    ("Dallas", "Dallas", "75204"), ("Dallas", "Dallas", "75235"),
    ("San Antonio", "Bexar", "78229"), ("San Antonio", "Bexar", "78201"),
    ("Austin", "Travis", "78745"), ("Fort Worth", "Tarrant", "76104"),
    ("El Paso", "El Paso", "79905"), ("Arlington", "Tarrant", "76010"),
    ("Corpus Christi", "Nueces", "78412"), ("Plano", "Collin", "75074"),
    ("Lubbock", "Lubbock", "79410"), ("Laredo", "Webb", "78041"),
    ("Amarillo", "Potter", "79106"), ("Waco", "McLennan", "76707"),
    ("Tyler", "Smith", "75701"), ("Beaumont", "Jefferson", "77701"),
]

STREETS = ["Oak Bend Dr", "Prairie View Rd", "Mesquite Ln", "Bluebonnet Way",
           "Cedar Ridge Blvd", "Live Oak Pkwy", "Sabine St", "Guadalupe Trail",
           "Pecan Grove Ave", "Red River Rd", "Comanche Peak Dr", "San Jacinto Blvd"]

# Operator archetypes. Each carries a staffing/turnover/quality/financial
# "posture" so the chain roll-ups tell a coherent, investor-relevant story.
# baseline totals are total-nurse HPRD anchors; risk archetypes trend downward.
CHAINS = [
    dict(id="lone-star-post-acute", name="Lone Star Post-Acute Group", brand="Lone Star",
         ownership="For-profit", owner=dict(id="meridian", name="Meridian Capital Partners (illustrative)",
         private_equity=True, reit=False, pe_sponsor_name="Meridian Capital Partners (illustrative)"),
         n=10, posture="pe_pressured"),
    dict(id="gulf-coast-holdings", name="Gulf Coast Nursing Holdings", brand="Gulf Coast",
         ownership="For-profit", owner=dict(id="ridgeline", name="Ridgeline Equity (illustrative)",
         private_equity=True, reit=False, pe_sponsor_name="Ridgeline Equity (illustrative)"),
         n=8, posture="distressed"),
    dict(id="brazos-valley-care", name="Brazos Valley Care Centers", brand="Brazos Valley",
         ownership="For-profit", owner=dict(id="sunbelt-reit", name="Sunbelt Healthcare REIT (illustrative)",
         private_equity=False, reit=True, reit_name="Sunbelt Healthcare REIT (illustrative)"),
         n=8, posture="mixed"),
    dict(id="alamo-care-partners", name="Alamo Care Partners", brand="Alamo",
         ownership="For-profit", owner=dict(id="evergreen-reit", name="Evergreen Medical Properties (illustrative)",
         private_equity=False, reit=True, reit_name="Evergreen Medical Properties (illustrative)"),
         n=6, posture="mixed"),
    dict(id="hill-country-senior", name="Hill Country Senior Living", brand="Hill Country",
         ownership="Non-profit", owner=dict(id="hill-country-np", name="Hill Country Senior Living Foundation (illustrative)",
         private_equity=False, reit=False), n=6, posture="strong"),
    dict(id="trinity-faith", name="Trinity Faith Communities", brand="Trinity",
         ownership="Non-profit", owner=dict(id="trinity-np", name="Trinity Faith Communities (illustrative)",
         private_equity=False, reit=False), n=5, posture="strong"),
    dict(id="panhandle-health", name="Panhandle Health Services", brand="Panhandle",
         ownership="For-profit", owner=dict(id="panhandle-op", name="Panhandle Health Services (illustrative)",
         private_equity=False, reit=False), n=5, posture="mixed"),
]
N_INDEPENDENT = 5  # unaffiliated facilities

POSTURE = {
    #                       total_hprd  turnover%  agency%   star   drift/qtr (total hprd)
    "strong":      dict(total=4.30, turnover=38.0, agency=3.0,  star=4, drift=+0.010),
    "mixed":       dict(total=3.65, turnover=50.0, agency=9.0,  star=3, drift=-0.005),
    "pe_pressured":dict(total=3.35, turnover=58.0, agency=17.0, star=2, drift=-0.020),
    "distressed":  dict(total=3.05, turnover=68.0, agency=28.0, star=2, drift=-0.030),
}


def jitter(base: float, spread: float) -> float:
    return base + rng.uniform(-spread, spread)


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def build():
    facilities, owners_by_id, chains_out = [], {}, []
    snapshots = []

    fac_counter = 0

    def emit_facility(chain=None):
        nonlocal fac_counter
        fac_counter += 1
        ccn = f"TX-DEMO-{fac_counter:03d}"
        city, county, zip_ = rng.choice(TX_CITIES)
        posture = chain["posture"] if chain else rng.choice(["mixed", "mixed", "strong", "pe_pressured"])
        p = POSTURE[posture]
        beds = rng.choice([60, 84, 96, 100, 112, 120, 128, 140, 150, 180])
        occ = clamp(jitter(0.82 if posture != "distressed" else 0.72, 0.08), 0.55, 0.98)
        residents = round(beds * occ)

        name_city = city
        if chain:
            name = f"{chain['brand']} {name_city} {rng.choice(['Care Center','Health & Rehab','Nursing & Rehabilitation','Post-Acute Center'])}"
            owner = chain["owner"]
            owners_by_id[owner["id"]] = owner
            chain_id = chain["id"]
            owner_id = owner["id"]
            independent = False
        else:
            name = f"{name_city} {rng.choice(['Community','Meadows','Gardens','Villa'])} {rng.choice(['Nursing Center','Care & Rehab','Health Center'])}"
            owner = dict(id=f"ind-{ccn.lower()}", name=f"{name} (illustrative owner)",
                         private_equity=False, reit=False)
            owners_by_id[owner["id"]] = owner
            chain_id = None
            owner_id = owner["id"]
            independent = True

        facilities.append(dict(
            ccn=ccn, name=name, address=f"{rng.randint(100, 9899)} {rng.choice(STREETS)}",
            city=city, state="TX", county=county, zip=zip_,
            ownership_type=chain["ownership"] if chain else rng.choice(["For-profit", "For-profit", "Non-profit"]),
            certified_beds=beds, avg_residents_per_day=residents,
            chain_id=chain_id, owner_id=owner_id, independent=independent,
        ))

        # ---- time-series metrics (quarterly) --------------------------------
        base_total = jitter(p["total"], 0.35)
        base_turn = jitter(p["turnover"], 8.0)
        base_agency = clamp(jitter(p["agency"], 6.0), 0.0, 55.0)
        star_center = p["star"]
        for i, q in enumerate(QUARTERS):
            total = clamp(base_total + p["drift"] * i + jitter(0, 0.06), 1.9, 5.6)
            rn = clamp(total * jitter(0.16, 0.03), 0.15, 1.4)
            lpn = clamp(total * jitter(0.24, 0.03), 0.2, 1.6)
            cna = clamp(total - rn - lpn, 0.9, 3.6)
            agency = clamp(base_agency - p["drift"] * 4 * i + jitter(0, 3.0), 0.0, 60.0)
            weekend = clamp(total * jitter(0.86, 0.05), 1.4, 5.4)
            turnover = clamp(base_turn - p["drift"] * 25 * i + jitter(0, 4.0), 18.0, 95.0)
            rn_turn = clamp(turnover * jitter(0.98, 0.08), 15.0, 99.0)

            def add(metric, value, source, precision=2):
                vint = PBJ_VINTAGE[q] if source == "pbj" else PROVIDER_VINTAGE[q]
                snapshots.append(dict(ccn=ccn, metric_key=metric, period=q,
                                      value=round(value, precision), vintage_date=vint, source=source))

            add("total_nurse_hprd", total, "pbj")
            add("rn_hprd", rn, "pbj")
            add("lpn_hprd", lpn, "pbj")
            add("cna_hprd", cna, "pbj")
            add("contract_staff_pct", agency, "pbj", 1)
            add("weekend_nurse_hprd", weekend, "pbj")
            add("total_nurse_turnover_pct", turnover, "provider", 1)
            add("rn_turnover_pct", rn_turn, "provider", 1)

            # star ratings drift slowly with staffing posture
            staffing_star = int(clamp(round(star_center + (total - p["total"]) * 1.2 + jitter(0, 0.4)), 1, 5))
            overall_star = int(clamp(round(star_center + jitter(0, 0.6)), 1, 5))
            health_star = int(clamp(round(star_center + jitter(-0.2, 0.6)), 1, 5))
            qm_star = int(clamp(round(star_center + jitter(0.3, 0.6)), 1, 5))
            for mk, val in [("overall_star", overall_star), ("staffing_star", staffing_star),
                            ("health_inspection_star", health_star), ("qm_star", qm_star)]:
                snapshots.append(dict(ccn=ccn, metric_key=mk, period=q, value=val,
                                      vintage_date=PROVIDER_VINTAGE[q], source="provider"))

        # ---- regulatory (latest cycle) --------------------------------------
        risk_bias = {"strong": 0.1, "mixed": 0.35, "pe_pressured": 0.6, "distressed": 0.85}[posture]
        total_def = int(clamp(rng.gauss(6 + risk_bias * 12, 3), 0, 40))
        ij = 1 if rng.random() < risk_bias * 0.35 else 0
        if posture == "distressed" and rng.random() < 0.25:
            ij += 1
        cmp_amt = 0.0
        if rng.random() < risk_bias * 0.7:
            cmp_amt = round(rng.uniform(15_000, 320_000) * (1 + risk_bias), -2)
        latest_q = QUARTERS[-1]
        for mk, val, prec in [("total_deficiencies", total_def, 0), ("ij_deficiencies", ij, 0),
                              ("cmp_amount_trailing", cmp_amt, 0)]:
            src = "deficiencies" if mk != "cmp_amount_trailing" else "penalties"
            snapshots.append(dict(ccn=ccn, metric_key=mk, period=latest_q, value=val,
                                  vintage_date="2026-06-01", source=src))

        # ---- financial (annual, structural/lagged HCRIS) --------------------
        base_margin = {"strong": 3.5, "mixed": 0.5, "pe_pressured": -1.5, "distressed": -4.5}[posture]
        base_medicaid = clamp(jitter(62 if posture in ("distressed", "pe_pressured") else 55, 10), 20, 85)
        for j, fy in enumerate(FISCAL_YEARS):
            margin = round(jitter(base_margin - j * 0.4, 2.0), 1)
            medicaid = round(clamp(base_medicaid + jitter(j * 1.0, 3.0), 15, 88), 1)
            occ_pct = round(clamp(occ * 100 + jitter(-j * 1.5, 4.0), 45, 99), 1)
            for mk, val in [("operating_margin_pct", margin), ("medicaid_pct", medicaid),
                            ("occupancy_pct", occ_pct)]:
                snapshots.append(dict(ccn=ccn, metric_key=mk, period=fy, value=val,
                                      vintage_date=HCRIS_VINTAGE[fy], source="hcris"))

    for chain in CHAINS:
        chains_out.append(dict(id=chain["id"], name=chain["name"],
                               owner_id=chain["owner"]["id"], headquarters_state="TX"))
        for _ in range(chain["n"]):
            emit_facility(chain)
    for _ in range(N_INDEPENDENT):
        emit_facility(None)

    owners_out = [dict(id=o["id"], name=o["name"],
                       private_equity=o.get("private_equity", False),
                       reit=o.get("reit", False),
                       reit_name=o.get("reit_name"),
                       pe_sponsor_name=o.get("pe_sponsor_name"))
                  for o in owners_by_id.values()]

    os.makedirs(OUT_DIR, exist_ok=True)
    write(os.path.join(OUT_DIR, "facilities.json"), facilities)
    write(os.path.join(OUT_DIR, "chains.json"), chains_out)
    write(os.path.join(OUT_DIR, "owners.json"), owners_out)
    write(os.path.join(OUT_DIR, "metric_snapshots.json"), snapshots)
    write(os.path.join(META_DIR, "seed_metadata.json"), dict(
        dataset="Caliber Workforce Atlas — Illustrative Texas Demo Seed",
        synthetic=True,
        disclaimer=("SYNTHETIC / ILLUSTRATIVE DATA. Facility names and certification "
                    "numbers are fictional (TX-DEMO-###). Values are generated for "
                    "demonstration only and do not describe any real facility. Replace "
                    "with real CMS data via the etl/ pipeline before any external use."),
        generated_from="etl/build_demo_seed.py",
        seed=SEED,
        facilities=len(facilities), chains=len(chains_out),
        owners=len(owners_out), snapshots=len(snapshots),
        quarters=QUARTERS, fiscal_years=FISCAL_YEARS,
        generated_on=date.today().isoformat(),
    ))
    print(f"Wrote {len(facilities)} facilities, {len(chains_out)} chains, "
          f"{len(owners_out)} owners, {len(snapshots)} snapshots to {OUT_DIR}")


def write(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    build()
