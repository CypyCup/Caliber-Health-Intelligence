#!/usr/bin/env python3
"""
run_national.py — the turnkey national CMS pipeline.

One command builds the full model of every U.S. skilled nursing facility and its
operating chain from public CMS data, then (optionally) loads Supabase.

    # National (all states). Set STATE=None in config.py, or override here.
    python3 etl/run_national.py --state ALL

    # Then load Supabase (requires schema.sql applied + env vars):
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 etl/run_national.py --state ALL --load

Steps:
  1. Fetch + archive Provider Information, Ownership, Deficiencies, Penalties
     from the CMS Provider Data Catalog (each capture is point-in-time archived).
  2. Aggregate PBJ staffing from local quarterly CSVs in etl/raw/pbj/ (download
     these first — see fetch_pbj.py; they are large bulk files).
  3. Build the seed (facilities, owners, chains crosswalk, metric_snapshots).
  4. Optionally load Supabase.

Run quarterly. Archive capture is the one step whose value is lost permanently if
skipped, so it runs on every invocation (Business Plan §3, §13).
"""
from __future__ import annotations

import argparse
import sys

import config
import fetch_provider_info
import fetch_ownership
import fetch_deficiencies
import fetch_penalties
import fetch_pbj
import build_seed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default=None, help='Two-letter state, or "ALL" for national.')
    ap.add_argument("--skip-pbj", action="store_true", help="Skip PBJ aggregation (no CSVs yet).")
    ap.add_argument("--load", action="store_true", help="Load Supabase after building the seed.")
    args = ap.parse_args()

    if args.state:
        config.STATE = None if args.state.upper() == "ALL" else args.state.upper()
    print(f"== Caliber national pipeline · state={config.STATE or 'ALL'} ==")

    print("\n[1/4] Provider Data Catalog (with point-in-time archive capture)")
    fetch_provider_info.main()
    fetch_ownership.main()
    fetch_deficiencies.main()
    fetch_penalties.main()

    if args.skip_pbj:
        print("\n[2/4] PBJ staffing — SKIPPED (--skip-pbj)")
    else:
        print("\n[2/4] PBJ staffing aggregation")
        try:
            fetch_pbj.main()
        except SystemExit as e:
            print(f"  PBJ skipped: {e}")

    print("\n[3/4] Building seed (facilities, crosswalk, snapshots)")
    build_seed.build()

    if args.load:
        print("\n[4/4] Loading Supabase")
        import load_supabase
        load_supabase.main()
    else:
        print("\n[4/4] Load skipped. Run with --load (and SUPABASE_* env) to publish.")

    print("\nDone. Set CHI_DATA_SOURCE=supabase to serve the national data.")


if __name__ == "__main__":
    sys.exit(main())
