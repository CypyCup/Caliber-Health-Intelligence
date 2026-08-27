// PBJ staffing layer (CMS Payroll-Based Journal), quarterly grain.
//
// Stores RAW numerators/denominators per facility-quarter; all derived metrics
// and roll-ups are computed here by sum(numerators)/sum(denominators) — never by
// averaging facility percentages. Agency/HPRD are null where a denominator is 0.
import { readFileSync } from "fs";
import path from "path";
import type { ResolvedMetric, MetricDefinition } from "../types";
import { METRIC_BY_KEY } from "../metrics";

interface PbjFile {
  cols: string[]; // ["rd","tnh","tnc","rnh","lpnh","aideh","allh","allc","comp"]
  periods: string[];
  values: Record<string, Record<string, number[]>>; // ccn -> quarter -> row
}
interface PbjMeta {
  periods: string[];
  latest_period: string;
  facilities: number;
  facility_quarters: number;
  flagged_quarters: Record<string, string>;
  note: string;
}

// Column offsets in each stored row.
const RD = 0, TNH = 1, TNC = 2, RNH = 3, LPNH = 4, AIDEH = 5, ALLH = 6, ALLC = 7, COMP = 8;

let _f: PbjFile | null = null;
let _meta: PbjMeta | null = null;
function load<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data/seed/pbj", rel), "utf8")) as T;
}
function file(): PbjFile {
  if (_f === null) { try { _f = load<PbjFile>("facility_pbj.json"); } catch { _f = { cols: [], periods: [], values: {} }; } }
  return _f!;
}
export function getPbjMeta(): PbjMeta {
  if (_meta === null) { try { _meta = load<PbjMeta>("meta.json"); } catch { _meta = null as unknown as PbjMeta; } }
  return _meta!;
}
export function getPbjNationalTrend(): Record<string, number>[] {
  try { return load<Record<string, number>[]>("national_trend.json"); } catch { return []; }
}

const div = (num: number | null, den: number | null): number | null =>
  num == null || den == null || den === 0 ? null : num / den;
const pct = (ctr: number | null, hrs: number | null): number | null =>
  ctr == null || hrs == null || hrs === 0 ? null : (ctr / hrs) * 100;
const r2 = (n: number | null, p = 2) => (n == null ? null : Math.round(n * 10 ** p) / 10 ** p);

export interface PbjPoint {
  quarter: string;
  total_nurse_hprd: number | null;
  rn_hprd: number | null;
  lpn_hprd: number | null;
  aide_hprd: number | null;
  all_staff_hprd: number | null;
  total_nurse_agency_pct: number | null;
  all_staff_agency_pct: number | null;
  employee_hours: number | null;
  contract_hours: number | null;
  completeness: number | null;
}

function pointFromRow(quarter: string, x: number[]): PbjPoint {
  return {
    quarter,
    total_nurse_hprd: r2(div(x[TNH], x[RD]), 3),
    rn_hprd: r2(div(x[RNH], x[RD]), 3),
    lpn_hprd: r2(div(x[LPNH], x[RD]), 3),
    aide_hprd: r2(div(x[AIDEH], x[RD]), 3),
    all_staff_hprd: r2(div(x[ALLH], x[RD]), 3),
    total_nurse_agency_pct: r2(pct(x[TNC], x[TNH]), 1),
    all_staff_agency_pct: r2(pct(x[ALLC], x[ALLH]), 1),
    employee_hours: x[TNH] != null && x[TNC] != null ? x[TNH] - x[TNC] : null,
    contract_hours: x[TNC] ?? null,
    completeness: x[COMP] ?? null,
  };
}

export function getFacilityPbjSeries(ccn: string): PbjPoint[] {
  const v = file().values[ccn];
  if (!v) return [];
  return Object.keys(v).sort().map((q) => pointFromRow(q, v[q]));
}

/** Quarter 4 back, e.g. "2026Q1" -> "2025Q1". */
function qtrMinus4(q: string): string {
  const m = /^(\d{4})Q([1-4])$/.exec(q);
  if (!m) return "";
  return `${Number(m[1]) - 1}Q${m[2]}`;
}
function qtrVintage(q: string): string {
  const m = /^(\d{4})Q([1-4])$/.exec(q);
  if (!m) return "";
  const month = ["03", "06", "09", "12"][Number(m[2]) - 1];
  return `${m[1]}-${month}-01`;
}

