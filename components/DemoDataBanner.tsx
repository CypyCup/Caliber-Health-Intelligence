import seedMeta from "@/data/seed/seed_metadata.json";

/**
 * A persistent, honest banner stating that the running dataset is the synthetic
 * demo seed. This exists BECAUSE methodological honesty is CHI's moat: the app
 * never lets a viewer mistake illustrative data for real CMS data.
 * It renders only when the seed is flagged synthetic.
 */
export function DemoDataBanner() {
  const meta = seedMeta as { synthetic?: boolean };
  if (!meta.synthetic) return null;
  return (
    <div className="bg-amber-50 text-amber-900 border-b border-amber-200">
      <div className="container-chi flex items-center gap-2 py-1.5 text-xs">
        <span aria-hidden className="font-semibold">Demo data</span>
        <span className="hidden sm:inline text-amber-800">
          — illustrative Texas sample (fictional facilities). Not real CMS data. Load real data via
          the ETL pipeline. See{" "}
          <a href="/methodology" className="underline font-medium">Methodology</a>.
        </span>
        <span className="sm:hidden">— illustrative sample, not real CMS data.</span>
      </div>
    </div>
  );
}
