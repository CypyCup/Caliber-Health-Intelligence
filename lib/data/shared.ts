// Shared result types + pure compute helpers for the data layer.
//
// These helpers operate on ALREADY-FETCHED data, so the demo (JSON) and
// Supabase (Postgres) backends both reuse them — the aggregation, flagging, and
// trend logic lives in exactly one place.
import type {
  Chain,
  Facility,
  MetricSnapshot,
  OwnerEntity,
  ResolvedMetric,
  RiskFlag,
} from "../types";
import { METRIC_DEFINITIONS } from "../metrics";
import { resolveMetric, resolveMetrics } from "../trends";
import { computeFacilityRiskFlags, sortFlags } from "../riskFlags";

export const ALL_METRIC_KEYS = METRIC_DEFINITIONS.map((m) => m.key);

export interface SeedMeta {
  dataset: string;
  synthetic: boolean;
  disclaimer: string;
  facilities: number;
  chains: number;
  quarters: string[];
  generated_on: string;
}

export interface FacilityProfile {
  facility: Facility;
  owner?: OwnerEntity;
  chain?: Chain;
  metrics: Record<string, ResolvedMetric | undefined>;
  flags: RiskFlag[];
}

export interface ChainAggregates {
  facility_count: number;
  verified_count: number;
  inferred_count: number;
  total_beds: number;
  total_residents: number;
  avg_total_nurse_hprd: number | null;
  avg_turnover_pct: number | null;
  avg_agency_pct: number | null;
  avg_overall_star: number | null;
  facilities_below_staffing_benchmark: number;
  facilities_with_ij: number;
  facilities_high_turnover: number;
  total_flags: number;
}

export interface ChainProfile {
  chain: Chain;
  owner?: OwnerEntity;
  facilities: Facility[];
  facilityFlags: Record<string, RiskFlag[]>;
  /** Census-weighted, VERIFIED-members-only aggregates (Business Plan §11). */
  aggregates: ChainAggregates;
}

export interface FacilitySearchRow {
  facility: Facility;
  chainName?: string;
  ownerName?: string;
  privateEquity: boolean;
  reit: boolean;
  overall_star: number | null;
  staffing_star: number | null;
  total_nurse_hprd: number | null;
  turnover_pct: number | null;
  occupancy: number | null;
  flagCount: number;
  topSeverity: RiskFlag["severity"] | null;
}

export type SortField = "risk" | "name" | "hprd" | "turnover" | "occupancy" | "overall";

export interface SearchParams {
  q?: string;
  city?: string;
  ownership?: string;
  ownerType?: "pe" | "reit" | "any";
  minStar?: number;
  hasFlags?: boolean;
  chainId?: string;
  /** PBJ completeness filter. */
  pbj?: "complete" | "incomplete";
  /** Occupancy band filter: "u70" | "u80" | "u90" | "gte90". */
  occ?: string;
  sort?: SortField;
  dir?: "asc" | "desc";
}

export interface ChainDirectoryRow {
  chain: Chain;
  owner?: OwnerEntity;
  verified_count: number;
  inferred_count: number;
  total_beds: number;
  avg_total_nurse_hprd: number | null;
  avg_turnover_pct: number | null;
  avg_overall_star: number | null;
  below_benchmark: number;
  with_ij: number;
  total_flags: number;
  private_equity: boolean;
  reit: boolean;
}

export interface ArchiveInfo {
  quarters: string[];
  depth: number;
  earliest: string;
  latest: string;
}

const SEV_RANK: Record<RiskFlag["severity"], number> = {
  critical: 5, high: 4, elevated: 3, watch: 2, info: 1,
};

export function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

/** Compose a facility profile from fetched facility + snapshots + relations. */
export function buildFacilityProfile(
  facility: Facility,
  snaps: MetricSnapshot[],
  owner?: OwnerEntity,
  chain?: Chain,
): FacilityProfile {
  const metrics = resolveMetrics(ALL_METRIC_KEYS, snaps);
  const flags = computeFacilityRiskFlags(metrics);
  return { facility, owner, chain, metrics, flags };
}

/** Compute a chain's roll-up over its members. Inferred mappings are counted
 *  but excluded from the published aggregates. */
