// ---------------------------------------------------------------------------
// Data access layer.
//
// The whole app talks to these async functions. In "demo" mode (default) they
// read the bundled Texas JSON seed. Swapping CHI_DATA_SOURCE=supabase later is
// a change ONLY inside this module — no page or component code changes, because
// the API is already async. See docs/architecture.md.
// ---------------------------------------------------------------------------
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

import facilitiesJson from "@/data/seed/texas/facilities.json";
import chainsJson from "@/data/seed/texas/chains.json";
import ownersJson from "@/data/seed/texas/owners.json";
import snapshotsJson from "@/data/seed/texas/metric_snapshots.json";
import seedMeta from "@/data/seed/seed_metadata.json";

const facilities = facilitiesJson as unknown as Facility[];
const chains = chainsJson as unknown as Chain[];
const owners = ownersJson as unknown as OwnerEntity[];
const snapshots = snapshotsJson as unknown as MetricSnapshot[];

// Index snapshots by CCN once at module load for fast facility lookups.
const snapshotsByCcn: Record<string, MetricSnapshot[]> = {};
for (const s of snapshots) {
  (snapshotsByCcn[s.ccn] ||= []).push(s);
}

const ALL_METRIC_KEYS = METRIC_DEFINITIONS.map((m) => m.key);

export interface SeedMeta {
  dataset: string;
  synthetic: boolean;
  disclaimer: string;
  facilities: number;
  chains: number;
  quarters: string[];
  generated_on: string;
}

export async function getSeedMeta(): Promise<SeedMeta> {
  return seedMeta as SeedMeta;
}

// --- Facilities ------------------------------------------------------------
export async function getAllFacilities(): Promise<Facility[]> {
  return facilities;
}

export async function getFacility(ccn: string): Promise<Facility | undefined> {
  return facilities.find((f) => f.ccn === ccn);
}

export async function getFacilitySnapshots(ccn: string): Promise<MetricSnapshot[]> {
  return snapshotsByCcn[ccn] ?? [];
}

// --- Chains & owners -------------------------------------------------------
export async function getAllChains(): Promise<Chain[]> {
  return chains;
}
export async function getChain(id: string): Promise<Chain | undefined> {
  return chains.find((c) => c.id === id);
}
export async function getOwner(id: string | undefined): Promise<OwnerEntity | undefined> {
  if (!id) return undefined;
  return owners.find((o) => o.id === id);
}

// --- Composed profiles -----------------------------------------------------
export interface FacilityProfile {
  facility: Facility;
  owner?: OwnerEntity;
  chain?: Chain;
  metrics: Record<string, ResolvedMetric | undefined>;
  flags: RiskFlag[];
}

export async function getFacilityProfile(ccn: string): Promise<FacilityProfile | undefined> {
  const facility = await getFacility(ccn);
  if (!facility) return undefined;
  const snaps = await getFacilitySnapshots(ccn);
  const metrics = resolveMetrics(ALL_METRIC_KEYS, snaps);
  const flags = computeFacilityRiskFlags(metrics);
  const [owner, chain] = await Promise.all([getOwner(facility.owner_id), facility.chain_id ? getChain(facility.chain_id) : Promise.resolve(undefined)]);
  return { facility, owner, chain, metrics, flags };
}

export interface ChainProfile {
  chain: Chain;
  owner?: OwnerEntity;
  facilities: Facility[];
  /** Roll-up of each member facility's flags. */
  facilityFlags: Record<string, RiskFlag[]>;
  /** Census-weighted staffing/turnover aggregates. Computed over VERIFIED
   *  members only — inferred mappings are excluded from published chain-level
   *  figures (Business Plan §11). */
  aggregates: {
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
  };
}

export async function getChainProfile(id: string): Promise<ChainProfile | undefined> {
  const chain = await getChain(id);
  if (!chain) return undefined;
  const members = facilities.filter((f) => f.chain_id === id);
  const owner = await getOwner(chain.owner_id);

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

    // Inferred mappings are shown, but excluded from published chain-level figures.
    const published = f.chain_confidence !== "inferred";
    if (published) verifiedCount += 1;
    else { inferredCount += 1; continue; }

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

// --- Search ----------------------------------------------------------------
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
  flagCount: number;
  topSeverity: RiskFlag["severity"] | null;
}

