import Link from "next/link";
import type { Metadata } from "next";
import { getCanonicalFigures } from "@/lib/site";
import { BENCHMARKS } from "@/lib/benchmarks";

export const metadata: Metadata = { title: "Caliber Workforce Atlas" };
export const revalidate = 3600;

export default async function AtlasPage() {
  const f = await getCanonicalFigures();

  return (
    <div className="container-chi max-w-4xl py-12">
      <p className="kicker">Caliber Workforce Atlas</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">
        Every U.S. skilled nursing facility and chain, with history.
      </h1>
      <p className="mt-4 text-lg text-ink-soft">
        The Atlas is the public surface of the Caliber archive. It presents the federal workforce,
        quality, enforcement, and ownership record for {f.facilities.label} facilities
        ({f.facilities.source}, {f.facilities.vintage}) and {f.chains.label} operating chains
        ({f.chains.source}, {f.chains.vintage}), and it shows how each metric has moved over time. It
        is free and requires registration.
      </p>

      <Section title="What the Atlas shows that the federal sources do not">
        <p>
          Care Compare presents each metric as a current value with no memory of prior values. The
          Atlas presents the same metric with quarter-over-quarter and year-over-year change, drawn
          from captured vintages. The depth of that history increases each quarter.
        </p>
        <p>
          The federal chain record identifies which facilities an operating chain controls. The Atlas
          presents that record at the chain level, with census-weighted staffing, the share of
          facilities below the CMS staffing benchmark, and the distribution of enforcement actions
          across the chain's facilities.
        </p>
        <p>
          The federal change-of-ownership file retains one transaction per facility. The Atlas
          presents the reconstructed transaction history, including prior transactions no longer
          visible in the current file, the counterparties of record, and the number of times a
          facility has changed hands since 2016.
        </p>
      </Section>

      <Section title="What the Atlas does not do">
        <p>
          The Atlas does not rank facilities or chains. It does not attribute facilities to private
          equity sponsors or real estate owners; the federal record does not support that attribution
          reliably, and Caliber does not publish inferred relationships. It does not produce composite
          scores. It does not present panel findings until the panel reaches publishable scale.
        </p>
      </Section>

      <Section title="Indicators">
        <p>
          Indicators are rule-based. Each traces to one disclosed federal metric and one published
          threshold, and each threshold is stated on the metric's page.
        </p>
        <ul className="mt-4 space-y-2">
          <Indicator label="Staffing benchmark">
            Total nurse, RN, and nurse aide hours per resident day compared with the CMS minimum
            staffing standard as finalized in 2024. This is a benchmark comparison and not a
            compliance determination; implementation of the standard has been subject to litigation
            and revised timelines.
          </Indicator>
          <Indicator label="Turnover">
            Total nursing staff turnover above the CMS national median
            ({BENCHMARKS.national_total_nurse_turnover_median_pct} percent).
          </Indicator>
          <Indicator label="Contract labor and weekend coverage">
            Compared with Caliber reference lines, disclosed as Caliber reference lines.
          </Indicator>
          <Indicator label="Enforcement">
            Any Immediate Jeopardy citation in the most recent survey cycle, and trailing three-year
            civil monetary penalties above ${BENCHMARKS.significant_cmp_usd.toLocaleString("en-US")}.
          </Indicator>
        </ul>
      </Section>

      <Section title="Coverage and vintage">
        <ul className="mt-2 space-y-2 text-sm text-ink-soft">
          <li>Facilities: {f.facilities.label} ({f.facilities.source}, {f.facilities.vintage})</li>
          <li>Chains: {f.chains.label} ({f.chains.source}, {f.chains.vintage})</li>
          <li>Staffing: Payroll-Based Journal, first quarter 2017 through first quarter 2026</li>
          <li>Ownership transactions: reconstructed from all published CMS change-of-ownership releases, effective dates from January 2016</li>
          <li>Cost report financials: Medicare cost reports, form 2540-10, presented with fiscal year end and a 12 to 18 month lag label</li>
        </ul>
      </Section>

      <Section title="Beyond the Atlas">
        <p>
          Peer cohort analysis, financial and staffing linkage, and forward commentary are published
          in Caliber's quarterly research. Chain-level profiles are available as chain reports.
        </p>
      </Section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/search" className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">Explore facilities</Link>
        <Link href="/chains" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Operators and chains</Link>
        <Link href="/compare" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Compare</Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-ink-soft [&_p]:text-sm">{children}</div>
    </section>
  );
}

function Indicator({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="card p-4">
      <strong className="text-ink">{label}.</strong> {children}
    </li>
  );
}
