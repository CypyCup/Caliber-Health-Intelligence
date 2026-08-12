import Link from "next/link";
import type { Metadata } from "next";
import { getAllFacilities, getFacilityProfile } from "@/lib/data";
import { CompareSelector } from "@/components/CompareSelector";
import { StarRating } from "@/components/StarRating";
import { formatValue, formatDelta, trendArrow } from "@/lib/format";
import { METRIC_DEFINITIONS } from "@/lib/metrics";

export const metadata: Metadata = { title: "Compare facilities" };

const COMPARE_KEYS = [
  "total_nurse_hprd", "rn_hprd", "cna_hprd", "contract_staff_pct",
  "total_nurse_turnover_pct", "staffing_star", "overall_star",
  "total_deficiencies", "ij_deficiencies", "operating_margin_pct",
];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams["ccns"];
  const ccns = (Array.isArray(raw) ? raw[0] : raw)?.split(",").filter(Boolean).slice(0, 4) ?? [];

  const [facilities, profiles] = await Promise.all([
    getAllFacilities(),
    Promise.all(ccns.map((c) => getFacilityProfile(c))),
  ]);
  const cols = profiles.filter((p): p is NonNullable<typeof p> => !!p);
  const options = facilities.map((f) => ({ ccn: f.ccn, name: f.name }));

  return (
    <div className="container-chi py-10">
      <p className="kicker">Screen</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink">Compare facilities</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Line up acquisition targets or portfolio peers side by side. Each cell shows the latest value
        and its year-over-year move.
      </p>

      <div className="mt-6">
        <CompareSelector options={options} selected={ccns} />
      </div>

      {cols.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-10 text-center text-ink-faint">
          Add facilities above to build a comparison. Tip: start from{" "}
          <Link href="/search" className="link-quiet">search</Link>.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-paper-muted text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Metric</th>
                {cols.map((c) => (
                  <th key={c.facility.ccn} className="px-4 py-3">
                    <Link href={`/facility/${c.facility.ccn}`} className="font-semibold text-brand hover:underline">
                      {c.facility.name}
                    </Link>
                    <div className="mt-0.5 text-xs font-normal text-ink-faint">
                      {c.facility.city} · {c.flags.length} flags
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-medium text-ink-soft">Overall rating</td>
                {cols.map((c) => (
                  <td key={c.facility.ccn} className="px-4 py-3">
                    <StarRating value={c.metrics["overall_star"]?.latest_value ?? null} size={13} />
                  </td>
                ))}
              </tr>
              {COMPARE_KEYS.filter((k) => k !== "overall_star").map((key) => {
                const def = METRIC_DEFINITIONS.find((d) => d.key === key)!;
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-ink-soft">{def.label}</td>
                    {cols.map((c) => {
                      const m = c.metrics[key];
                      return (
                        <td key={c.facility.ccn} className="px-4 py-3">
                          <span className="stat-num text-ink">{m ? formatValue(m.latest_value, def) : "—"}</span>
                          {m && m.yoy_delta != null && !def.cadence.toLowerCase().includes("annual") && (
                            <span className="ml-2 text-xs text-ink-faint">
                              {trendArrow(m.yoy_delta)} {formatDelta(m.yoy_delta, def)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
