import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Research" };
export const revalidate = 3600;

export default function ResearchPage() {
  return (
    <div className="container-chi max-w-4xl py-12">
      <p className="kicker">Research</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">
        Workforce economics research on U.S. skilled nursing.
      </h1>
      <p className="mt-4 text-lg text-ink-soft">
        Caliber publishes one integrated body of research each year: an annual report and three
        quarterly reports, built on the archive, the transaction record, the Workforce Index, and the
        operator panel. It is written for the investors, lenders, and acquirers who underwrite the
        sector, and for the operators who compete within it.
      </p>

      <Section title="The annual report">
        <p>
          Published in the first quarter, 40 to 50 pages. Covers the closed prior year: the annual
          Index level and its components, cohort analysis by state, ownership category, and chain
          size, the reconstructed transaction record and what followed those transactions, cost report
          financials joined to staffing, and the year-ahead outlook.
        </p>
      </Section>

      <Section title="The quarterly reports">
        <p>
          Published in the second, third, and fourth quarters, 15 to 18 pages. Each carries the Index
          update, cohort movement, panel findings, one spotlight analysis, and watch items for the
          following quarter.
        </p>
      </Section>

      <Section title="What the research does not contain">
        <p>
          No leaderboard. No ranked table of operators. No vendor-sponsored content. Private operators
          are not named. Publicly traded operators and operators whose facts appear in their own
          filings may be named where the claim derives from federal data Caliber can cite directly and
          where naming serves the analysis.
        </p>
      </Section>

      <Section title="Subscription">
        <p>
          Standard subscription, for organizations with exposure to fewer than approximately 50
          skilled nursing facilities: $18,000 to $30,000 annually, available as an annual payment or as
          an annual commitment billed monthly. Includes all reports, briefing access, and the
          accumulating back catalog.
        </p>
        <p>
          Enterprise subscription, for organizations that own, lend against, or hold equity in
          approximately 50 or more facilities: priced by exposure band. Includes portfolio-level
          monitoring against the archive.
        </p>
      </Section>

      <section id="chain-reports" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-ink">Chain reports</h2>
        <div className="mt-3 space-y-3 text-sm text-ink-soft">
          <p>
            A standardized workforce and ownership profile of a single operating chain, generated from
            the archive and the federal chain record. Priced by chain size from $1,000 to $5,000. Sold
            individually to the chain, its landlord, its lender, a prospective acquirer, or a vendor.
          </p>
        </div>
      </section>

      <Section title="Custom analyses">
        <p>
          A limited number of bounded, fixed-fee analyses each year for subscribers, on questions the
          standing research does not address. Caliber does not accept vendor-sponsored research,
          litigation support, or expert witness engagements, and does not bill by the hour.
        </p>
      </Section>

      <Section title="First publication">
        <p>
          The first annual report publishes in 2027. Organizations may register interest now for
          pre-publication briefing.
        </p>
      </Section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/about#contact" className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">Register interest</Link>
        <Link href="/about#contact" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Request a chain report</Link>
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