export function buildChainProfile(
  chain: Chain,
  members: Facility[],
  owner: OwnerEntity | undefined,
  snapshotsByCcn: Record<string, MetricSnapshot[]>,
): ChainProfile {
  const facilityFlags: Record<string, RiskFlag[]> = {};
  let wStaffNum = 0, wStaffDen = 0, wTurnNum = 0, wTurnDen = 0, wAgencyNum = 0, wAgencyDen = 0;
  let starSum = 0, starCount = 0;
  let belowBench = 0, withIj = 0, highTurn = 0, totalFlags = 0;
  let totalBeds = 0, totalResidents = 0;
  let verifiedCount = 0, inferredCount = 0;

  for (const f of members) {
    const snaps = snapshotsByCcn[f.ccn] ?? [];
    const metrics = resolveMetrics(ALL_METRIC_KEYS, snaps);
    const flags = computeFacilityRiskFlags(metrics);
    facilityFlags[f.ccn] = flags;

    if (f.chain_confidence === "inferred") { inferredCount += 1; continue; }
    verifiedCount += 1;

    const total = metrics["total_nurse_hprd"];
    const turn = metrics["total_nurse_turnover_pct"];
    const agency = metrics["contract_staff_pct"];
    const overall = metrics["overall_star"];
    totalFlags += flags.length;
    totalBeds += f.certified_beds;
    totalResidents += f.avg_residents_per_day;

    const w = f.avg_residents_per_day || 1;
    if (total?.latest_value != null) { wStaffNum += total.latest_value * w; wStaffDen += w; }
    if (turn?.latest_value != null) { wTurnNum += turn.latest_value * w; wTurnDen += w; }
    if (agency?.latest_value != null) { wAgencyNum += agency.latest_value * w; wAgencyDen += w; }
    if (overall?.latest_value != null) { starSum += overall.latest_value; starCount += 1; }

    if (flags.some((x) => x.id === "below_min_total_staffing")) belowBench += 1;
    if (flags.some((x) => x.id === "immediate_jeopardy")) withIj += 1;
    if (flags.some((x) => x.id === "high_turnover")) highTurn += 1;
  }

  return {
    chain,
    owner,
    facilities: members,
    facilityFlags,
    aggregates: {
      facility_count: members.length,
      verified_count: verifiedCount,
      inferred_count: inferredCount,
      total_beds: totalBeds,
      total_residents: totalResidents,
      avg_total_nurse_hprd: wStaffDen ? round(wStaffNum / wStaffDen, 2) : null,
      avg_turnover_pct: wTurnDen ? round(wTurnNum / wTurnDen, 1) : null,
      avg_agency_pct: wAgencyDen ? round(wAgencyNum / wAgencyDen, 1) : null,
      avg_overall_star: starCount ? round(starSum / starCount, 1) : null,
      facilities_below_staffing_benchmark: belowBench,
      facilities_with_ij: withIj,
      facilities_high_turnover: highTurn,
      total_flags: totalFlags,
    },
  };
}

/** Build one search row from a facility + its snapshots + relations. */
export function buildSearchRow(
  facility: Facility,
  snaps: MetricSnapshot[],
  chain?: Chain,
  owner?: OwnerEntity,
): FacilitySearchRow {
  const metrics = resolveMetrics(ALL_METRIC_KEYS, snaps);
  const flags = sortFlags(computeFacilityRiskFlags(metrics));
  return {
    facility,
    chainName: chain?.name,
    ownerName: owner?.name,
    privateEquity: !!owner?.private_equity,
    reit: !!owner?.reit,
    overall_star: metrics["overall_star"]?.latest_value ?? null,
    staffing_star: metrics["staffing_star"]?.latest_value ?? null,
    total_nurse_hprd: metrics["total_nurse_hprd"]?.latest_value ?? null,
    turnover_pct: metrics["total_nurse_turnover_pct"]?.latest_value ?? null,
    occupancy: metrics["occupancy_rate"]?.latest_value ?? null,
    flagCount: flags.length,
    topSeverity: flags[0]?.severity ?? null,
  };
}

export function sortSearchRows(rows: FacilitySearchRow[]): FacilitySearchRow[] {
  return rows.sort((a, b) => {
    const sa = a.topSeverity ? SEV_RANK[a.topSeverity] : 0;
    const sb = b.topSeverity ? SEV_RANK[b.topSeverity] : 0;
    if (sb !== sa) return sb - sa;
    return b.flagCount - a.flagCount;
  });
}

/** Apply the PBJ / occupancy filters and the chosen sort to a row set. Shared by
 *  both backends so filtering + sorting act on the FULL filtered set, not just
 *  the visible page. Caller slices afterward. */
export function refineSearchRows(rows: FacilitySearchRow[], params: SearchParams): FacilitySearchRow[] {
  let out = rows;
  if (params.pbj === "incomplete") out = out.filter((r) => r.facility.pbj_incomplete);
  else if (params.pbj === "complete") out = out.filter((r) => !r.facility.pbj_incomplete);

  if (params.occ) {
    out = out.filter((r) => {
      const o = r.occupancy;
      if (o == null) return false;
      switch (params.occ) {
        case "u70": return o < 70;
        case "u80": return o < 80;
        case "u90": return o < 90;
        case "gte90": return o >= 90;
        default: return true;
      }
    });
  }

  const field: SortField = params.sort ?? "risk";
  if (field === "risk") return sortSearchRows([...out]);

  const dir = params.dir ?? (field === "name" ? "asc" : "desc");
  const mult = dir === "asc" ? 1 : -1;
  const numCmp = (av: number | null, bv: number | null): number => {
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls always last
    if (bv == null) return -1;
    return mult * (av - bv);
  };
  return [...out].sort((a, b) => {
    switch (field) {
      case "name": return mult * a.facility.name.localeCompare(b.facility.name);
      case "hprd": return numCmp(a.total_nurse_hprd, b.total_nurse_hprd);
      case "turnover": return numCmp(a.turnover_pct, b.turnover_pct);
      case "occupancy": return numCmp(a.occupancy, b.occupancy);
      case "overall": return numCmp(a.overall_star, b.overall_star);
      default: return 0;
    }
  });
}

/** Search-time text match against a facility and its relations. */
export function matchesQuery(
  q: string,
  f: Facility,
  chain?: Chain,
  owner?: OwnerEntity,
): boolean {
  const hay = `${f.name} ${f.city} ${f.county} ${f.ccn} ${chain?.name ?? ""} ${owner?.name ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export { resolveMetric };
