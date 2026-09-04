import type { Metadata } from "next";

export const metadata: Metadata = { title: "About, independence, and disclosure" };
export const revalidate = 3600;

export default function AboutPage() {
  return (
    <div className="container-chi max-w-4xl py-12">
      <p className="kicker">About</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">
        An independent research firm covering one sector.
      </h1>
      <div className="mt-4 space-y-3 text-lg text-ink-soft">
        <p>
          Caliber Health Intelligence is a workforce intelligence firm covering U.S. skilled nursing.
          It produces research on the workforce economics of the sector and sells that research by
          subscription to the capital that finances the sector and to the operators, advisors, and
          vendors who work within it.
        </p>
        <p>
          The scope is skilled nursing only. Skilled nursing is the most data-rich provider category
          in American healthcare. Payroll-verified staffing at facility-day granularity, quality
          ratings, cost report financials, ownership disclosures, and survey findings are all
          published federally. Caliber's assets are built on that reporting infrastructure and do not
          extend to settings where the infrastructure does not exist.
        </p>
      </div>

      <section id="independence" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-ink">Independence</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Caliber accepts no vendor-sponsored research and no advertising. Naming decisions in
          analysis are made under a written test that does not reference any commercial relationship.
          Panel participants are never named. Subscription and chain report revenue are the firm's only
          revenue lines.
        </p>
      </section>

      <Section title="Data">
        <p>
          Atlas and Index figures derive exclusively from public federal data. Research publications
          combine federal data with Caliber's proprietary quarterly operator panel. No private, client,
          or employer data is used in any publication.
        </p>
      </Section>

      <Section title="Structure">
        <p>
          Caliber Health Intelligence, LLC, is a Delaware limited liability company based in Henrico,
          Virginia.
        </p>
      </Section>

      <Section title="Giving">
        <p>
          A fixed share of net profit is committed to Remote Area Medical, which provides free clinical
          care in underserved communities. Caliber studies how healthcare organizations deploy their
          workforce; Remote Area Medical serves the communities affected when that deployment fails.
        </p>
      </Section>

      <Section title="Affiliation">
        <p>
          Caliber Health Intelligence is not affiliated with or endorsed by the Centers for Medicare &amp;
          Medicaid Services.
        </p>
      </Section>

      <section id="contact" className="mt-10 scroll-mt-24 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Contact</h2>
        <p className="mt-2 text-sm text-ink-soft">
          For subscriptions, chain reports, and panel invitations, register on the Atlas and Caliber
          will follow up. Direct inquiries may be sent to the firm at Henrico, Virginia.
        </p>
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
