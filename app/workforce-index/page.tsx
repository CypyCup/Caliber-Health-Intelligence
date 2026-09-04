import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Caliber Workforce Index" };
export const revalidate = 3600;

const COMPONENTS = [
  { label: "Total nursing staff turnover", weight: "30 percent" },
  { label: "Total nurse hours per resident day", weight: "20 percent" },
  { label: "Contract and agency hours as a share of total nurse hours", weight: "20 percent" },
  { label: "RN hours per resident day", weight: "15 percent" },
  { label: "Weekend staffing consistency", weight: "15 percent" },
];

export default function WorkforceIndexPage() {
  return (
    <div className="container-chi max-w-4xl py-12">
      <p className="kicker">Caliber Workforce Index</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">
        One measure of the skilled nursing workforce, published quarterly.
      </h1>
      <p className="mt-4 text-lg text-ink-soft">
        The Caliber Workforce Index summarizes the condition of the U.S. skilled nursing workforce in
        a single number, constructed from federal payroll-verified staffing data under a methodology
        fixed in advance and published in full.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Construction</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Five components, weighted as follows. Higher values indicate a stronger workforce position.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {COMPONENTS.map((c) => (
                <tr key={c.label}>
                  <td className="px-4 py-3 text-ink">{c.label}</td>
                  <td className="px-4 py-3 text-right stat-num font-semibold text-ink-soft">{c.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          The base period is the first quarter of 2019, set to 100. The published series extends back
          to the first quarter in which Payroll-Based Journal submission was sufficiently complete,
          determined empirically during construction and stated in the methodology. The 2019 base is a
          reference point and not a target; turnover was already elevated in 2019, and the Index
          measures distance from a pre-pandemic reference rather than distance from a healthy state.
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Three sub-indices, covering staffing intensity, workforce stability, and contract
          dependence, are published alongside the headline so that readers can identify what moved it.
          State series are published from the same construction.
        </p>
      </section>

      <Section title="Publication rules">
        <p>
          Weights are reviewed no more than annually. Any change is disclosed in advance, and history
          is restated. Revisions occur only when CMS restates source data, and every restatement is
          published with the prior value. Rebasing occurs at most once per decade, with full history
          restated. The archive makes restatement verifiable, since every input vintage is retained.
        </p>
      </Section>

      <Section title="Relationship to the Operator Pulse">
        <p>
          The Index reports where the sector stands as of the last federal release. The Pulse reports
          where operators expect it to go as of the current quarter. The two are published together
          and are expected to diverge; the divergence is itself a finding.
        </p>
      </Section>

      <Section title="Use">
        <p>
          The Index is free to cite with attribution to Caliber Health Intelligence and the release
          date.
        </p>
      </Section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/research" className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">Current release</Link>
        <Link href="/methodology" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Methodology in full</Link>
        <Link href="/research" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Download the series</Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-ink-soft">{children}</div>
    </section>
  );
}
