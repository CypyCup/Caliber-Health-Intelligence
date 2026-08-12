import Link from "next/link";
import type { Metadata } from "next";
import { getChainsDirectory } from "@/lib/data";
import { NATIONAL_SCOPE } from "@/lib/scope";
import { StarRating } from "@/components/StarRating";
import { BENCHMARKS } from "@/lib/benchmarks";

export const metadata: Metadata = { title: "Operators & chains" };

export default async function ChainsPage() {
  const rows = await getChainsDirectory();
  const totalVerified = rows.reduce((n, r) => n + r.verified_count, 0);

  return (
    <div className="container-chi py-10">
      <p className="kicker">The entity-resolution layer</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink">Operators &amp; chains</h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">
        A CMS certification number identifies a building, not an operator. This directory resolves
        facilities into the chains, private-equity sponsors, and REIT landlords behind them — the
        level an investor question is actually asked at. The national model resolves{" "}
        <strong>{NATIONAL_SCOPE.facilities.toLocaleString()}</strong> facilities into{" "}
        <strong>{NATIONAL_SCOPE.chains.toLocaleString()}</strong> chains; this demo shows{" "}
        {rows.length} operators over {totalVerified} verified facilities.
      </p>
      <p className="mt-3 text-xs text-ink-faint">
        Published chain-level figures below count <strong>verified</strong> members only; inferred
        mappings are excluded until confirmed against a public filing.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Operator</th>
              <th className="px-4 py-3 font-medium">Ownership</th>
              <th className="px-4 py-3 font-medium text-right">Facilities</th>
              <th className="px-4 py-3 font-medium text-right">Wtd HPRD</th>
              <th className="px-4 py-3 font-medium text-right">Wtd turnover</th>
              <th className="px-4 py-3 font-medium">Avg rating</th>
              <th className="px-4 py-3 font-medium">Below benchmark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const belowShare = r.verified_count ? Math.round((r.below_benchmark / r.verified_count) * 100) : 0;
              const understaffed = r.avg_total_nurse_hprd != null && r.avg_total_nurse_hprd < BENCHMARKS.cms_min_total_nurse_hprd;
              return (
                <tr key={r.chain.id} className="hover:bg-brand-tint/40">
                  <td className="px-4 py-3">
                    <Link href={`/chain/${r.chain.id}`} className="font-medium text-brand hover:underline">
                      {r.chain.name}
                    </Link>
                    {r.with_ij > 0 && (
                      <span className="ml-2 pill bg-red-50 text-risk-critical border border-red-200">
                        {r.with_ij} IJ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.private_equity && <span className="pill bg-violet-50 text-violet-700 border border-violet-200">PE</span>}
                      {r.reit && <span className="pill bg-sky-50 text-sky-700 border border-sky-200">REIT</span>}
                      {!r.private_equity && !r.reit && <span className="pill bg-slate-100 text-ink-faint">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right stat-num">
                    {r.verified_count}
                    {r.inferred_count > 0 && (
                      <span className="text-ink-faint"> +{r.inferred_count}<span className="text-[10px]"> inf</span></span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right stat-num ${understaffed ? "text-risk-high" : ""}`}>
                    {r.avg_total_nurse_hprd?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right stat-num">
                    {r.avg_turnover_pct != null ? `${r.avg_turnover_pct.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-3"><StarRating value={r.avg_overall_star} size={13} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-risk-high" style={{ width: `${belowShare}%` }} />
                      </div>
                      <span className="stat-num text-xs text-ink-soft">{r.below_benchmark}/{r.verified_count}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
