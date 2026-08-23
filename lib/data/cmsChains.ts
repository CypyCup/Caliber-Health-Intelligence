// Real CMS chain layer — reads the ingested Nursing Home Chain Performance
// Measures (data/seed/chains_cms). This is REAL, national, chain-level CMS data
// and is served in both demo and Supabase modes (it is its own dataset).
import { readFileSync } from "fs";
import path from "path";
import type { RiskFlag, RiskSeverity } from "../types";
import { CHAIN_METRIC_BY_KEY, type ChainMetricDef } from "../cmsChainMetrics";
import { BENCHMARKS } from "../benchmarks";
import { sortFlags } from "../riskFlags";

import chainsJson from "@/data/seed/chains_cms/chains.json";
import nationalJson from "@/data/seed/chains_cms/national.json";
import metaJson from "@/data/seed/chains_cms/meta.json";

export interface CmsChain {
  id: string;
  cms_chain_id: string;
  name: string;
  num_facilities: number | null;
  num_states: number | null;
  sff: number | null;
  sff_candidates: number | null;
  abuse_count: number | null;
  abuse_pct: number | null;
  pct_for_profit: number | null;
  pct_non_profit: number | null;
  pct_government: number | null;
  /** Newest snapshot the chain appeared in ("current" chains match meta.latest_period). */
  last_period?: string;
}

export interface CmsChainMeta {
  dataset: string;
  source: string;
  synthetic: boolean;
  periods: string[];
  latest_period: string;
  chains: number;
  chains_all_time?: number;
  national_facilities: number;
}

export interface ResolvedChainMetric {
  def: ChainMetricDef;
  latest_value: number | null;
  latest_period: string;
  vintage_date: string;
  prev_delta: number | null;
  history: { period: string; value: number }[];
}

const chains = chainsJson as unknown as CmsChain[];
const national = nationalJson as unknown as Record<string, number | null> & { period?: string; vintage_date?: string };
const meta = metaJson as unknown as CmsChainMeta;
const chainById: Record<string, CmsChain> = Object.fromEntries(chains.map((c) => [c.id, c]));

// The 3-year metric history is compact-nested and fs-loaded (too big to bundle):
// values[chain_id][metric_key][period] = value
interface ChainHistory {
  latest_period: string;
  periods: string[];
  values: Record<string, Record<string, Record<string, number>>>;
}
let _hist: ChainHistory | null = null;
function hist(): ChainHistory {
  if (_hist === null) {
    try {
      _hist = JSON.parse(readFileSync(path.join(process.cwd(), "data/seed/chains_cms/chain_history.json"), "utf8"));
    } catch {
      _hist = { latest_period: "", periods: [], values: {} };
    }
  }
  return _hist!;
}

export function getCmsChainMeta(): CmsChainMeta {
  return meta;
}
export function getCmsNational() {
  return national;
}
export function getCmsChainById(id: string): CmsChain | undefined {
  return chainById[id];
}

function resolveChainMetric(chainId: string, key: string): ResolvedChainMetric | undefined {
  const def = CHAIN_METRIC_BY_KEY[key];
  if (!def) return undefined;
  const pv = hist().values[chainId]?.[key];
  if (!pv) return undefined;
  const periods = Object.keys(pv).sort();
  if (periods.length === 0) return undefined;
  const series = periods.map((p) => ({ period: p, value: pv[p] }));
  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  return {
    def,
    latest_value: latest.value,
    latest_period: latest.period,
    vintage_date: `${latest.period}-01`,
    prev_delta: prev ? round(latest.value - prev.value, def.precision + 1) : null,
    history: series,
  };
}

export function resolveAllChainMetrics(chainId: string): Record<string, ResolvedChainMetric | undefined> {
  const out: Record<string, ResolvedChainMetric | undefined> = {};
  for (const key of Object.keys(CHAIN_METRIC_BY_KEY)) out[key] = resolveChainMetric(chainId, key);
  return out;
}

// --- Chain-level risk flags (real data) ------------------------------------
function mk(
  id: string, label: string, category: RiskFlag["category"], severity: RiskSeverity,
  metric_key: string, threshold_text: string, observed_text: string, vintage_date: string, rationale: string,
): RiskFlag {
  return {
    id, label, category, severity, metric_key, threshold_text, observed_text,
    source: "CMS Nursing Home Chain Performance Measures", vintage_date, rationale,
  };
}

