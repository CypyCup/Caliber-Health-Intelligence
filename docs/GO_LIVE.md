# Go-live runbook — caliberhealthintelligence.com

A step-by-step to take the Caliber Workforce Atlas from this repo to a live,
custom-domain website, plus the Supabase migration that makes it durable as the
data history grows.

**Time:** ~60–90 minutes end to end. **Cost:** ~$12/yr domain, $0 to start
(Vercel Hobby + Supabase Free tiers), scaling to ~$20 + ~$25/mo if/when you
outgrow the free tiers.

---

## The shape of it

```
 Registrar (domain)          Vercel (hosting the Next.js app)         Supabase (Postgres)
 caliberhealthintelligence ───DNS──▶  Atlas  ──CHI_DATA_SOURCE=supabase──▶  facilities, chains,
   .com                                                                      metric history
                                        ▲
                                        └── Python ETL (monthly CMS refresh) ─┘
```

Two decisions up front:
- **Data backend.** The app runs today on JSON files in the repo. That's fine
  for a demo, but the facility history is already ~28 MB and grows ~5 MB/month —
  too big to sit inside a serverless function long-term. **Go live on Supabase**
  (Postgres) so the data lives in a database and the app stays small. Steps 3–4.
- **Auth.** The registration wall is a demo cookie today. For a real lead-capture
  funnel, wire Supabase Auth (or keep the soft wall + write leads to the DB).
  Step 6. Not required to launch.

---

## Step 1 — Buy the domain (~10 min)

1. Buy **caliberhealthintelligence.com** at any registrar (Namecheap, Cloudflare,
   Google/Squarespace Domains). Cloudflare is cheapest at cost.
2. Don't configure DNS yet — Vercel gives you the exact records in Step 5.

## Step 2 — Create the Supabase project (~5 min)

1. Sign up at supabase.com → **New project**. Name it `caliber-atlas`. Pick a
   region near your users (e.g. `us-east-1`). Save the database password.
2. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never ship to the browser)
3. In **SQL Editor**, paste and run `supabase/schema.sql` from this repo. That
   creates the tables, the read-path views, and row-level security.

## Step 3 — Load the CMS data into Supabase (~10 min)

From your machine (where `data.cms.gov` is reachable and Python is installed):

```bash
pip install -r etl/requirements.txt
export SUPABASE_URL=https://YOURPROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...        # service role
python3 etl/load_supabase.py                # pushes facilities, chains, and all metric history
```

This loads everything you've ingested (facilities, chains, and every monthly
vintage). Re-run it after each monthly refresh (Step 7).

> **Read-path note:** the app's Supabase read layer is being finished against a
> live project (chain trends + roll-ups need porting from the JSON layer). Until
> that's done, load the data now and deploy on JSON (Step 4 alt) — the moment the
> read-path port lands, flip `CHI_DATA_SOURCE=supabase` and the app serves from
> Postgres with no other change.

## Step 4 — Deploy to Vercel (~10 min)

1. Push this branch to GitHub (already done) and open vercel.com → **Add New →
   Project** → import `cypycup/caliber-health-intelligence`.
2. Framework preset: **Next.js** (auto-detected). Build command and output are
   the defaults.
3. **Environment Variables** (Project Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `CHI_DATA_SOURCE` | `supabase` |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key |
   | `CHI_LEAD_SINK` | `supabase` |
4. **Deploy.** You get a `*.vercel.app` URL to verify.

*Alt (deploy today on JSON, before the Supabase read-path is finished):* set
`CHI_DATA_SOURCE=demo` and add `outputFileTracingIncludes` for `data/seed/**` in
`next.config.mjs` so the seed files ship with the functions. Works now; migrate
to Supabase when ready.

## Step 5 — Point the domain at Vercel (~10 min + DNS propagation)

1. Vercel → Project → **Settings → Domains** → add `caliberhealthintelligence.com`
   and `www.caliberhealthintelligence.com`.
2. Vercel shows the records to add at your registrar — typically:
   - `A` record `@` → `76.76.21.21`
   - `CNAME` record `www` → `cname.vercel-dns.com`
   (Use whatever Vercel displays — it's authoritative.)
3. Add them at the registrar. TLS is issued automatically. Propagation is minutes
   to a few hours.

## Step 6 — (Optional) real registration/auth

The Atlas gates facility/chain detail behind a soft cookie today. To make it a
real lead funnel:
- **Simplest:** keep the wall, set `CHI_LEAD_SINK=supabase` so `/api/register`
  writes to the `leads` table. You get every email in Postgres. (Already wired.)
- **Full auth:** enable Supabase Auth (email magic-link), and replace the cookie
  check in `lib/auth.ts` with a Supabase session check. The call sites don't change.

## Step 7 — Automate the monthly CMS refresh

Keep the data current (and the trend lines growing) without manual work:
- **GitHub Action** (recommended): a scheduled workflow that runs
  `python3 etl/fetch_datasets.py provider_info` + the chain fetch, then
  `python3 etl/load_supabase.py`. Runs monthly, commits nothing to git (data
  goes straight to Supabase). *(I can write this workflow for you.)*
- Or run `etl/fetch_datasets.py` locally once a month and `load_supabase.py`.

Each refresh point-in-time archives the new CMS file (the diff is recorded), and
every metric gains another month of trend.

---

## Launch checklist

- [ ] Domain purchased
- [ ] Supabase project created, `schema.sql` run
- [ ] Data loaded (`load_supabase.py`)
- [ ] Supabase read-path finished + `CHI_DATA_SOURCE=supabase` verified
- [ ] Vercel project deployed with env vars
- [ ] Domain DNS pointed at Vercel, TLS green
- [ ] Registration writing leads to Supabase
- [ ] Monthly refresh automated
- [ ] Methodology/disclaimer reviewed for public launch (ADP compliance posture)

## Costs at a glance

| Item | Free tier | When you outgrow it |
|---|---|---|
| Domain | — | ~$12/yr |
| Vercel | Hobby: fine for launch | Pro $20/mo (custom domains ok on Hobby) |
| Supabase | 500 MB DB, 2 GB egress | Pro $25/mo (8 GB DB) |

At ~1.25 M metric-snapshot rows per 5 months of facilities, you're comfortably
inside Supabase Free for the first year+.
