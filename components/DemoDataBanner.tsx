import nationalMeta from "@/data/seed/national/meta.json";
import chainMeta from "@/data/seed/chains_cms/meta.json";

/**
 * Provenance banner. The Atlas now runs on real CMS data end to end — facilities
 * from Provider Information and chains from the Chain Performance Measures. The
 * one thing still in progress is PE-sponsor / REIT-landlord resolution (not in
 * any CMS file). Honest labeling is CHI's discipline, so we say exactly that.
 */
export function DemoDataBanner() {
  const nat = nationalMeta as { facilities: number; latest_period: string };
  const chains = chainMeta as { chains: number; latest_period: string };
  return (
    <div className="bg-emerald-50 text-emerald-900 border-b border-emerald-200">
      <div className="container-chi flex items-center gap-2 py-1.5 text-xs">
        <span aria-hidden className="font-semibold">Real CMS data</span>
        <span className="hidden sm:inline text-emerald-800">
          — {nat.facilities.toLocaleString()} facilities (Provider Information, {nat.latest_period}) ·{" "}
          {chains.chains.toLocaleString()} chains (Chain Performance, {chains.latest_period}). PE-sponsor /
          REIT resolution is CHI&apos;s value-add and in progress. See{" "}
          <a href="/methodology" className="underline font-medium">Methodology</a>.
        </span>
        <span className="sm:hidden">— {nat.facilities.toLocaleString()} facilities · {chains.chains} chains, live CMS data.</span>
      </div>
    </div>
  );
}
