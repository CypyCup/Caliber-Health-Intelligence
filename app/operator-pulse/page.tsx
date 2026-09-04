import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Caliber Operator Pulse" };
export const revalidate = 3600;

export default function OperatorPulsePage() {
  return (
    <div className="container-chi max-w-4xl py-12">
      <p className="kicker">Caliber Operator Pulse</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">
        Current-quarter conditions and forward intent, from the operators themselves.
      </h1>
      <p className="mt-4 text-lg text-ink-soft">
        Federal data reports what has already happened, with a lag measured in months. The Caliber
        Operator Pulse reports what skilled nursing HR and operations leaders are seeing now and what
        they expect over the next two quarters. It is a short quarterly release from a standing panel,
        published free ahead of each Caliber quarterly report.
      </p>

      <Section title="The instrument">
        <p>Eight fixed questions, split evenly between current conditions and forward expectations.</p>
        <p>
          Current conditions: starting wages and sign-on bonuses by nursing role; contract and agency
          share of nursing hours; open nursing positions as a share of budgeted positions; beds held
          offline for staffing reasons.
        </p>
        <p>
          Forward expectations, next two quarters: wage movement; budgeted headcount direction; agency
          utilization direction; beds expected in service.
        </p>
        <p>
          A single optional question rotates with each quarter's spotlight topic. The eight fixed
          questions do not change, so that each quarter's findings are comparable with every prior
          quarter.
        </p>
      </Section>

      <Section title="The panel">
        <p>
          Participants are corporate HR and operations leaders at skilled nursing operators, recruited
          through the Atlas and through direct invitation. The panel is longitudinal: the same
          organizations answer the same questions each quarter. Responses are confidential. No
          participant is named under any circumstance, and no figure is published for any cut of the
          data with fewer than the disclosed minimum number of responses.
        </p>
        <p>
          Participants receive a benchmark cut of each quarter's results, showing their own responses
          against the panel, at no cost.
        </p>
      </Section>

      <Section title="Publication threshold">
        <p>
          Caliber publishes no panel finding until the panel reaches 75 responding organizations.
          Until then, the Pulse is in recruitment.
        </p>
      </Section>

      <Section title="Participate">
        <p>
          Registered Atlas users at qualifying organizations are invited as the panel opens.
          Organizations may also request an invitation directly.
        </p>
      </Section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/search" className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">Register on the Atlas</Link>
        <Link href="/about#contact" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Request an invitation</Link>
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
