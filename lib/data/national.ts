// National real-facility backend — reads the ingested CMS Provider Information
// (data/seed/national) from disk at runtime and caches it. This is the default
// facility source (CHI_DATA_SOURCE != "supabase"): 14,693 real facilities linked
// to the real CMS chains by CMS Chain ID.
import { readFileSync } from "fs";
import path from "path";
import type { Chain, Facility, MetricSnapshot, OwnerEntity, ResolvedMetric, RiskFlag } from "../types";
import { METRIC_DEFINITIONS, METRIC_BY_KEY } from "../metrics";
import { computeFacilityRiskFlags, sortFlags } from "../riskFlags";
import { getCmsChainById } from "./cmsChains";
import { getChainOwnership } from "../ownershipOverrides";
import {
  buildSearchRow, matchesQuery, sortSearchRows,
  type ArchiveInfo, type ChainDirectoryRow, type ChainProfile,
  type FacilityProfile, type FacilitySearchRow, type SearchParams, type SeedMeta,
} from "./shared";

// --- Lazy, cached loads ----------------------------------------------------
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data/seed/national", rel), "utf8")) as T;
}

interface HistoryFile {
  source: string;
  latest_period: string;
  vintage_date: string;
  periods: Record<string, Record<string, Record<string, number>>>; // period -> ccn -> metric -> value
}
interface MetaFile {
  dataset: string; source: string; synthetic: boolean;
  facilities: number; chained_facilities: number; independent_facilities: number;
  periods: string[]; latest_period: string;
}

let _facilities: Facility[] | null = null;
let _byCcn: Record<string, Facility> | null = null;
let _history: HistoryFile | null = null;
let _meta: MetaFile | null = null;
let _sortedPeriods: string[] | null = null;

function facilities(): Facility[] {
  return (_facilities ??= load<Facility[]>("facilities.json"));
}
function byCcn(): Record<string, Facility> {
  if (!_byCcn) _byCcn = Object.fromEntries(facilities().map((f) => [f.ccn, f]));
  return _byCcn;
}
function history(): HistoryFile {
  return (_history ??= load<HistoryFile>("facility_history.json"));
}
function meta(): MetaFile {
  return (_meta ??= load<MetaFile>("meta.json"));
}
function periods(): string[] {
  return (_sortedPeriods ??= Object.keys(history().periods).sort());
}

/** Month label 12 back, e.g. "2026-07" -> "2025-07". */
function yearAgo(period: string): string {
  const [y, m] = period.split("-");
  return `${Number(y) - 1}-${m}`;
}

/** Build ResolvedMetric objects for a facility from the monthly history. */
function resolveFacilityMetrics(ccn: string): Record<string, ResolvedMetric | undefined> {
  const out: Record<string, ResolvedMetric | undefined> = {};
  const ps = periods();
  const h = history().periods;
  for (const def of METRIC_DEFINITIONS) {
    const hist: { period: string; value: number | null }[] = [];
    for (const p of ps) {
      const v = h[p]?.[ccn]?.[def.key];
      if (v != null) hist.push({ period: p, value: v });
    }
    if (hist.length === 0) continue;
    const latest = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const yoyLabel = yearAgo(latest.period);
    const yoy = hist.find((x) => x.period === yoyLabel);
    out[def.key] = {
      definition: def,
      latest_value: latest.value,
      latest_period: latest.period,
      vintage_date: `${latest.period}-01`,
      qoq_delta: prev?.value != null && latest.value != null ? round(latest.value - prev.value, def.precision + 1) : null,
      yoy_delta: yoy?.value != null && latest.value != null ? round(latest.value - yoy.value, def.precision + 1) : null,
      history: hist,
    };
  }
  return out;
}

// Cached per-facility flags + search rows (computed once).
let _flagsByCcn: Record<string, RiskFlag[]> | null = null;
let _searchRows: FacilitySearchRow[] | null = null;

