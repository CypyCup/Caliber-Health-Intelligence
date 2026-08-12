// Demo backend — reads the bundled JSON seed. Default when CHI_DATA_SOURCE!=supabase.
import type { Chain, Facility, MetricSnapshot, OwnerEntity } from "../types";
import {
  buildChainProfile,
  buildFacilityProfile,
  buildSearchRow,
  matchesQuery,
  sortSearchRows,
  type ArchiveInfo,
  type ChainDirectoryRow,
  type ChainProfile,
  type FacilityProfile,
  type FacilitySearchRow,
  type SearchParams,
  type SeedMeta,
} from "./shared";

import facilitiesJson from "@/data/seed/texas/facilities.json";
import chainsJson from "@/data/seed/texas/chains.json";
import ownersJson from "@/data/seed/texas/owners.json";
import snapshotsJson from "@/data/seed/texas/metric_snapshots.json";
import seedMeta from "@/data/seed/seed_metadata.json";

const facilities = facilitiesJson as unknown as Facility[];
const chains = chainsJson as unknown as Chain[];
const owners = ownersJson as unknown as OwnerEntity[];
const snapshots = snapshotsJson as unknown as MetricSnapshot[];

const snapshotsByCcn: Record<string, MetricSnapshot[]> = {};
for (const s of snapshots) (snapshotsByCcn[s.ccn] ||= []).push(s);

export async function getSeedMeta(): Promise<SeedMeta> {
  return seedMeta as SeedMeta;
}
export async function getAllFacilities(): Promise<Facility[]> {
  return facilities;
}
export async function getFacility(ccn: string): Promise<Facility | undefined> {
  return facilities.find((f) => f.ccn === ccn);
}
export async function getFacilitySnapshots(ccn: string): Promise<MetricSnapshot[]> {
  return snapshotsByCcn[ccn] ?? [];
}
export async function getAllChains(): Promise<Chain[]> {
  return chains;
}
export async function getChain(id: string): Promise<Chain | undefined> {
  return chains.find((c) => c.id === id);
}
export async function getOwner(id: string | undefined): Promise<OwnerEntity | undefined> {
  return id ? owners.find((o) => o.id === id) : undefined;
}

export async function getFacilityProfile(ccn: string): Promise<FacilityProfile | undefined> {
  const facility = facilities.find((f) => f.ccn === ccn);
  if (!facility) return undefined;
  const owner = owners.find((o) => o.id === facility.owner_id);
  const chain = facility.chain_id ? chains.find((c) => c.id === facility.chain_id) : undefined;
  return buildFacilityProfile(facility, snapshotsByCcn[ccn] ?? [], owner, chain);
}

export async function getChainProfile(id: string): Promise<ChainProfile | undefined> {
  const chain = chains.find((c) => c.id === id);
  if (!chain) return undefined;
  const owner = owners.find((o) => o.id === chain.owner_id);
  const members = facilities.filter((f) => f.chain_id === id);
  return buildChainProfile(chain, members, owner, snapshotsByCcn);
}

export async function searchFacilities(params: SearchParams = {}): Promise<FacilitySearchRow[]> {
  const q = params.q?.trim().toLowerCase();
  const rows: FacilitySearchRow[] = [];
  for (const f of facilities) {
    if (params.chainId && f.chain_id !== params.chainId) continue;
    if (params.city && f.city !== params.city) continue;
    if (params.ownership && f.ownership_type !== params.ownership) continue;
    const owner = owners.find((o) => o.id === f.owner_id);
    if (params.ownerType === "pe" && !owner?.private_equity) continue;
    if (params.ownerType === "reit" && !owner?.reit) continue;
    const chain = f.chain_id ? chains.find((c) => c.id === f.chain_id) : undefined;
    if (q && !matchesQuery(q, f, chain, owner)) continue;

    const row = buildSearchRow(f, snapshotsByCcn[f.ccn] ?? [], chain, owner);
    if (params.minStar && (row.overall_star == null || row.overall_star < params.minStar)) continue;
    if (params.hasFlags && row.flagCount === 0) continue;
    rows.push(row);
  }
  return sortSearchRows(rows);
}

export async function getCities(): Promise<string[]> {
  return Array.from(new Set(facilities.map((f) => f.city))).sort();
}

export async function getChainsDirectory(): Promise<ChainDirectoryRow[]> {
  const rows = chains.map((c) => {
    const owner = owners.find((o) => o.id === c.owner_id);
    const members = facilities.filter((f) => f.chain_id === c.id);
    const a = buildChainProfile(c, members, owner, snapshotsByCcn).aggregates;
    return {
      chain: c, owner,
      verified_count: a.verified_count, inferred_count: a.inferred_count,
      total_beds: a.total_beds,
      avg_total_nurse_hprd: a.avg_total_nurse_hprd, avg_turnover_pct: a.avg_turnover_pct,
      avg_overall_star: a.avg_overall_star,
      below_benchmark: a.facilities_below_staffing_benchmark,
      with_ij: a.facilities_with_ij, total_flags: a.total_flags,
      private_equity: !!owner?.private_equity, reit: !!owner?.reit,
    };
  });
  rows.sort((x, y) => y.below_benchmark - x.below_benchmark || y.total_flags - x.total_flags);
  return rows;
}

export async function getArchiveInfo(): Promise<ArchiveInfo> {
  const periods = Array.from(new Set(snapshots.map((s) => s.period)))
    .filter((p) => /^\d{4}Q[1-4]$/.test(p))
    .sort();
  return { quarters: periods, depth: periods.length, earliest: periods[0] ?? "", latest: periods.at(-1) ?? "" };
}
