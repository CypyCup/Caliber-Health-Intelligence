-- ---------------------------------------------------------------------------
-- Caliber Workforce Atlas — Supabase / Postgres schema (real-data model)
--
-- Run this in the Supabase SQL editor, then load data with
-- etl/load_supabase.py and set CHI_DATA_SOURCE=supabase. Table shapes mirror the
-- ingested JSON (data/seed/national + data/seed/chains_cms).
--
-- NOTE: the app's Supabase READ-PATH (lib/data/supabase.ts + a cmsChains adapter)
-- is completed and verified against a live project as the final migration step;
-- the read-path views it needs are added there. This file defines the tables +
-- indexes the loader writes, plus leads.
-- ---------------------------------------------------------------------------

-- Facilities (CMS Provider Information descriptors).
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
  chain_id                text,          -- "cms-<ChainID>", links to cms_chains
  chain_name              text,
  owner_id                text,
  independent             boolean not null default true,
  chain_confidence        text,          -- 'verified' | 'inferred'
  special_focus           text,          -- 'SFF' | 'SFF Candidate' | null
  abuse_icon              boolean,
  changed_ownership_12mo  boolean,
  pbj_incomplete          boolean
);
create index if not exists idx_facilities_state on facilities(state);
create index if not exists idx_facilities_chain on facilities(chain_id);
create index if not exists idx_facilities_city  on facilities(city);

-- Facility metric time-series (one row per facility / metric / month).
create table if not exists metric_snapshots (
  ccn            text not null references facilities(ccn) on delete cascade,
  metric_key     text not null,
  period         text not null,          -- "2026-07"
  value          double precision,
  vintage_date   date,
  source         text not null,
  primary key (ccn, metric_key, period)
);
create index if not exists idx_snap_metric on metric_snapshots(metric_key);
create index if not exists idx_snap_ccn     on metric_snapshots(ccn);
create index if not exists idx_snap_period  on metric_snapshots(period);

-- CMS Chain Performance Measures — chain descriptors.
create table if not exists cms_chains (
  id               text primary key,     -- "cms-<ChainID>"
  cms_chain_id     text,
  name             text not null,
  num_facilities   integer,
  num_states       integer,
  sff              integer,
  sff_candidates   integer,
  abuse_count      integer,
  abuse_pct        double precision,
  pct_for_profit   double precision,
  pct_non_profit   double precision,
  pct_government   double precision
);

-- Chain metric time-series (one row per chain / metric / month).
create table if not exists chain_metric_snapshots (
  chain_id       text not null references cms_chains(id) on delete cascade,
  metric_key     text not null,
  period         text not null,
  value          double precision,
  vintage_date   date,
  source         text not null,
  primary key (chain_id, metric_key, period)
);
create index if not exists idx_chainsnap_metric on chain_metric_snapshots(metric_key);

-- PBJ staffing (raw numerators/denominators per facility-quarter; derive HPRD/
-- agency as sum(numerator)/sum(denominator), never averaging facility percentages).
create table if not exists pbj_facility_quarter (
  ccn                             text not null references facilities(ccn) on delete cascade,
  cy_qtr                          text not null,
  resident_days                   double precision,
  total_nurse_hours               double precision,
  total_nurse_contract_hours      double precision,
  rn_hours                        double precision,
  lpn_hours                       double precision,
  aide_hours                      double precision,
  total_hours_all_staff           double precision,
  total_contract_hours_all_staff  double precision,
  reporting_completeness_pct      double precision,
  primary key (ccn, cy_qtr)
);
create index if not exists idx_pbj_qtr on pbj_facility_quarter(cy_qtr);

-- National benchmark row (latest vintage), as key/value.
create table if not exists chain_national (
  metric_key   text primary key,
  value        double precision,
  period       text,
  vintage_date date
);

-- The point-in-time archive manifest (index of captured CMS files).
create table if not exists archive_manifest (
  id           bigserial primary key,
  source       text not null,
  period       text,
  captured_at  timestamptz not null default now(),
  file_uri     text,
  row_count    integer,
  changed_rows integer
);

-- Registration / lead capture.
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
-- Row Level Security: reference data public-read; leads insert-only from anon.
-- ---------------------------------------------------------------------------
alter table facilities            enable row level security;
alter table metric_snapshots      enable row level security;
alter table cms_chains            enable row level security;
alter table chain_metric_snapshots enable row level security;
alter table pbj_facility_quarter  enable row level security;
create policy "read pbj" on pbj_facility_quarter for select using (true);
alter table chain_national        enable row level security;
alter table archive_manifest      enable row level security;
alter table leads                 enable row level security;

create policy "read facilities"     on facilities            for select using (true);
create policy "read metric_snap"    on metric_snapshots      for select using (true);
create policy "read cms_chains"     on cms_chains            for select using (true);
create policy "read chain_snap"     on chain_metric_snapshots for select using (true);
create policy "read chain_national" on chain_national        for select using (true);
create policy "read archive"        on archive_manifest      for select using (true);
create policy "insert leads"        on leads for insert with check (true);
-- (No select policy on leads — readable only via the service role, server-side.)
