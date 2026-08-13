"""
Central configuration for the real CMS ETL pipeline.

CMS publishes the nursing-home datasets in two places:
  * The Provider Data Catalog (data.cms.gov/provider-data) — a DKAN datastore
    with a query API. Provider Information, Ownership, Deficiencies, Penalties
    all live here, each with a stable dataset identifier.
  * Bulk downloads (data.cms.gov) — the Payroll-Based Journal (PBJ) daily
    staffing files and HCRIS cost reports are large ZIP/CSV downloads.

Dataset identifiers on the Provider Data Catalog occasionally change when CMS
re-publishes. common.resolve_dataset() can look an identifier up by title from
the metastore if the pinned id below stops resolving.
"""

STATE = "TX"  # the bundled sample slice; set to None to pull the full country.

# Quarters to assemble into the time-series (most recent first is fine; the
# builder sorts). Update as new CMS data publishes.
QUARTERS = ["2024Q2", "2024Q3", "2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1"]

PROVIDER_DATA_BASE = "https://data.cms.gov/provider-data/api/1"

# Pinned Provider Data Catalog dataset identifiers (verify via the metastore if
# a fetch 404s — see common.resolve_dataset).
DATASETS = {
    "provider_info": {"id": "4pq5-n9py", "title": "Provider Information"},
    "ownership": {"id": "y2hd-n93e", "title": "Ownership"},
    "deficiencies": {"id": "r5ix-sfxw", "title": "Health Deficiencies"},
    "penalties": {"id": "g6vv-u9sr", "title": "Penalties"},
}

# PBJ bulk-download landing page (the quarterly nurse-staffing files). The
# actual file URLs are resolved from the dataset's data.json; see fetch_pbj.py.
PBJ_DATASET_PAGE = "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing"

# Datasets fetched as a single current CSV into etl/raw/<folder>/, then processed
# by the file-based ingesters (ingest_provider_info.py / ingest_chain_performance.py).
# This unifies the API path with manual uploads — both land CSVs in etl/raw/.
#   * "provider-data" datasets resolve their CSV downloadURL from the metastore.
#   * datasets on other CMS catalogs (e.g. Chain Performance on quality-of-care)
#     have no public query API in the same form; pass their CSV URL via --url.
CSV_DATASETS = {
    "provider_info": {
        "title": "Provider Information", "folder": "provider_info", "source": "provider-data",
        "landing": "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
    },
    "chain_performance": {
        "title": "Nursing Home Chain Performance Measures", "folder": "chain_performance",
        "source": "quality-of-care",
        "landing": "https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures",
    },
}

RAW_DIR = "etl/raw"
OUT_DIR = "data/seed/texas"