function ensureIndex(): void {
  if (_searchRows) return;
  _flagsByCcn = {};
  _searchRows = [];
  for (const f of facilities()) {
    const metrics = resolveFacilityMetrics(f.ccn);
    const flags = sortFlags(computeFacilityRiskFlags(metrics, f));
    _flagsByCcn[f.ccn] = flags;
    const chain = f.chain_id ? getCmsChainById(f.chain_id) : undefined;
    const own = getChainOwnership(f.chain_id);
    const row = buildSearchRow(
      f,
      snapshotsFromMetrics(metrics),
      chain ? ({ id: f.chain_id!, name: chain.name } as Chain) : undefined,
      own ? ({ id: f.chain_id!, name: chain?.name ?? "", private_equity: own.private_equity, reit: own.reit } as OwnerEntity) : undefined,
    );
    // buildSearchRow recomputes flags from snapshots (no facility signals); use
    // our full flag count (incl. SFF/abuse) instead.
    row.flagCount = flags.length;
    row.topSeverity = flags[0]?.severity ?? null;
    _searchRows.push(row);
  }
}

function flagsByCcn(): Record<string, RiskFlag[]> {
  ensureIndex();
  return _flagsByCcn!;
}

/** Synthesize snapshots from resolved metrics (for buildSearchRow reuse). */
function snapshotsFromMetrics(metrics: Record<string, ResolvedMetric | undefined>): MetricSnapshot[] {
  const out: MetricSnapshot[] = [];
  for (const rm of Object.values(metrics)) {
    if (!rm) continue;
    for (const h of rm.history) {
      if (h.value != null) out.push({ ccn: "", metric_key: rm.definition.key, period: h.period, value: h.value, vintage_date: rm.vintage_date, source: "provider" });
    }
  }
  return out;
}

// --- Public API ------------------------------------------------------------
export async function getSeedMeta(): Promise<SeedMeta> {
  const m = meta();
  return {
    dataset: m.dataset, synthetic: m.synthetic,
    disclaimer: "Real CMS Provider Information. Facility→chain links are verified from the CMS Chain ID.",
    facilities: m.facilities, chains: 0, quarters: m.periods, generated_on: m.latest_period,
  };
}

export async function getAllFacilities(): Promise<Facility[]> {
  return facilities();
}
export async function getFacility(ccn: string): Promise<Facility | undefined> {
  return byCcn()[ccn];
}
export async function getFacilitySnapshots(ccn: string): Promise<MetricSnapshot[]> {
  const s = snapshotsFromMetrics(resolveFacilityMetrics(ccn));
  return s.map((x) => ({ ...x, ccn }));
}

export async function getFacilityProfile(ccn: string): Promise<FacilityProfile | undefined> {
  const facility = byCcn()[ccn];
  if (!facility) return undefined;
  const metrics = resolveFacilityMetrics(ccn);
  const flags = sortFlags(computeFacilityRiskFlags(metrics, facility));
  const cms = facility.chain_id ? getCmsChainById(facility.chain_id) : undefined;
  const own = getChainOwnership(facility.chain_id);
  const chain: Chain | undefined = facility.chain_id
    ? { id: facility.chain_id, name: cms?.name ?? facility.chain_name ?? facility.chain_id, sponsor_name: own?.pe_sponsor_name, reit_name: own?.reit_name, resolution_confidence: own?.confidence }
    : undefined;
  const owner: OwnerEntity | undefined = facility.chain_id
    ? { id: facility.chain_id, name: cms?.name ?? facility.chain_name ?? "", private_equity: !!own?.private_equity, reit: !!own?.reit, pe_sponsor_name: own?.pe_sponsor_name, reit_name: own?.reit_name, confidence: own?.confidence }
    : undefined;
  return { facility, owner, chain, metrics, flags };
}

/** Real member facilities of a chain (used by the CMS chain profile). */
export async function getFacilitiesByChain(chainId: string): Promise<{ facility: Facility; flags: RiskFlag[] }[]> {
  const fb = flagsByCcn();
  return facilities()
    .filter((f) => f.chain_id === chainId)
    .map((f) => ({ facility: f, flags: fb[f.ccn] ?? [] }));
}

// --- Chain roll-ups computed FROM the facility list ------------------------
// These are chain-level metrics CMS's chain file does not provide: they are
// derived by CHI from the individual facilities.
export interface ChainFacilityRollup {
  facility_count: number;
  total_beds: number;
  /** Bed-weighted occupancy: sum(residents) / sum(beds). */
  avg_occupancy_pct: number | null;
  /** Facilities whose PBJ-based staffing/turnover could not be computed (fn 26/27). */
  facilities_missing_pbj: number;
  missing_pbj_pct: number;
}