function toResolved(def: MetricDefinition, series: { period: string; value: number | null }[]): ResolvedMetric | undefined {
  const pts = series.filter((s) => s.value != null) as { period: string; value: number }[];
  if (pts.length === 0) return undefined;
  const latest = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const yoy = pts.find((s) => s.period === qtrMinus4(latest.period));
  return {
    definition: def,
    latest_value: latest.value,
    latest_period: latest.period,
    vintage_date: qtrVintage(latest.period),
    qoq_delta: prev ? r2(latest.value - prev.value, def.precision + 1) : null,
    yoy_delta: yoy ? r2(latest.value - yoy.value, def.precision + 1) : null,
    history: pts,
  };
}

/** ResolvedMetrics for the facility PBJ trend charts. */
export function getFacilityPbjMetrics(ccn: string): {
  agency?: ResolvedMetric;
  hprd?: ResolvedMetric;
  rnHprd?: ResolvedMetric;
} {
  const s = getFacilityPbjSeries(ccn);
  return {
    agency: toResolved(METRIC_BY_KEY["contract_staff_pct"], s.map((p) => ({ period: p.quarter, value: p.total_nurse_agency_pct }))),
    hprd: toResolved(METRIC_BY_KEY["total_nurse_hprd"], s.map((p) => ({ period: p.quarter, value: p.total_nurse_hprd }))),
    rnHprd: toResolved(METRIC_BY_KEY["rn_hprd"], s.map((p) => ({ period: p.quarter, value: p.rn_hprd }))),
  };
}

/** The agency metric as contract_staff_pct, to feed the existing agency-reliance
 *  risk flag and workforce scorecard. */
export function getFacilityAgencyMetric(ccn: string): ResolvedMetric | undefined {
  return getFacilityPbjMetrics(ccn).agency;
}

// --- Chain roll-up: SUM numerators / SUM denominators over members ----------
export interface ChainPbjPoint {
  quarter: string;
  facility_count: number;
  total_nurse_hprd: number | null;
  rn_hprd: number | null;
  total_nurse_agency_pct: number | null;
  dropped_incomplete: number;
}

/** Weighted PBJ roll-up for a set of member CCNs. Facility-quarters below
 *  `minCompleteness` are excluded from the cohort (default 100) and counted. */
export function getChainPbjTrend(memberCcns: string[], minCompleteness = 100): {
  history: ChainPbjPoint[];
  agency?: ResolvedMetric;
  hprd?: ResolvedMetric;
} {
  const f = file();
  const agg: Record<string, { rd: number; tnh: number; tnc: number; rnh: number; n: number; dropped: number }> = {};
  for (const ccn of memberCcns) {
    const v = f.values[ccn];
    if (!v) continue;
    for (const q of Object.keys(v)) {
      const x = v[q];
      const a = (agg[q] ||= { rd: 0, tnh: 0, tnc: 0, rnh: 0, n: 0, dropped: 0 });
      if ((x[COMP] ?? 0) < minCompleteness) { a.dropped += 1; continue; }
      a.rd += x[RD] ?? 0; a.tnh += x[TNH] ?? 0; a.tnc += x[TNC] ?? 0; a.rnh += x[RNH] ?? 0; a.n += 1;
    }
  }
  const history: ChainPbjPoint[] = Object.keys(agg).sort().map((q) => {
    const a = agg[q];
    return {
      quarter: q,
      facility_count: a.n,
      total_nurse_hprd: r2(div(a.tnh, a.rd), 3),
      rn_hprd: r2(div(a.rnh, a.rd), 3),
      total_nurse_agency_pct: r2(pct(a.tnc, a.tnh), 1),
      dropped_incomplete: a.dropped,
    };
  });
  return {
    history,
    agency: toResolved(METRIC_BY_KEY["contract_staff_pct"], history.map((p) => ({ period: p.quarter, value: p.total_nurse_agency_pct }))),
    hprd: toResolved(METRIC_BY_KEY["total_nurse_hprd"], history.map((p) => ({ period: p.quarter, value: p.total_nurse_hprd }))),
  };
}