export function computeChainFlags(chain: CmsChain, metrics: Record<string, ResolvedChainMetric | undefined>): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const v = (k: string) => metrics[k]?.latest_value ?? null;
  const vint = (k: string) => metrics[k]?.vintage_date ?? meta.latest_period;

  const total = v("total_nurse_hprd");
  if (total != null && total < BENCHMARKS.cms_min_total_nurse_hprd)
    flags.push(mk("below_min_total_staffing", "Chain avg below CMS minimum total staffing benchmark", "workforce", "high",
      "total_nurse_hprd", `< ${BENCHMARKS.cms_min_total_nurse_hprd} HPRD (${BENCHMARKS.cms_min_rule_label})`, `${total.toFixed(2)} HPRD`, vint("total_nurse_hprd"),
      "Chain-average nurse staffing is below the CMS minimum staffing benchmark. Benchmark comparison, not a compliance finding."));

  const rn = v("rn_hprd");
  if (rn != null && rn < BENCHMARKS.cms_min_rn_hprd)
    flags.push(mk("below_min_rn_staffing", "Chain avg below CMS minimum RN staffing benchmark", "workforce", "high",
      "rn_hprd", `< ${BENCHMARKS.cms_min_rn_hprd} RN HPRD`, `${rn.toFixed(2)} HPRD`, vint("rn_hprd"),
      "Chain-average RN hours are below the CMS minimum RN staffing benchmark."));

  const turn = v("total_nurse_turnover_pct");
  if (turn != null && turn > BENCHMARKS.national_total_nurse_turnover_median_pct)
    flags.push(mk("high_turnover", "Chain turnover above national median", "workforce", turn > 65 ? "elevated" : "watch",
      "total_nurse_turnover_pct", `> ${BENCHMARKS.national_total_nurse_turnover_median_pct}% (CMS national median)`, `${turn.toFixed(1)}%`, vint("total_nurse_turnover_pct"),
      "Chain-average nursing turnover exceeds the national median — a workforce-instability and continuity-of-care signal."));

  const sstar = v("staffing_star");
  if (sstar != null && sstar <= 2.5)
    flags.push(mk("low_staffing_star", "Low chain-average staffing rating", "quality", "watch",
      "staffing_star", "≤ 2.5 of 5 (chain avg staffing rating)", `${sstar.toFixed(1)}★`, vint("staffing_star"),
      "The chain's facilities average a low staffing star."));

  if ((chain.sff ?? 0) >= 1)
    flags.push(mk("special_focus", "Special Focus Facilities in the chain", "regulatory", "critical",
      "sff", "≥ 1 Special Focus Facility", `${Math.round(chain.sff ?? 0)} SFF`, national.vintage_date ?? meta.latest_period,
      "The chain operates one or more Special Focus Facilities — CMS's most serious enforcement status."));
  else if ((chain.sff_candidates ?? 0) >= 1)
    flags.push(mk("sff_candidate", "SFF candidates in the chain", "regulatory", "elevated",
      "sff_candidates", "≥ 1 SFF candidate", `${Math.round(chain.sff_candidates ?? 0)} candidate(s)`, national.vintage_date ?? meta.latest_period,
      "The chain operates one or more Special Focus Facility candidates."));

  if ((chain.abuse_count ?? 0) >= 1)
    flags.push(mk("abuse_icon", "Facilities flagged with an abuse icon", "regulatory", "elevated",
      "abuse_count", "≥ 1 facility with a CMS abuse icon", `${Math.round(chain.abuse_count ?? 0)} facilit${(chain.abuse_count ?? 0) === 1 ? "y" : "ies"}`, national.vintage_date ?? meta.latest_period,
      "CMS flags facilities with a documented abuse citation; the chain has one or more."));

  const fines = v("fines_total_usd");
  if (fines != null && fines > 500_000)
    flags.push(mk("significant_fines", "Significant total fines", "regulatory", "elevated",
      "fines_total_usd", "> $500,000 total fines", `$${Math.round(fines).toLocaleString("en-US")}`, vint("fines_total_usd"),
      "Aggregate CMS fines across the chain indicate sustained compliance exposure."));

  return sortFlags(flags);
}

// --- Directory + profiles --------------------------------------------------
export interface CmsChainDirectoryRow {
  chain: CmsChain;
  overall_star: number | null;
  staffing_star: number | null;
  total_nurse_hprd: number | null;
  turnover_pct: number | null;
  fines_total_usd: number | null;
  flagCount: number;
  topSeverity: RiskSeverity | null;
  criticalCount: number;
}

const SEV_RANK: Record<RiskSeverity, number> = { critical: 5, high: 4, elevated: 3, watch: 2, info: 1 };

export function getCmsChainsDirectory(): CmsChainDirectoryRow[] {
  // Only chains present in the latest snapshot (others entered/exited the file).
  const current = chains.filter((c) => c.last_period === meta.latest_period);
  const rows = current.map((chain) => {
    const m = resolveAllChainMetrics(chain.id);
    const flags = computeChainFlags(chain, m);
    return {
      chain,
      overall_star: m["overall_star"]?.latest_value ?? null,
      staffing_star: m["staffing_star"]?.latest_value ?? null,
      total_nurse_hprd: m["total_nurse_hprd"]?.latest_value ?? null,
      turnover_pct: m["total_nurse_turnover_pct"]?.latest_value ?? null,
      fines_total_usd: m["fines_total_usd"]?.latest_value ?? null,
      flagCount: flags.length,
      topSeverity: flags[0]?.severity ?? null,
      criticalCount: flags.filter((f) => f.severity === "critical").length,
    };
  });
  rows.sort((a, b) => {
    const sa = a.topSeverity ? SEV_RANK[a.topSeverity] : 0;
    const sb = b.topSeverity ? SEV_RANK[b.topSeverity] : 0;
    if (sb !== sa) return sb - sa;
    return b.flagCount - a.flagCount;
  });
  return rows;
}

export interface CmsChainProfile {
  chain: CmsChain;
  metrics: Record<string, ResolvedChainMetric | undefined>;
  flags: RiskFlag[];
  national: Record<string, number | null>;
  latestPeriod: string;
}

export function getCmsChainProfile(id: string): CmsChainProfile | undefined {
  const chain = chainById[id];
  if (!chain) return undefined;
  const metrics = resolveAllChainMetrics(id);
  const flags = computeChainFlags(chain, metrics);
  return { chain, metrics, flags, national, latestPeriod: meta.latest_period };
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
