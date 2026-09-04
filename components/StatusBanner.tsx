import { getCanonicalFigures, statusBannerText } from "@/lib/site";

// Data-currency banner. Replaces the prior "Real CMS data" banner. Async server
// component: the vintages come from the canonical figures.
export async function StatusBanner() {
  const figures = await getCanonicalFigures();
  return (
    <div className="border-b border-slate-200 bg-paper-muted">
      <div className="container-chi py-2 text-center text-xs leading-relaxed text-ink-soft">
        {statusBannerText(figures)}
      </div>
    </div>
  );
}
