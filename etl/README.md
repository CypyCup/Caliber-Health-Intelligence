# ETL — Caliber Workforce Atlas

The Atlas runs on **real CMS data** end to end. Two file-based ingesters (no
network needed — you supply the CMS CSVs) power the live site:

| Ingester | Input (drop in) | Output | Powers |
|---|---|---|---|
| `ingest_provider_info.py` | `etl/raw/provider_info/YYYY-MM.csv` (Provider Information) | `data/seed/national/` | 14,693 real facilities + facility→chain link |
| `ingest_chain_performance.py` | `etl/raw/chain_performance/YYYY-MM.csv` (Chain Performance Measures) | `data/seed/chains_cms/` | 635 real chains + chain measures |

Download both from data.cms.gov, name each file `YYYY-MM.csv`, drop them in the
matching `etl/raw/…` folder, and run:

```bash
python3 etl/ingest_provider_info.py       # facilities (+ point-in-time archive)
python3 etl/ingest_chain_performance.py   # chains (+ point-in-time archive)
```

The two datasets link by **CMS Chain ID** (verified crosswalk). Add a second
monthly vintage of either file to light up month-over-month trends and the
archive diff automatically. PE-sponsor / REIT resolution is layered on top via
`data/seed/overrides/chain_ownership.json` (CHI's value-add; CMS files have none).

---

The API-based national pipeline below (`fetch_*.py` → `build_seed.py`) is the
alternative for pulling everything programmatically where `data.cms.gov` is
reachable; it writes the same shapes.

## Real CMS seed — turnkey national pipeline

Requires `requests` and network access to `data.cms.gov`. One command runs the
whole thing (fetch + point-in-time archive + crosswalk + seed):

```bash
pip install -r etl/requirements.txt

# National model of all ~14,703 facilities / ~616 chains.
# (PBJ needs local CSVs; add --skip-pbj for a first run without them.)
python3 etl/run_national.py --state ALL

# ...or a single state:
python3 etl/run_national.py --state TX
```

Prefer to run the steps by hand? They are:

```bash
python3 etl/fetch_provider_info.py   # Care Compare (+ archive capture)
python3 etl/fetch_ownership.py       # ownership -> PE/REIT heuristic
python3 etl/fetch_deficiencies.py    # citations, Immediate Jeopardy
python3 etl/fetch_penalties.py       # CMPs
# PBJ staffing: download the quarterly CSVs (see fetch_pbj.py), drop them in
# etl/raw/pbj/<QUARTER>.csv, then:
python3 etl/fetch_pbj.py
python3 etl/build_seed.py            # join -> facilities/owners/chains/snapshots
```

Set the state / quarters in `config.py` (`STATE = "TX"`; `STATE = None` for national),
or pass `--state` to `run_national.py`.

### The point-in-time archive

Every Provider Data Catalog fetch is captured under a UTC timestamp in
`etl/archive/<source>/` and diffed against the prior capture; `etl/archive/manifest.json`
indexes them. CMS overwrites its files with no changelog, so this capture is the
one step whose value is permanently lost if skipped (Business Plan §3) — run the
pipeline on a schedule.

### Crosswalk confidence

`build_seed.py` marks facility→chain membership **verified** (from the CMS
affiliated-entity grouping) and sponsor/REIT resolution **inferred** (heuristic
over CMS ownership text). Inferred mappings are excluded from published
chain-level figures in the app. Curate verified sponsor/landlord overrides as the
crosswalk matures.

### Load into Supabase (production)

```bash
# 1. Apply the schema (tables + read-path views) in your Supabase project:
#    run supabase/schema.sql in the SQL editor.
# 2. Build + load in one command:
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...     # service role, server-side only
python3 etl/run_national.py --state ALL --load

# ...or load an already-built seed on its own:
python3 etl/load_supabase.py
```

Then set `CHI_DATA_SOURCE=supabase` (and `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) for the app to serve the national data.

## Vintage discipline

Every metric is stamped with an honest `vintage_date`:
- **PBJ** staffing → quarter-end + ~135 days (real publication lag).
- **Care Compare** (turnover, stars) → the pull date.
- **HCRIS** financials → the cost-report period (12–18 months lagged).

The app surfaces this on every number. See `../docs/data-sources.md`.

## Column-name drift

CMS renames columns across publications. `build_seed.py`'s `pick()` tries
several candidate names per field and warns instead of crashing when one is
missing — so a rename degrades gracefully rather than breaking the build.