function rollupFrom(members: Facility[]): ChainFacilityRollup {
  let beds = 0, res = 0, missing = 0;
  for (const f of members) {
    if (f.certified_beds > 0) { beds += f.certified_beds; res += f.avg_residents_per_day; }
    if (f.pbj_incomplete) missing += 1;
  }
  return {
    facility_count: members.length,
    total_beds: beds,
    avg_occupancy_pct: beds ? Math.min(round((100 * res) / beds, 1), 100) : null,
    facilities_missing_pbj: missing,
    missing_pbj_pct: members.length ? Math.round((100 * missing) / members.length) : 0,
  };
}

export async function getChainFacilityRollup(chainId: string): Promise<ChainFacilityRollup> {
  return rollupFrom(facilities().filter((f) => f.chain_id === chainId));
}

let _rollups: Record<string, ChainFacilityRollup> | null = null;
/** All chains' facility-derived roll-ups, computed in one pass and cached. */
export async function getAllChainFacilityRollups(): Promise<Record<string, ChainFacilityRollup>> {
  if (_rollups) return _rollups;
  const groups: Record<string, Facility[]> = {};
  for (const f of facilities()) {
    if (f.chain_id) (groups[f.chain_id] ||= []).push(f);
  }
  _rollups = {};
  for (const [id, members] of Object.entries(groups)) _rollups[id] = rollupFrom(members);
  return _rollups;
}

export async function searchFacilities(params: SearchParams = {}): Promise<FacilitySearchRow[]> {
  ensureIndex();
  const q = params.q?.trim().toLowerCase();
  const rows = _searchRows!.filter((row) => {
    const f = row.facility;
    if (params.chainId && f.chain_id !== params.chainId) return false;
    if (params.city && f.city !== params.city) return false;
    if (params.ownership && f.ownership_type !== params.ownership) return false;
    if (params.ownerType === "pe" && !row.privateEquity) return false;
    if (params.ownerType === "reit" && !row.reit) return false;
    if (params.minStar && (row.overall_star == null || row.overall_star < params.minStar)) return false;
    if (params.hasFlags && row.flagCount === 0) return false;
    if (q) {
      const chain = f.chain_id ? getCmsChainById(f.chain_id) : undefined;
      if (!matchesQuery(q, f, chain ? ({ id: f.chain_id!, name: chain.name } as Chain) : undefined)) return false;
    }
    return true;
  });
  // Already flag-sorted at index build; re-sort to honor filters' ordering.
  return sortSearchRows([...rows]).slice(0, 500);
}

export async function getCities(): Promise<string[]> {
  return Array.from(new Set(facilities().map((f) => f.city).filter(Boolean))).sort();
}

export async function getArchiveInfo(): Promise<ArchiveInfo> {
  const ps = periods();
  return { quarters: ps, depth: ps.length, earliest: ps[0] ?? "", latest: ps.at(-1) ?? "" };
}

// --- Chain functions: chains live in cmsChains; these keep the API complete --
export async function getAllChains(): Promise<Chain[]> {
  return [];
}
export async function getChain(id: string): Promise<Chain | undefined> {
  const c = getCmsChainById(id);
  if (!c) return undefined;
  const own = getChainOwnership(id);
  return { id, name: c.name, sponsor_name: own?.pe_sponsor_name, reit_name: own?.reit_name, resolution_confidence: own?.confidence };
}
export async function getOwner(id: string | undefined): Promise<OwnerEntity | undefined> {
  if (!id) return undefined;
  const own = getChainOwnership(id);
  const c = getCmsChainById(id);
  if (!own && !c) return undefined;
  return { id, name: c?.name ?? "", private_equity: !!own?.private_equity, reit: !!own?.reit, pe_sponsor_name: own?.pe_sponsor_name, reit_name: own?.reit_name, confidence: own?.confidence };
}
export async function getChainProfile(): Promise<ChainProfile | undefined> {
  return undefined; // real chains render via cmsChains
}
export async function getChainsDirectory(): Promise<ChainDirectoryRow[]> {
  return []; // real chains render via cmsChains
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
