-- ---------------------------------------------------------------------------
-- Caliber Workforce Atlas — Supabase / Postgres schema
--
-- The app runs on the bundled JSON seed in demo mode. For production, run this
-- schema in Supabase, load it from the ETL output (etl/load_supabase.py), and
-- set CHI_DATA_SOURCE=supabase. Table shapes mirror lib/types.ts; the VIEWS at
-- the bottom back the read-path in lib/data/supabase.ts efficiently at national
-- scale (14,703 facilities / 616 chains).
-- ---------------------------------------------------------------------------

create table if not exists owners (
  id                text primary key,
  name              text not null,
  private_equity    boolean not null default false,
  reit              boolean not null default false,
  reit_name         text,
  pe_sponsor_name   text,
  confidence        text            -- 'verified' | 'inferred'
);

create table if not exists chains (
  id                    text primary key,
  name                  text not null,
  owner_id              text references owners(id),
  headquarters_state    text,
  sponsor_name          text,
  reit_name             text,
  resolution_confidence text          -- 'verified' | 'inferred'
);

create table if not exists facilities (
  ccn                     text primary key,
  name                    text not null,
  address                 text,
  city                    text,
  state                   text,
  county                  text,
  zip                     text,
  ownership_type          text,
  certified_beds          integer,
  avg_residents_per_day   integer,
  chain_id                text references chains(id),
  owner_id                text references owners(id),
  independent             boolean not null default true,
  chain_confidence        text           -- 'verified' | 'inferred'
);
create index if not exists idx_facilities_state on facilities(state);
create index if not exists idx_facilities_chain on facilities(chain_id);
create index if not exists idx_facilities_city  on facilities(city);

-- The time-series core. One row per (facility, metric, period).
create table if not exists metric_snapshots (
  ccn            text not null references facilities(ccn) on delete cascade,
  metric_key     text not null,
  period         text not null,          -- e.g. "2026Q1"
  value          double precision,
  vintage_date   date,                   -- explicit vintage — CHI quality floor
  source         text not null,
  primary key (ccn, metric_key, period)
);
create index if not exists idx_snap_metric on metric_snapshots(metric_key);
create index if not exists idx_snap_ccn     on metric_snapshots(ccn);

-- The point-in-time archive manifest: one row per captured CMS file vintage
-- (Business Plan §3). Raw files live in object storage; this is the index.
create table if not exists archive_manifest (
  id             bigserial primary key,
  source         text not null,          -- 'provider' | 'pbj' | ...
  period         text,                   -- reporting period the file covers
  captured_at    timestamptz not null default now(),
  file_uri       text,                   -- object-storage location of the raw file
  row_count      integer,
  changed_rows   integer,                -- diff vs. the prior captured vintage
  checksum       text
);
create index if not exists idx_archive_source on archive_manifest(source, period);

-- Registration / lead capture (top-of-funnel; Business Plan §4.1).
create table if not exists leads (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  role         text,
  firm         text,
  source       text,
  captured_at  timestamptz not null default now()
);
create index if not exists idx_leads_email on leads(email);

-- ---------------------------------------------------------------------------
-- Read-path views (used by lib/data/supabase.ts)
-- ---------------------------------------------------------------------------

-- Latest value per (facility, metric) — the newest reporting period per series.
create or replace view metric_latest as
select distinct on (ccn, metric_key)
  ccn, metric_key, value, period, vintage_date
from metric_snapshots
order by ccn, metric_key, period desc;

-- One row per facility with the search-relevant latest metrics pivoted out,
-- plus owner/chain fields so search can filter on PE/REIT and match names.
create or replace view facility_latest as
select
  f.*,
  o.private_equity,
  o.reit,
  o.name  as owner_name,
  ch.name as chain_name,
  max(ml.value) filter (where ml.metric_key = 'overall_star')             as overall_star,
  max(ml.value) filter (where ml.metric_key = 'staffing_star')            as staffing_star,
  max(ml.value) filter (where ml.metric_key = 'total_nurse_hprd')         as total_nurse_hprd,
  max(ml.value) filter (where ml.metric_key = 'total_nurse_turnover_pct') as turnover_pct,
  max(ml.value) filter (where ml.metric_key = 'contract_staff_pct')       as agency_pct,
  max(ml.value) filter (where ml.metric_key = 'ij_deficiencies')          as ij_deficiencies
from facilities f
left join metric_latest ml on ml.ccn = f.ccn
left join owners o  on o.id  = f.owner_id
left join chains ch on ch.id = f.chain_id
group by f.ccn, o.private_equity, o.reit, o.name, ch.name;

-- Distinct cities for the search filter.
create or replace view cities as
select distinct city, state from facilities where city is not null order by city;

-- Chain roll-up over VERIFIED members only (inferred excluded — §11), using
-- census (avg_residents_per_day) weights. Thresholds mirror lib/benchmarks.ts;
-- keep them in sync if the benchmarks change.
create or replace view chain_directory as
select
  c.id                                                             as chain_id,
  count(*) filter (where fl.chain_confidence is distinct from 'inferred')                       as verified_count,
  count(*) filter (where fl.chain_confidence = 'inferred')                                       as inferred_count,
  coalesce(sum(fl.certified_beds) filter (where fl.chain_confidence is distinct from 'inferred'), 0) as total_beds,
  round((sum(fl.total_nurse_hprd * greatest(fl.avg_residents_per_day,1)) filter (where fl.chain_confidence is distinct from 'inferred')
       / nullif(sum(greatest(fl.avg_residents_per_day,1)) filter (where fl.chain_confidence is distinct from 'inferred' and fl.total_nurse_hprd is not null),0))::numeric, 2) as avg_total_nurse_hprd,
  round((sum(fl.turnover_pct * greatest(fl.avg_residents_per_day,1)) filter (where fl.chain_confidence is distinct from 'inferred')
       / nullif(sum(greatest(fl.avg_residents_per_day,1)) filter (where fl.chain_confidence is distinct from 'inferred' and fl.turnover_pct is not null),0))::numeric, 1) as avg_turnover_pct,
  round(avg(fl.overall_star) filter (where fl.chain_confidence is distinct from 'inferred')::numeric, 1) as avg_overall_star,
  count(*) filter (where fl.chain_confidence is distinct from 'inferred' and fl.total_nurse_hprd < 3.48)  as below_benchmark,
  count(*) filter (where fl.chain_confidence is distinct from 'inferred' and fl.ij_deficiencies >= 1)     as with_ij,
  count(*) filter (where fl.chain_confidence is distinct from 'inferred' and fl.turnover_pct > 52.5)      as high_turnover
from chains c
left join facility_latest fl on fl.chain_id = c.id
group by c.id;

-- Distinct captured reporting periods (archive depth).
create or replace view archive_periods as
select distinct period from metric_snapshots where period ~ '^\d{4}Q[1-4]$' order by period;

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * Reference data is public read.
--   * Leads are insert-only from the anon key; never publicly readable.
-- ---------------------------------------------------------------------------
alter table facilities       enable row level security;
alter table metric_snapshots enable row level security;
alter table owners           enable row level security;
alter table chains           enable row level security;
alter table archive_manifest enable row level security;
alter table leads            enable row level security;

create policy "public read facilities"  on facilities       for select using (true);
create policy "public read snapshots"   on metric_snapshots for select using (true);
create policy "public read owners"      on owners           for select using (true);
create policy "public read chains"      on chains           for select using (true);
create policy "public read archive"     on archive_manifest for select using (true);

create policy "anon insert leads"       on leads for insert with check (true);
-- (No select policy on leads: readable only via the service role, server-side.)
