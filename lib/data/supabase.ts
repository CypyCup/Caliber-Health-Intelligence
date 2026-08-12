// Supabase (Postgres) backend — active when CHI_DATA_SOURCE=supabase.
//
// Bounded reads (one facility, one chain) fetch rows and reuse the shared
// compute helpers, so flag/aggregate logic has a single source of truth. Wide
// reads (search, chains directory) lean on the SQL views in supabase/schema.sql
// so they stay efficient at national scale (14,703 facilities / 616 chains).
//
// PERF NOTE: search fetches full snapshots for a capped candidate set to compute
// flags with the exact TS rules. For very high traffic, precompute a
// `facility_search` table during ETL; see docs/architecture.md.
import type { Chain, Facility, MetricSnapshot, OwnerEntity } from "../types";
import { supa } from "../supabase/client";
import {
  buildChainProfile,
  buildFacilityProfile,
  buildSearchRow,
  matchesQuery,
  refineSearchRows,
  type ArchiveInfo,
  type ChainDirectoryRow,
  type ChainProfile,
  type FacilityProfile,
  type FacilitySearchRow,
  type SearchParams,
  type SeedMeta,
} from "./shared";

const PAGE = 1000;
const SEARCH_CANDIDATE_CAP = 400;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll<T>(table: string, apply?: (q: any) => any): Promise<T[]> {
  const c = supa();
  const out: T[] = [];
  let from = 0;
  for (;;) {
    let q = c.from(table).select("*").range(from, from + PAGE - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

// --- Simple lookups --------------------------------------------------------
export async function getSeedMeta(): Promise<SeedMeta> {
  const c = supa();
  const [{ count: f }, { count: ch }] = await Promise.all([
    c.from("facilities").select("*", { count: "exact", head: true }),
    c.from("chains").select("*", { count: "exact", head: true }),
  ]);
  return {
    dataset: "Caliber Workforce Atlas — CMS data",
    synthetic: false,
    disclaimer: "Built from public CMS datasets via the etl/ pipeline.",
    facilities: f ?? 0,
    chains: ch ?? 0,
    quarters: (await getArchiveInfo()).quarters,
    generated_on: "",
  };
}

export async function getAllFacilities(): Promise<Facility[]> {
  return pageAll<Facility>("facilities");
}

export async function getFacility(ccn: string): Promise<Facility | undefined> {
  const { data, error } = await supa().from("facilities").select("*").eq("ccn", ccn).maybeSingle();
  if (error) throw error;
  return (data as Facility) ?? undefined;
}

export async function getFacilitySnapshots(ccn: string): Promise<MetricSnapshot[]> {
  return pageAll<MetricSnapshot>("metric_snapshots", (q) => q.eq("ccn", ccn));
}

export async function getAllChains(): Promise<Chain[]> {
  return pageAll<Chain>("chains");
}

export async function getChain(id: string): Promise<Chain | undefined> {
  const { data, error } = await supa().from("chains").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Chain) ?? undefined;
}

export async function getOwner(id: string | undefined): Promise<OwnerEntity | undefined> {
  if (!id) return undefined;
  const { data, error } = await supa().from("owners").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as OwnerEntity) ?? undefined;
}

// --- Composed profiles -----------------------------------------------------
export async function getFacilityProfile(ccn: string): Promise<FacilityProfile | undefined> {
  const facility = await getFacility(ccn);
  if (!facility) return undefined;
  const [snaps, owner, chain] = await Promise.all([
    getFacilitySnapshots(ccn),
    getOwner(facility.owner_id),
    facility.chain_id ? getChain(facility.chain_id) : Promise.resolve(undefined),
  ]);
  return buildFacilityProfile(facility, snaps, owner, chain);
}

export async function getChainProfile(id: string): Promise<ChainProfile | undefined> {
  const chain = await getChain(id);
  if (!chain) return undefined;
  const owner = await getOwner(chain.owner_id);
  const members = await pageAll<Facility>("facilities", (q) => q.eq("chain_id", id));
  const snapshotsByCcn = await snapshotsFor(members.map((m) => m.ccn));
  return buildChainProfile(chain, members, owner, snapshotsByCcn);
}

/** Fetch snapshots for a set of facilities, chunked to keep IN() lists sane. */
async function snapshotsFor(ccns: string[]): Promise<Record<string, MetricSnapshot[]>> {
  const byCcn: Record<string, MetricSnapshot[]> = {};
  const c = supa();
  const CHUNK = 100;
  for (let i = 0; i < ccns.length; i += CHUNK) {
    const chunk = ccns.slice(i, i + CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await c
        .from("metric_snapshots")
        .select("*")
        .in("ccn", chunk)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as MetricSnapshot[];
      for (const r of rows) (byCcn[r.ccn] ||= []).push(r);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }
  return byCcn;
}

// --- Search ----------------------------------------------------------------
type FacilityLatest = Facility & {
  private_equity?: boolean;
  reit?: boolean;
  owner_name?: string;
  chain_name?: string;
  overall_star?: number | null;
};

export async function searchFacilities(params: SearchParams = {}): Promise<FacilitySearchRow[]> {
  const c = supa();
  let q = c.from("facility_latest").select("*").limit(SEARCH_CANDIDATE_CAP);
  if (params.chainId) q = q.eq("chain_id", params.chainId);
  if (params.city) q = q.eq("city", params.city);
  if (params.ownership) q = q.eq("ownership_type", params.ownership);
  if (params.ownerType === "pe") q = q.eq("private_equity", true);
  if (params.ownerType === "reit") q = q.eq("reit", true);
  if (params.minStar) q = q.gte("overall_star", params.minStar);
  if (params.q) {
    const t = params.q.trim().replace(/[,%()]/g, " ");
    q = q.or(
      [`name.ilike.%${t}%`, `city.ilike.%${t}%`, `county.ilike.%${t}%`, `ccn.ilike.%${t}%`, `chain_name.ilike.%${t}%`].join(","),
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  const candidates = (data ?? []) as FacilityLatest[];
  if (candidates.length === 0) return [];

  // Compute exact flags via the shared rules over the candidates' snapshots.
  const snapshotsByCcn = await snapshotsFor(candidates.map((c2) => c2.ccn));
  const rows: FacilitySearchRow[] = [];
  for (const f of candidates) {
    const owner: OwnerEntity | undefined = f.owner_id
      ? { id: f.owner_id, name: f.owner_name ?? "", private_equity: !!f.private_equity, reit: !!f.reit }
      : undefined;
    const chain: Chain | undefined = f.chain_id ? { id: f.chain_id, name: f.chain_name ?? "" } : undefined;
    const row = buildSearchRow(f as Facility, snapshotsByCcn[f.ccn] ?? [], chain, owner);
    if (params.hasFlags && row.flagCount === 0) continue;
    rows.push(row);
  }
  return refineSearchRows(rows, params);
}

export async function getCities(): Promise<string[]> {
  const { data, error } = await supa().from("cities").select("city");
  if (error) throw error;
  return (data ?? []).map((r: { city: string }) => r.city).filter(Boolean);
}

// --- Chains directory (from the pre-aggregated view) -----------------------
interface ChainDirRow {
  chain_id: string;
  verified_count: number;
  inferred_count: number;
  total_beds: number;
  avg_total_nurse_hprd: number | null;
  avg_turnover_pct: number | null;
  avg_overall_star: number | null;
  below_benchmark: number;
  with_ij: number;
  high_turnover: number;
}

export async function getChainsDirectory(): Promise<ChainDirectoryRow[]> {
  const [dir, chains, owners] = await Promise.all([
    pageAll<ChainDirRow>("chain_directory"),
    getAllChains(),
    pageAll<OwnerEntity>("owners"),
  ]);
  const chainById = new Map(chains.map((c) => [c.id, c]));
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  const rows: ChainDirectoryRow[] = dir
    .map((d): ChainDirectoryRow | null => {
      const chain = chainById.get(d.chain_id);
      if (!chain) return null;
      const owner = ownerById.get(chain.owner_id ?? "");
      return {
        chain,
        owner,
        verified_count: d.verified_count,
        inferred_count: d.inferred_count,
        total_beds: d.total_beds,
        avg_total_nurse_hprd: d.avg_total_nurse_hprd,
        avg_turnover_pct: d.avg_turnover_pct,
        avg_overall_star: d.avg_overall_star,
        below_benchmark: d.below_benchmark,
        with_ij: d.with_ij,
        // Exposure proxy in DB mode (below-benchmark + IJ + high-turnover);
        // the demo backend computes exact rule-based flag totals.
        total_flags: d.below_benchmark + d.with_ij + d.high_turnover,
        private_equity: !!owner?.private_equity,
        reit: !!owner?.reit,
      };
    })
    .filter((r): r is ChainDirectoryRow => r !== null) as ChainDirectoryRow[];

  rows.sort((x, y) => y.below_benchmark - x.below_benchmark || y.total_flags - x.total_flags);
  return rows;
}

export async function getArchiveInfo(): Promise<ArchiveInfo> {
  const { data, error } = await supa().from("archive_periods").select("period");
  if (error) throw error;
  const periods = (data ?? []).map((r: { period: string }) => r.period).filter(Boolean).sort();
  return { quarters: periods, depth: periods.length, earliest: periods[0] ?? "", latest: periods.at(-1) ?? "" };
}

// matchesQuery is imported for parity with the demo backend's text search; the
// SQL ILIKE above covers the DB path, so it is referenced here to keep lint quiet.
void matchesQuery;
