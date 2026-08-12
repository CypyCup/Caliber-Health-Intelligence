# Caliber Workforce Atlas

The free, public-data workforce-intelligence surface for **Caliber Health
Intelligence** — every U.S. nursing home resolved to the **chains, PE sponsors,
and REIT landlords** that own it, on a **point-in-time archive** of every quarter
CMS publishes and then overwrites. That's staffing, turnover, agency reliance,
regulatory exposure, and financial pressure at the level an underwriter decides
on — with the quarter-over-quarter and year-over-year trends CMS Care Compare
has no memory of.

Built for the audiences CHI serves: **PE firms, healthcare REITs, and lenders**
running diligence on skilled-nursing investments — and the operators who live
these numbers.

> **This repo ships with an illustrative Texas demo seed** (fictional facilities,
> `TX-DEMO-###`) so it runs with zero setup. It is **not real CMS data**. Load
> real data with the [ETL pipeline](etl/README.md).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  (runs on the bundled demo seed)
```

Regenerate the demo seed (optional): `npm run seed:demo`.

## What's here

| Surface | Route | Notes |
|---|---|---|
| Landing / funnel | `/` | Value prop, search, chain roll-ups, sample screen |
| Facility search | `/search` | Filter by owner type (PE/REIT), profit status, city, rating, risk flags |
| Facility profile | `/facility/[ccn]` | Scorecards, trends, **risk flags**, ownership — *registration-gated* |
| Chain roll-up | `/chain/[id]` | Census-weighted portfolio aggregates + risk exposure — *registration-gated* |
| Compare | `/compare` | Side-by-side screening of up to 4 facilities |
| Methodology | `/methodology` | Sources, two-layer data strategy, flag rules, disclaimers |

## What makes it defensible (Business Plan v1.3 §3)

The moat is a **proprietary data asset**, not a disclosure convention:

1. **The entity-resolution crosswalk.** Facilities resolved to operating chain,
   PE sponsor, and REIT landlord (14,703 → 616) — the level an investor question
   is asked at. Every mapping is flagged **verified** or **inferred**; inferred
   mappings are excluded from published chain-level figures (§11).
2. **The point-in-time archive.** CMS overwrites its files with no changelog; the
   ETL captures every vintage, so the Atlas shows history — and QoQ/YoY trends —
   that Care Compare can't (`metric_snapshots` is its in-app expression).
3. **Transparent risk flags, not a black-box score.** Every flag ties to one
   disclosed CMS metric and one published threshold; the analytical *synthesis*
   is reserved for CHI's paid quarterly research (§4.1).

**Vintage disclosure** remains on every metric — but as the **quality floor** (§4),
not the headline.

## Data

Public CMS only — PBJ staffing, Care Compare / Five-Star, deficiencies,
penalties, ownership, HCRIS cost reports. No private or employer data (the
structural firewall in §11). See [`docs/data-sources.md`](docs/data-sources.md).

## Tech

Next.js 14 (App Router, RSC) · TypeScript · Tailwind · Python ETL ·
Supabase-ready (Postgres + Auth) · Vercel-ready. Trend charts are hand-rolled
inline SVG (no chart dependency). See [`docs/architecture.md`](docs/architecture.md).

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
```

### Going to production (national data)

National scale (14,703 facilities × metrics × quarters) runs on Supabase/Postgres,
not the JSON bundle.

1. Apply `supabase/schema.sql` in a Supabase project (tables + read-path views).
2. Build + load the real national data in one command (needs `data.cms.gov` reachable):
   ```bash
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… python3 etl/run_national.py --state ALL --load
   ```
   See [`etl/README.md`](etl/README.md) for PBJ downloads and the archive step.
3. Copy `.env.example` → `.env.local`; set `CHI_DATA_SOURCE=supabase`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy to Vercel. The data layer switches backends with zero page changes.

## Disclaimer

An informational research surface — **not** investment, legal, or clinical
advice. Caliber Health Intelligence is not affiliated with or endorsed by CMS.
A portion of CHI's profits supports Remote Area Medical.
