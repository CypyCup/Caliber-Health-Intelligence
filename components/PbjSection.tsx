import type { PbjPoint } from "@/lib/data/pbj";
import type { ResolvedMetric } from "@/lib/types";
import { StatTile } from "@/components/Badges";
import { TrendChart } from "@/components/TrendChart";
import { VintageChip } from "@/components/VintageChip";

function fmtHprd(v: number | null): string {
  return v == null ? "—" : v.toFixed(2);
}
function fmtPct(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function qtrLabel(q: string): string {
  return q.replace("Q", " Q");
}

/** Facility PBJ staffing & agency section (quarterly, unadjusted). */
export function PbjSection({
  series,
  agency,
  hprd,
  flagged,
}: {
  series: PbjPoint[];
  agency?: ResolvedMetric;
  hprd?: ResolvedMetric;
  flagged: Record<string, string>;
}) {
  if (series.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Staffing &amp; agency (PBJ)</h2>
        <p className="mt-2 text-sm text-ink-soft">No CMS Payroll-Based Journal staffing data for this facility.</p>
      </section>
    );
  }
  const latest = series[series.length - 1];
  const emp = latest.employee_hours;
  const ctr = latest.contract_hours;
  const empShare = emp != null && ctr != null && emp + ctr > 0 ? (emp / (emp + ctr)) * 100 : null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-ink">Staffing &amp; agency (PBJ)</h2>
        <span className="pill bg-slate-100 text-ink-faint">Payroll-Based Journal · quarterly · unadjusted</span>
        <VintageChip vintage={`${latest.quarter.slice(0, 4)}-${["03", "06", "09", "12"][Number(latest.quarter.slice(-1)) - 1]}-01`} period={qtrLabel(latest.quarter)} />
      </div>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        Payroll-verified hours, split into facility employees vs. contract (agency + individual
        contractors). Not case-mix adjusted. Read staffing levels alongside acuity.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total nurse staffing" value={fmtHprd(latest.total_nurse_hprd)} sub={`HPRD · ${qtrLabel(latest.quarter)}`} />
        <StatTile
          label="Agency reliance"
          value={fmtPct(latest.total_nurse_agency_pct)}
          sub="contract ÷ total nurse hours"
          tone={latest.total_nurse_agency_pct != null && latest.total_nurse_agency_pct > 20 ? "warn" : "default"}
        />
        <StatTile label="RN staffing" value={fmtHprd(latest.rn_hprd)} sub="HPRD" />
        <StatTile
          label="Reporting completeness"
          value={latest.completeness != null ? `${latest.completeness.toFixed(0)}%` : "—"}
          tone={latest.completeness != null && latest.completeness < 100 ? "warn" : "default"}
          sub={latest.completeness != null && latest.completeness < 100 ? "partial-quarter submission" : "full quarter"}
        />
      </div>

      {/* Employee vs contract split */}
      {empShare != null && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink-soft">Nurse hours: employee vs. contract</span>
            <span className="text-xs text-ink-faint">{qtrLabel(latest.quarter)}</span>
          </div>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand" style={{ width: `${empShare}%` }} />
            <div className="h-full bg-risk-elevated" style={{ width: `${100 - empShare}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
            <span><span className="inline-block h-2 w-2 rounded-full bg-brand align-middle" /> Employee {empShare.toFixed(0)}%</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-risk-elevated align-middle" /> Contract {(100 - empShare).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Trends */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {agency && agency.history.length >= 2 && (
          <div className="card p-4">
            <p className="font-medium text-ink">Agency reliance</p>
            <p className="text-xs text-ink-faint">% of nurse hours · {agency.history.length} quarters</p>
            <div className="mt-2"><TrendChart metric={agency} /></div>
          </div>
        )}
        {hprd && hprd.history.length >= 2 && (
          <div className="card p-4">
            <p className="font-medium text-ink">Total nurse staffing</p>
            <p className="text-xs text-ink-faint">HPRD · {hprd.history.length} quarters</p>
            <div className="mt-2"><TrendChart metric={hprd} /></div>
          </div>
        )}
      </div>

      {series.some((p) => flagged[p.quarter]) && (
        <p className="mt-3 text-xs text-ink-faint">
          Flagged quarters in the series:{" "}
          {Object.entries(flagged)
            .filter(([q]) => series.some((p) => p.quarter === q))
            .map(([q, why]) => `${qtrLabel(q)}: ${why}`)
            .join("  ·  ")}
        </p>
      )}
    </section>
  );
}
