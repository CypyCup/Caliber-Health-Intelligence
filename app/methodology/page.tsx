import type { Metadata } from "next";

export const metadata: Metadata = { title: "Methodology and sources" };
export const revalidate = 3600;

const SOURCES: { source: string; publisher: string; cadence: string; lag: string; capture: string }[] = [
  { source: "Payroll-Based Journal daily nurse staffing", publisher: "CMS", cadence: "Quarterly", lag: "4 to 5 months after quarter close", capture: "Retained from 2017 Q1" },
  { source: "Nursing Home Provider Information (Care Compare)", publisher: "CMS", cadence: "Monthly", lag: "About 1 month", capture: "Vintages since December 2025" },
  { source: "Nursing Home Chain Performance Measures", publisher: "CMS", cadence: "Periodic", lag: "Varies", capture: "Vintages since capture began" },
  { source: "Health deficiencies", publisher: "CMS", cadence: "Monthly, survey-cycle driven", lag: "Varies by survey timing", capture: "Vintages since December 2025" },
  { source: "Penalties: civil monetary penalties and payment denials", publisher: "CMS", cadence: "Monthly", lag: "About 1 month", capture: "Vintages since December 2025" },
  { source: "Nursing home ownership", publisher: "CMS", cadence: "Monthly", lag: "About 1 month", capture: "Vintages since December 2025" },
  { source: "Skilled Nursing Facility Change of Ownership, and Owner Information", publisher: "CMS", cadence: "Quarterly", lag: "Several months from effective date to publication", capture: "All published vintages, March 2022 onward" },
  { source: "Medicare cost reports, SNF, form 2540-10 (HCRIS)", publisher: "CMS", cadence: "Annual", lag: "12 to 18 months", capture: "Retained by fiscal year" },
];

const LIMITATIONS = [
  "The Atlas is a research surface. It is not investment, legal, or clinical advice.",
  "Staffing metrics in the Atlas are not case-mix adjusted. The CMS staffing star rating is.",
  "The federal chain record is the sole basis for chain attribution. Facilities absent from that record are presented as independent, which may be incorrect.",
  "Cost report financials can be affected by related-party rent and management fee structures and by unaudited submission.",
  "Change-of-ownership counts for recent quarters are incomplete because of federal publication lag.",
  "Caliber Health Intelligence is an independent research firm and is not affiliated with CMS.",
];

export default function MethodologyPage() {
  return (
    <div className="container-chi max-w-4xl py-12">
      <p className="kicker">Methodology and sources</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">How the record is built.</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Caliber's research rests on three assets: a point-in-time archive of federal releases, a
        reconstructed transaction record, and a facility-level linkage across staffing, quality,
        financial, and ownership sources. This page describes each, states the quality standard that
        governs every published figure, and lists every source with its cadence and typical lag.
      </p>

      <Section title="The point-in-time archive">
        <p>
          CMS publishes Provider Information, Five-Star ratings, Payroll-Based Journal staffing,
          enforcement, ownership, and change-of-ownership data as overwriting files. Each release
          replaces the prior release. Revisions are not announced and prior versions are not retained.
          A file not captured in the period it is published cannot be obtained from CMS afterward.
        </p>
        <p>
          Caliber captures every release as delivered and stores it with a capture timestamp, a
          normalized version, and a difference report against the prior release. Provider Information
          and Five-Star vintages have been captured since December 2025. Change-of-ownership vintages
          have been captured for every release CMS has published, beginning March 2022. Payroll-Based
          Journal quarterly files are retained from the first quarter of 2017.
        </p>
      </Section>

      <Section title="The transaction record">
        <p>
          The CMS Skilled Nursing Facility Change of Ownership file records one transaction per
          facility enrollment, the most recent. When a facility changes hands again, the prior
          transaction is removed from the file. The companion owner information file records the
          buyer's organizational owners, roles, and ownership percentages as of the release date.
        </p>
        <p>
          Caliber reconstructs the transaction history by retaining every published vintage and
          identifying each transaction by facility, effective date, and buyer and seller enrollment
          identifiers. The reconstruction recovers a materially larger transaction count than the
          current federal file presents, and identifies facilities with two or more transactions since
          2016. Each transaction carries the vintage in which it first appeared, which allows
          publication lag to be measured directly. Publication lag is measured in months, not weeks,
          and a substantial share of transactions appear only after more than six months. Counts for
          the most recent quarters are therefore incomplete in any single release, and Caliber labels
          them as such. Reconstructed counts and lag statistics are published in Caliber's research.
        </p>
        <p>
          Two limitations are disclosed. The buyer of record is the licensed enrollment, which in some
          states is a governmental entity holding the license under a Medicaid supplemental payment
          arrangement while a private operator manages the facility; Caliber flags these transactions
          rather than treating them as operator changes. Buyer and seller names are legal entity names
          and are not resolved to parent organizations.
        </p>
      </Section>

      <Section title="The linkage">
        <p>
          Each source is joined at the CMS certification number. Staffing, quality, and enforcement
          series are quarterly or monthly and current to the latest federal release. Cost report
          financials are annual, keyed to the provider's fiscal year, and lag by 12 to 18 months.
          Caliber aligns cost report fiscal years to staffing quarters under a stated rule, presents
          each series with its own vintage, and does not blend lagged financials into statements about
          current conditions.
        </p>
      </Section>

      <Section title="The Caliber Workforce Index">
        <p>
          The Index is described on its own page. Its inputs are federal staffing data only. Its
          construction, weights, base period, and revision history are published there and are fixed
          in advance of each release.
        </p>
      </Section>

      <Section title="The operator panel">
        <p>
          The Caliber Operator Pulse is primary data collected by Caliber from a standing panel of
          skilled nursing HR and operations leaders. It is described on its own page. No panel figure
          is published until the panel reaches the disclosed minimum size. The Atlas is the panel's
          recruitment surface and does not present panel data.
        </p>
      </Section>

      <Section title="The quality standard">
        <p>
          Every published figure carries the vintage of its source. Statements about current
          conditions are made only from sources that are current. Structural analysis drawn from
          lagged sources is labeled with its lag. Chain-level figures are published only where the
          underlying facility attribution comes from the federal chain record. Caliber does not
          publish inferred ownership relationships and does not name private operators in analysis.
        </p>
      </Section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Sources</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Publisher</th>
                <th className="px-4 py-3 font-medium">Cadence</th>
                <th className="px-4 py-3 font-medium">Typical lag</th>
                <th className="px-4 py-3 font-medium">Caliber capture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SOURCES.map((s) => (
                <tr key={s.source}>
                  <td className="px-4 py-3 font-medium text-ink">{s.source}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.publisher}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.cadence}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.lag}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.capture}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          {LIMITATIONS.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
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
