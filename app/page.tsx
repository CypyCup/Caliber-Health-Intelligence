import Link from "next/link";
import { getCanonicalFigures } from "@/lib/site";
import { NationalAgencyChart } from "@/components/NationalAgencyChart";

export const revalidate = 3600;

export default async function HomePage() {
  const figures = await getCanonicalFigures();

  return (
    <>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-tint/60 to-white">
        <div className="container-chi py-16 sm:py-20">
          <p className="kicker">Caliber Health Intelligence</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            The longitudinal workforce record of U.S. skilled nursing.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft">
            Caliber Health Intelligence preserves every federal staffing, quality, financial, and
            ownership release as published, and joins them at the facility across time and through
            every change of ownership. The result is a record of the sector that the source agencies
            themselves do not retain.
          </p>

          {/* Three figures */}
          <dl className="mt-10 grid gap-6 sm:grid-cols-3">
            <Figure value={figures.facilities.label} unit="facilities"
              note={`${figures.facilities.source}, ${figures.facilities.vintage}`} />
            <Figure value={figures.chains.label} unit="operating chains"
              note={`${figures.chains.source}, ${figures.chains.vintage}`} />
            <Figure value="Ownership transactions" unit="reconstructed from every published federal release" />
          </dl>
        </div>
      </section>

      {/* Who it is for */}
      <section className="container-chi py-14">
        <p className="kicker">Who it is for</p>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">
          Real estate investment trusts, lenders, and private capital underwrite operators on
          workforce fundamentals that federal data reports late, overwrites without notice, and never
          connects. Operators compete for the same workers in the same markets without a peer-relative
          view. Caliber exists to close both gaps with evidence that holds under scrutiny.
        </p>
      </section>

      {/* Three assets, one record */}
      <section className="border-y border-slate-200 bg-paper-muted">
        <div className="container-chi py-14">
          <h2 className="text-2xl font-semibold text-ink">Three assets, one record</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <Asset title="The archive"
              body="CMS replaces its files each cycle. There is no changelog and no prior version. Caliber captures every vintage on the day it is published. The record can therefore state what the federal file said in any prior quarter, and how a facility's staffing, quality, and enforcement history has moved since." />
            <Asset title="The transaction record"
              body="The federal change-of-ownership file retains only the most recent transaction per facility. Prior transactions are removed as new ones are recorded, and most transactions appear in the file many months after their effective date. Caliber reconstructs the full transaction history from every published release, identifies facilities that have changed hands repeatedly, and reports the publication lag alongside the record." />
            <Asset title="The linkage"
              body="Payroll-verified staffing hours, turnover, Five-Star quality measures, enforcement actions, Medicare cost report financials, and ownership events, joined at the facility and carried forward through every transaction. Each series retains its own vintage. Lagged sources are labeled as lagged." />
          </div>
        </div>
      </section>

      {/* Evidence, drawn from the record */}
      <section className="container-chi py-14">
        <p className="kicker">Evidence, drawn from the record</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">
          Contract nurse hours as a share of all nurse hours
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          National, all facilities. Source: CMS Payroll-Based Journal, hours summed nationally. The
          same series is available for every facility and chain in the Atlas.
        </p>
        <div className="mt-6"><NationalAgencyChart /></div>
      </section>

      {/* The publications */}
      <section className="border-y border-slate-200 bg-paper-muted">
        <div className="container-chi py-14">
          <h2 className="text-2xl font-semibold text-ink">The publications</h2>
          <div className="mt-6 space-y-3">
            <Publication href="/atlas" name="Caliber Workforce Atlas" terms="Free"
              body="Facility and chain search on the federal record, with quarter-over-quarter and year-over-year movement on every metric." />
            <Publication href="/workforce-index" name="Caliber Workforce Index" terms="Free, quarterly"
              body="A single composite measure of the skilled nursing workforce, constructed from federal staffing data under a fixed and published methodology." />
            <Publication href="/operator-pulse" name="Caliber Operator Pulse" terms="Free, quarterly, forthcoming"
              body="Current-quarter conditions and forward intent from a standing panel of skilled nursing HR and operations leaders." />
            <Publication href="/research" name="Quarterly research" terms="Subscription"
              body="One annual report and three quarterly reports on the workforce economics of the sector, with the Index, cohort analysis, panel findings, and outlook." />
            <Publication href="/research#chain-reports" name="Chain reports" terms="Purchased individually"
              body="A standardized workforce and ownership profile of one operating chain." />
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="container-chi py-14">
        <p className="max-w-2xl text-lg text-ink">
          Public federal data, preserved as published. Every figure carries its source vintage.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/atlas" className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">
            Explore the Atlas
          </Link>
          <Link href="/methodology" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">
            Read the methodology
          </Link>
        </div>
      </section>
    </>
  );
}

function Figure({ value, unit, note }: { value: string; unit: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <dt className="stat-num text-2xl font-semibold text-ink">{value}</dt>
      <dd className="mt-1 text-sm text-ink-soft">{unit}</dd>
      {note && <dd className="mt-1 text-xs text-ink-faint">{note}</dd>}
    </div>
  );
}

function Asset({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function Publication({ href, name, terms, body }: { href: string; name: string; terms: string; body: string }) {
  return (
    <Link href={href} className="card block p-5 transition hover:border-brand">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{name}</p>
        <span className="pill bg-white text-ink-soft border border-slate-200">{terms}</span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </Link>
  );
}
