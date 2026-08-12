# Caliber Workforce Atlas

The free, public-data workforce-intelligence surface for **Caliber Health
Intelligence** — turning CMS nursing-home data into an underwriting-grade view of
staffing, turnover, agency reliance, regulatory exposure, and financial pressure,
**with the vintage on every number** and the quarter-over-quarter / year-over-year
trends CMS Care Compare doesn't show.

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

## The three product commitments (from the CHI plan)

1. **Vintage on every metric.** Staffing is current to the latest PBJ quarter;
   cost-report financials lag 12–18 months — and the UI says which is which, on
   every number. This methodological honesty is CHI's moat (Business Plan §3).
2. **Trends, not snapshots.** A time-series data model (`metric_snapshots`) gives
   QoQ and YoY movement on every metric and every chain — the one thing Care
   Compare doesn't do (§4.1).
3. **Transparent risk flags, not a black-box score.** Every flag ties to one
   disclosed CMS metric and one published threshold. The analytical *synthesis*
   is deliberately reserved for CHI's paid quarterly research (§4.1).

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

### Going to production

1. `supabase/schema.sql` in a Supabase project.
2. Run the [real CMS ETL](etl/README.md), then `etl/load_supabase.py`.
3. Copy `.env.example` → `.env.local`, set Supabase vars, `CHI_DATA_SOURCE=supabase`.
4. Deploy to Vercel.

## Disclaimer

An informational research surface — **not** investment, legal, or clinical
advice. Caliber Health Intelligence is not affiliated with or endorsed by CMS.
A portion of CHI's profits supports Remote Area Medical.
