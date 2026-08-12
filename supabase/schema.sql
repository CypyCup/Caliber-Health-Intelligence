-- ---------------------------------------------------------------------------
-- Caliber Workforce Atlas — Supabase / Postgres schema
--
-- The app runs on the bundled JSON seed in demo mode. For production, run this
-- schema in Supabase, load it from the ETL output, and set CHI_DATA_SOURCE=
-- supabase. The table shapes mirror lib/types.ts exactly.
-- ---------------------------------------------------------------------------

create table if not exists owners (
  id                text primary key,
  name              text not null,
  private_equity    boolean not null default false,
  reit              boolean not null default false,
  reit_name         text,
  pe_sponsor_name   text
);

create table if not exists chains (
  id                  text primary key,
  name                text not null,
  owner_id            text references owners(id),
  headquarters_state  text
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
  independent             boolean not null default true
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
  vintage_date   date,                   -- explicit vintage — the CHI discipline
  source         text not null,          -- 'pbj' | 'provider' | 'deficiencies' | ...
  primary key (ccn, metric_key, period)
);
create index if not exists idx_snap_metric on metric_snapshots(metric_key);
create index if not exists idx_snap_ccn     on metric_snapshots(ccn);

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
-- Row Level Security
--   * Reference data (facilities, metrics, owners, chains) is public read.
--   * Leads are insert-only from the anon key; never publicly readable.
-- ---------------------------------------------------------------------------
alter table facilities       enable row level security;
alter table metric_snapshots enable row level security;
alter table owners           enable row level security;
alter table chains           enable row level security;
alter table leads            enable row level security;

create policy "public read facilities"  on facilities       for select using (true);
create policy "public read snapshots"   on metric_snapshots for select using (true);
create policy "public read owners"      on owners           for select using (true);
create policy "public read chains"      on chains           for select using (true);

create policy "anon insert leads"       on leads for insert with check (true);
-- (No select policy on leads: readable only via the service role, server-side.)
