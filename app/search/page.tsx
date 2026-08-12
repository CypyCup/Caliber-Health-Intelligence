import Link from "next/link";
import type { Metadata } from "next";
import { getCities, searchFacilities, type SearchParams } from "@/lib/data";
import { SearchBox } from "@/components/SearchBox";
import { SearchFilters } from "@/components/SearchFilters";
import { SortHeader } from "@/components/SortHeader";
import { StarRating } from "@/components/StarRating";

export const metadata: Metadata = { title: "Explore facilities" };

const SEV_DOT: Record<string, string> = {
  critical: "bg-risk-critical", high: "bg-risk-high", elevated: "bg-risk-elevated",
  watch: "bg-risk-watch", info: "bg-risk-info",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const s = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const params: SearchParams = {
    q: s("q"),
    city: s("city"),
    ownership: s("ownership"),
    ownerType: (s("ownerType") as SearchParams["ownerType"]) || undefined,
    minStar: s("minStar") ? Number(s("minStar")) : undefined,
    hasFlags: s("hasFlags") === "1",
    chainId: s("chainId"),
    pbj: (s("pbj") as SearchParams["pbj"]) || undefined,
    occ: s("occ"),
    sort: (s("sort") as SearchParams["sort"]) || undefined,
    dir: (s("dir") as SearchParams["dir"]) || undefined,
  };

  const [rows, cities] = await Promise.all([searchFacilities(params), getCities()]);

  return (
    <div className="container-chi py-10">
      <p className="kicker">Explore</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink">Skilled nursing facilities</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Default sort is risk exposure — click any column to re-sort, and filter by occupancy or PBJ
        completeness. Every metric carries its vintage on the facility page.
      </p>

      <div className="mt-6 space-y-3">
        <SearchBox defaultValue={params.q ?? ""} placeholder="Search facilities, cities, chains, or owners…" />
        <SearchFilters cities={cities} />
      </div>

      <p className="mt-6 text-sm text-ink-faint">
        {rows.length} facilit{rows.length === 1 ? "y" : "ies"}
        {params.q ? ` matching “${params.q}”` : ""}
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3"><SortHeader field="name" label="Facility" /></th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 text-right"><SortHeader field="hprd" label="Total HPRD" align="right" /></th>
              <th className="px-4 py-3 text-right"><SortHeader field="turnover" label="Turnover" align="right" /></th>
              <th className="px-4 py-3 text-right"><SortHeader field="occupancy" label="Occupancy" align="right" /></th>
              <th className="px-4 py-3 font-medium">PBJ</th>
              <th className="px-4 py-3"><SortHeader field="overall" label="Overall" /></th>
              <th className="px-4 py-3"><SortHeader field="risk" label="Risk" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.facility.ccn} className="hover:bg-brand-tint/40">
                <td className="px-4 py-3">
                  <Link href={`/facility/${r.facility.ccn}`} className="font-medium text-brand hover:underline">
                    {r.facility.name}
                  </Link>
                  <div className="text-xs text-ink-faint">
                    {r.facility.city}, {r.facility.state} ·{" "}
                    {r.chainName ? (
                      <Link href={`/chain/${r.facility.chain_id}`} className="hover:text-brand">{r.chainName}</Link>
                    ) : "Independent"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.privateEquity && <span className="pill bg-violet-50 text-violet-700 border border-violet-200">PE</span>}
                    {r.reit && <span className="pill bg-sky-50 text-sky-700 border border-sky-200">REIT</span>}
                    <span className="pill bg-slate-100 text-ink-faint">{r.facility.ownership_type}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right stat-num">{r.total_nurse_hprd?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-3 text-right stat-num">{r.turnover_pct != null ? `${r.turnover_pct.toFixed(0)}%` : "—"}</td>
                <td className="px-4 py-3 text-right stat-num">{r.occupancy != null ? `${r.occupancy.toFixed(0)}%` : "—"}</td>
                <td className="px-4 py-3">
                  {r.facility.pbj_incomplete ? (
                    <span className="pill bg-amber-50 text-amber-800 border border-amber-200" title="Incomplete PBJ data (CMS footnote 26/27)">Incomplete</span>
                  ) : (
                    <span className="pill bg-green-50 text-green-700 border border-green-200">Complete</span>
                  )}
                </td>
                <td className="px-4 py-3"><StarRating value={r.overall_star} size={13} /></td>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-faint">
                  No facilities match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
