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
        <span aria-hidden className="font-semibold">Mixed data</span>
        <span className="hidden sm:inline text-amber-800">
          — <strong>Operators &amp; chains are real CMS data</strong> (Jun 2026); facility-level detail
          is an illustrative Texas sample pending the facility ETL. See{" "}
          <a href="/methodology" className="underline font-medium">Methodology</a>.
        </span>
        <span className="sm:hidden">— chains: real CMS; facilities: demo sample.</span>
      </div>
    </div>
  );
}
