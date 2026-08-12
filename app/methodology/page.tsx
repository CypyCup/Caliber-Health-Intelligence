import type { Metadata } from "next";
import { SOURCES } from "@/lib/metrics";
import { BENCHMARKS } from "@/lib/benchmarks";
import { getSeedMeta } from "@/lib/data";

export const metadata: Metadata = { title: "Methodology & sources" };

export default async function MethodologyPage() {
  const meta = await getSeedMeta();
  const sources = Object.values(SOURCES);

  return (
    <div className="container-chi max-w-4xl py-10">
      <p className="kicker">Methodology</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink">How the Atlas is built — and disclosed</h1>
      <p className="mt-3 text-lg text-ink-soft">
        Caliber Health Intelligence&apos;s discipline is methodological honesty about data vintage.
        The Atlas holds itself to the same standard as the research: every number carries when it is
        from, and no metric claims freshness the underlying data doesn&apos;t have.
      </p>

      {meta.synthetic && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">This deployment is running the illustrative demo seed.</p>
          <p className="mt-1">{meta.disclaimer}</p>
          <p className="mt-1">
            To load real data, run the CMS ETL pipeline in <code className="font-mono">/etl</code> on a
            network with access to <code className="font-mono">data.cms.gov</code>.
          </p>
        </div>
      )}

      {/* Two-layer data strategy */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">The two-layer data strategy</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <p className="pill bg-green-50 text-green-700 border border-green-200">Current backbone</p>
            <p className="mt-2 text-sm text-ink-soft">
              PBJ staffing, Care Compare Five-Star, turnover, deficiencies, and penalties are current
              to the latest CMS reporting period. These support claims about what is happening now.
            </p>
          </div>
          <div className="card p-5">
            <p className="pill bg-amber-50 text-amber-800 border border-amber-200">Structural / lagged layer</p>
            <p className="mt-2 text-sm text-ink-soft">
              HCRIS Medicare cost-report financials run 12–18 months behind. We use them only for
              structural analysis and label their vintage explicitly wherever they appear.
            </p>
          </div>
        </div>
      </section>

      {/* Sources table */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Data sources</h2>
        <p className="mt-1 text-sm text-ink-soft">Public CMS data only. No private, client, or proprietary employer data is used.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Cadence</th>
                <th className="px-4 py-3 font-medium">Typical lag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((s) => (
                <tr key={s.key}>
                  <td className="px-4 py-3">
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                      {s.name}
                    </a>
                    <div className="text-xs text-ink-faint">{s.publisher}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{s.cadence}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.typical_lag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Risk flag methodology */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">How risk flags work</h2>
        <p className="mt-2 text-sm text-ink-soft">
          The Atlas surfaces <strong>transparent, rule-based flags</strong> — never a composite
          black-box score. Every flag is deterministic and traces to exactly one disclosed CMS metric
          and one published threshold. The analytical synthesis — peer cohorts, financial overlays,
          forward commentary — is deliberately reserved for the CHI quarterly research subscription.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink-soft">
          <li className="card p-3">
            <strong>Staffing benchmarks.</strong> Facilities below {BENCHMARKS.cms_min_total_nurse_hprd} total /
            {" "}{BENCHMARKS.cms_min_rn_hprd} RN / {BENCHMARKS.cms_min_cna_hprd} nurse-aide HPRD are flagged
            against the {BENCHMARKS.cms_min_rule_label}. <em>This is a benchmark comparison, not a
            compliance determination</em> — the standard has been subject to litigation and shifting
            implementation timelines, and we say so wherever it is applied.
          </li>
          <li className="card p-3">
            <strong>Turnover.</strong> Flagged above the CMS national median
            ({BENCHMARKS.national_total_nurse_turnover_median_pct}%).
          </li>
          <li className="card p-3">
            <strong>Agency reliance &amp; weekend coverage.</strong> Flagged against CHI reference lines,
            disclosed as such.
          </li>
          <li className="card p-3">
            <strong>Regulatory.</strong> Any Immediate Jeopardy (J/K/L) citation in the latest survey
            cycle, and trailing-3-year civil monetary penalties above
            ${BENCHMARKS.significant_cmp_usd.toLocaleString("en-US")}.
          </li>
        </ul>
      </section>

      {/* Disclaimers */}
      <section className="mt-10 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Important limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>The Atlas is an informational research surface, not investment, legal, or clinical advice.</li>
          <li>Staffing metrics in this free view are not case-mix adjusted; CMS&apos;s staffing star rating is.</li>
          <li>Reported financials can be distorted by related-party rent and management-fee structures.</li>
          <li>CMS data contains reporting lags and occasional revisions; vintage is disclosed to make that legible.</li>
          <li>Caliber Health Intelligence is not affiliated with or endorsed by CMS.</li>
        </ul>
      </section>
    </div>
  );
}
