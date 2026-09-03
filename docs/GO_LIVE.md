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
 Wix (domain)                Vercel (hosting the Next.js app)         Supabase (Postgres)
 caliberhealthintelligence ───DNS──▶  Atlas  ──serves bundled CMS seed        leads (lead capture)
   .com                                        + writes leads──────────────▶  + durable data store
                                        ▲
                                        └── Python ETL (monthly CMS refresh) ─┘
```

Two decisions up front:
- **Data backend.** The app serves the committed CMS seed (`data/seed/**`, ~71 MB)
  directly from the serverless functions. This is **verified to build and fit**
  inside Vercel's 250 MB per-function limit (the heaviest route traces to ~75 MB),
  via `outputFileTracingIncludes` in `next.config.mjs` — already committed. So you
  deploy straight from git with `CHI_DATA_SOURCE` **unset**. Supabase is loaded
  with the same data as your durable store (for lead capture now, and the
  "Ask the Atlas" / analytics phase next); flipping the app's *read-path* to
  Postgres is a future optimization, not a launch blocker.
- **Auth.** The registration wall is a soft cookie today. For a real lead-capture
  funnel, set `CHI_LEAD_SINK=supabase` so `/api/register` writes every email to
  the `leads` table (wired — Step 6). Full Supabase Auth is optional.

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

This loads everything you've ingested (facilities, chains, every monthly
vintage, and 37 quarters of PBJ). Re-run it after each monthly refresh (Step 7).
The data also backs lead capture (Step 6) and is the durable store for the next
phase. **You do not need to wait on this to deploy** — the app serves the
bundled seed either way.

## Step 4 — Deploy to Vercel (~10 min)

1. Push this branch to GitHub (already done) and open vercel.com → **Add New →
   Project** → import `cypycup/caliber-health-intelligence`.
2. Framework preset: **Next.js** (auto-detected). Build command and output are
   the defaults. `next.config.mjs` already bundles `data/seed/**` into the
   functions, so the seed ships with the deploy.
3. **Environment Variables** (Project Settings → Environment Variables) — note
   `CHI_DATA_SOURCE` is intentionally **not** set (the app serves the bundled
   seed; the Postgres read-path is a later optimization):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL (`https://lgdcgecvmibapopgfyol.supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your publishable/anon key (`sb_publishable_…`) |
   | `CHI_LEAD_SINK` | `supabase` |
4. **Deploy.** You get a `*.vercel.app` URL to verify. Register with a test email
   and confirm the row lands in Supabase → Table Editor → `leads`.

## Step 5 — Point the Wix domain at Vercel (~10 min + DNS propagation)

You bought the domain through **Wix**, so the DNS records live in Wix's dashboard
(you keep the domain at Wix and just point it at Vercel — you are not moving the
registration).

1. Vercel → Project → **Settings → Domains** → add both
   `caliberhealthintelligence.com` and `www.caliberhealthintelligence.com`.
   Vercel shows the exact records to create — typically:
   - `A` record, host `@` → `76.76.21.21`
   - `CNAME` record, host `www` → `cname.vercel-dns.com`
2. In Wix: **My Domains → caliberhealthintelligence.com → DNS Records** (Advanced/
   "Edit DNS"). Add the A record for `@` and the CNAME for `www` exactly as Vercel
   shows them. Remove any conflicting existing `A`/`CNAME` on `@`/`www` that point
   to Wix's parking page.
   - If Wix won't let you set the apex `A` record, use Vercel's **nameserver**
     option instead: switch the domain's nameservers (Wix → Domains → Advanced →
     Nameservers) to the `ns1/ns2.vercel-dns.com` values Vercel provides.
3. Back in Vercel, the domains flip to **Valid** once DNS propagates (minutes to a
   few hours). TLS is issued automatically.

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

- [x] Domain purchased (Wix)
- [x] Supabase project created, `schema.sql` run
- [x] Data loaded (`load_supabase.py`) — all 6 tables verified
- [ ] Vercel project deployed with env vars (`CHI_DATA_SOURCE` unset)
- [ ] Domain DNS pointed at Vercel (via Wix), TLS green
- [ ] Registration writing leads to Supabase (test email → `leads` table)
- [ ] Monthly refresh automated
- [ ] Methodology/disclaimer reviewed for public launch (ADP compliance posture)
- [ ] *(Later)* Port the read-path to Postgres and flip `CHI_DATA_SOURCE=supabase`

## Costs at a glance

| Item | Free tier | When you outgrow it |
|---|---|---|
| Domain | — | ~$12/yr |
| Vercel | Hobby: fine for launch | Pro $20/mo (custom domains ok on Hobby) |
| Supabase | 500 MB DB, 2 GB egress | Pro $25/mo (8 GB DB) |

At ~1.25 M metric-snapshot rows per 5 months of facilities, you're comfortably
inside Supabase Free for the first year+.
