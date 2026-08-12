# ETL — Caliber Workforce Atlas

Two independent paths write the same seed shape that the app consumes
(`data/seed/texas/*.json` + `data/seed/seed_metadata.json`):

| Path | Script | Network? | Output |
|---|---|---|---|
| **Demo seed** (bundled) | `build_demo_seed.py` | none | synthetic, `synthetic: true` |
| **Real CMS seed** | `fetch_*.py` → `build_seed.py` | needs `data.cms.gov` | real, `synthetic: false` |

## Demo seed (no network, no deps)

```bash
python3 etl/build_demo_seed.py
```

Uses only the standard library. Deterministic (fixed seed). Produces fictional
Texas facilities (`TX-DEMO-###`) so the app runs immediately. **Never** attaches
invented numbers to real, named facilities.

## Real CMS seed

Requires `requests` and network access to `data.cms.gov`:

```bash
pip install -r etl/requirements.txt

# 1. Provider Data Catalog pulls (Care Compare, ownership, deficiencies, penalties)
python3 etl/fetch_provider_info.py
python3 etl/fetch_ownership.py
python3 etl/fetch_deficiencies.py
python3 etl/fetch_penalties.py

# 2. PBJ staffing — download the quarterly CSVs first (see fetch_pbj.py docstring),
#    drop them in etl/raw/pbj/<QUARTER>.csv, then:
python3 etl/fetch_pbj.py

# 3. Join everything into the seed the app reads
python3 etl/build_seed.py
```

Set the state / quarters in `config.py` (`STATE = "TX"`; `STATE = None` for national).

### Load into Supabase (production)

```bash
# after running supabase/schema.sql in your project
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...     # service role, server-side only
python3 etl/load_supabase.py
```

Then set `CHI_DATA_SOURCE=supabase` for the app.

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
