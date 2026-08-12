"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StarRating } from "./StarRating";

export interface ChainRow {
  id: string;
  name: string;
  num_facilities: number | null;
  num_states: number | null;
  overall_star: number | null;
  staffing_star: number | null;
  total_nurse_hprd: number | null;
  turnover_pct: number | null;
  fines_total_usd: number | null;
  sff: number | null;
  sff_candidates: number | null;
  abuse_count: number | null;
  flagCount: number;
  topSeverity: string | null;
  pct_for_profit: number | null;
  privateEquity?: boolean;
  reit?: boolean;
  publicTicker?: string;
}

const SEV_DOT: Record<string, string> = {
  critical: "bg-risk-critical", high: "bg-risk-high", elevated: "bg-risk-elevated",
  watch: "bg-risk-watch", info: "bg-risk-info",
};

type Sort = "risk" | "facilities" | "staffing" | "turnover" | "fines";

export function CmsChainsTable({ rows }: { rows: ChainRow[] }) {
  const [q, setQ] = useState("");
  const [minFac, setMinFac] = useState(0);
  const [onlySff, setOnlySff] = useState(false);
  const [sort, setSort] = useState<Sort>("risk");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = rows.filter((x) => {
      if (needle && !x.name.toLowerCase().includes(needle)) return false;
      if (minFac && (x.num_facilities ?? 0) < minFac) return false;
      if (onlySff && (x.sff ?? 0) < 1) return false;
      return true;
    });
    const num = (v: number | null) => (v == null ? -Infinity : v);
    r = [...r].sort((a, b) => {
      switch (sort) {
        case "facilities": return num(b.num_facilities) - num(a.num_facilities);
        case "staffing": return num(a.total_nurse_hprd) - num(b.total_nurse_hprd); // worst first
        case "turnover": return num(b.turnover_pct) - num(a.turnover_pct);
        case "fines": return num(b.fines_total_usd) - num(a.fines_total_usd);
        default: return 0; // risk = pre-sorted
      }
    });
    return r;
  }, [rows, q, minFac, onlySff, sort]);

  const sel = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search operators… (e.g. Ensign, PACS, Genesis)"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <select className={sel} value={minFac} onChange={(e) => setMinFac(Number(e.target.value))}>
          <option value={0}>Any size</option>
          <option value={10}>10+ facilities</option>
          <option value={25}>25+ facilities</option>
          <option value={50}>50+ facilities</option>
          <option value={100}>100+ facilities</option>
        </select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="risk">Sort: risk</option>
          <option value="facilities">Sort: size</option>
          <option value="staffing">Sort: lowest staffing</option>
          <option value="turnover">Sort: highest turnover</option>
          <option value="fines">Sort: highest fines</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={onlySff} onChange={(e) => setOnlySff(e.target.checked)} className="accent-brand" />
          Has Special Focus Facility
        </label>
        <span className="text-xs text-ink-faint">{filtered.length} of {rows.length}</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Operator</th>
              <th className="px-4 py-3 font-medium text-right">Facilities</th>
              <th className="px-4 py-3 font-medium">Overall</th>
              <th className="px-4 py-3 font-medium text-right">HPRD</th>
              <th className="px-4 py-3 font-medium text-right">Turnover</th>
              <th className="px-4 py-3 font-medium text-right">Total fines</th>
              <th className="px-4 py-3 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 300).map((r) => (
              <tr key={r.id} className="hover:bg-brand-tint/40">
                <td className="px-4 py-3">
                  <Link href={`/chain/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.privateEquity && <span className="pill bg-violet-50 text-violet-700 border border-violet-200">PE</span>}
                    {r.reit && <span className="pill bg-sky-50 text-sky-700 border border-sky-200">REIT</span>}
                    {r.publicTicker && <span className="pill bg-slate-100 text-ink-faint">{r.publicTicker}</span>}
                    {(r.sff ?? 0) >= 1 && <span className="pill bg-red-50 text-risk-critical border border-red-200">{Math.round(r.sff!)} SFF</span>}
                    {(r.abuse_count ?? 0) >= 1 && <span className="pill bg-orange-50 text-risk-elevated border border-orange-200">{Math.round(r.abuse_count!)} abuse</span>}
                    <span className="pill bg-slate-100 text-ink-faint">{r.num_states ?? "—"} states</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right stat-num">{r.num_facilities != null ? Math.round(r.num_facilities) : "—"}</td>
                <td className="px-4 py-3"><StarRating value={r.overall_star} size={13} /></td>
                <td className={`px-4 py-3 text-right stat-num ${r.total_nurse_hprd != null && r.total_nurse_hprd < 3.48 ? "text-risk-high" : ""}`}>
                  {r.total_nurse_hprd?.toFixed(2) ?? "—"}
                </td>
                <td className="px-4 py-3 text-right stat-num">{r.turnover_pct != null ? `${r.turnover_pct.toFixed(0)}%` : "—"}</td>
                <td className="px-4 py-3 text-right stat-num">{r.fines_total_usd != null ? `$${Math.round(r.fines_total_usd).toLocaleString("en-US")}` : "—"}</td>
                <td className="px-4 py-3">
                  {r.flagCount === 0 ? (
                    <span className="pill bg-green-50 text-green-700 border border-green-200">Clear</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${SEV_DOT[r.topSeverity ?? "info"]}`} />
                      <span className="stat-num text-ink-soft">{r.flagCount}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 300 && (
        <p className="mt-2 text-xs text-ink-faint">Showing the first 300 of {filtered.length}. Narrow with search or filters.</p>
      )}
    </div>
  );
}
