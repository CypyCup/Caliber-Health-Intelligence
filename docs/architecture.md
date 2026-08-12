# Architecture

## Shape

```
Next.js (App Router, RSC)  ──reads──▶  lib/data (async API)
        │                                   │
        │                          demo mode │ prod mode
        ▼                                    ▼            ▼
  components/ (SSR)               data/seed/*.json    Supabase (Postgres)
                                        ▲
                                   etl/ (Python)  ◀── CMS public data
```

- **Rendering:** React Server Components. Pages are server-rendered; the only
  client components are the search box, filters, compare selector, and the
  registration wall (all under `components/`, marked `"use client"`).
- **Data access seam:** every page calls the async functions in `lib/data`.
  In demo mode they read the bundled JSON seed; swapping to Supabase is a change
  **only inside `lib/data`** because the API is already async. No page changes.
- **No chart library:** trends are hand-rolled inline SVG (`Sparkline`,
  `TrendChart`) so the build never depends on a chart package and both themes
  stay controllable.

## The analytical core (`lib/`)

| Module | Responsibility |
|---|---|
| `types.ts` | Domain model — time-series first, vintage on every snapshot |
| `metrics.ts` | Metric catalog + source definitions (labels, units, cadence, precision) |
| `benchmarks.ts` | Published CMS thresholds + national reference points |
| `trends.ts` | QoQ / YoY resolution from `metric_snapshots` |
| `riskFlags.ts` | Deterministic, transparent flag engine (no composite score) |
| `format.ts` | Value / delta / vintage formatting + trend tone |
| `data/index.ts` | The async repository + composed facility / chain profiles |

## Why the data model is time-series first

The single differentiator over CMS Care Compare is **trend tracking**
(Business Plan §4.1). `metric_snapshots(ccn, metric_key, period, value,
vintage_date, source)` is one generic table that makes *every* metric trendable
and *every* value vintage-stamped, uniformly — instead of a wide, flat,
current-only row per facility.

## Risk-flag design

Flags are **deterministic** and each traces to exactly one disclosed CMS metric
and one published threshold (`riskFlags.ts` + `benchmarks.ts`). There is
intentionally **no composite 0–100 score**: the Atlas shows transparent signals;
the analytical synthesis is the paid research product. This preserves the
methodological-honesty moat and avoids cannibalizing the subscription.

## Registration funnel

`RegistrationWall` → `POST /api/register` → sets an httpOnly cookie and records
the lead. Facility and chain detail pages check `isRegistered()` server-side and
render the wall when absent. In production this becomes Supabase Auth + a `leads`
table; the call sites don't change.

## Production stack (per Business Plan §11)

Supabase (Postgres + Auth) · Vercel (hosting) · Stripe (research subscription,
**not** the Atlas) · Python ETL for quarterly CMS refreshes. Set env vars from
`.env.example` and run `supabase/schema.sql` + `etl/load_supabase.py`.

## Security note

`package.json` pins the latest patched **Next.js 14.2.x**. A few advisories in
the Next line are only fully resolved in Next 15/16 (a major upgrade — notably
`cookies()` becomes async, affecting `lib/auth.ts`). For production, plan the
Next 15+ upgrade and keep dependencies current with `npm audit`.