export interface SearchParams {
  q?: string;
  city?: string;
  ownership?: string;
  ownerType?: "pe" | "reit" | "any";
  minStar?: number;
  hasFlags?: boolean;
  chainId?: string;
}

const SEV_RANK: Record<RiskFlag["severity"], number> = {
  critical: 5, high: 4, elevated: 3, watch: 2, info: 1,
};

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

    if (q) {
      const hay = `${f.name} ${f.city} ${f.county} ${f.ccn} ${chain?.name ?? ""} ${owner?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const snaps = snapshotsByCcn[f.ccn] ?? [];
    const overall = resolveMetric("overall_star", snaps)?.latest_value ?? null;
    const staffing = resolveMetric("staffing_star", snaps)?.latest_value ?? null;
    const total = resolveMetric("total_nurse_hprd", snaps)?.latest_value ?? null;
    const turnover = resolveMetric("total_nurse_turnover_pct", snaps)?.latest_value ?? null;

    if (params.minStar && (overall == null || overall < params.minStar)) continue;

    const metrics = resolveMetrics(ALL_METRIC_KEYS, snaps);
    const flags = sortFlags(computeFacilityRiskFlags(metrics));
    if (params.hasFlags && flags.length === 0) continue;

    rows.push({
      facility: f,
      chainName: chain?.name,
      ownerName: owner?.name,
      privateEquity: !!owner?.private_equity,
      reit: !!owner?.reit,
      overall_star: overall,
      staffing_star: staffing,
      total_nurse_hprd: total,
      turnover_pct: turnover,
      flagCount: flags.length,
      topSeverity: flags[0]?.severity ?? null,
    });
  }

  // Default sort: most at-risk first (by top severity, then flag count).
  rows.sort((a, b) => {
    const sa = a.topSeverity ? SEV_RANK[a.topSeverity] : 0;
    const sb = b.topSeverity ? SEV_RANK[b.topSeverity] : 0;
    if (sb !== sa) return sb - sa;
    return b.flagCount - a.flagCount;
  });
  return rows;
}

export async function getCities(): Promise<string[]> {
  return Array.from(new Set(facilities.map((f) => f.city))).sort();
}

// --- Entity-resolution crosswalk: chains directory -------------------------
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

export async function getChainsDirectory(): Promise<ChainDirectoryRow[]> {
  const rows = await Promise.all(
    chains.map(async (c) => {
      const p = await getChainProfile(c.id);
      const a = p!.aggregates;
      return {
        chain: c,
        owner: p!.owner,
        verified_count: a.verified_count,
        inferred_count: a.inferred_count,
        total_beds: a.total_beds,
        avg_total_nurse_hprd: a.avg_total_nurse_hprd,
        avg_turnover_pct: a.avg_turnover_pct,
        avg_overall_star: a.avg_overall_star,
        below_benchmark: a.facilities_below_staffing_benchmark,
        with_ij: a.facilities_with_ij,
        total_flags: a.total_flags,
        private_equity: !!p!.owner?.private_equity,
        reit: !!p!.owner?.reit,
      };
    }),
  );
  rows.sort((x, y) => y.below_benchmark - x.below_benchmark || y.total_flags - x.total_flags);
  return rows;
}

// --- The point-in-time archive: how deep is the captured history? ----------
export interface ArchiveInfo {
  quarters: string[];
  depth: number;
  earliest: string;
  latest: string;
}

export async function getArchiveInfo(): Promise<ArchiveInfo> {
  const periods = Array.from(new Set(snapshots.map((s) => s.period)))
    .filter((p) => /^\d{4}Q[1-4]$/.test(p))
    .sort();
  return {
    quarters: periods,
    depth: periods.length,
    earliest: periods[0] ?? "",
    latest: periods[periods.length - 1] ?? "",
  };
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
