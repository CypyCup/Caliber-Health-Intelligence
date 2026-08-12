import type { ResolvedMetric } from "@/lib/types";
import { trendTone } from "@/lib/format";

const TONE_STROKE = {
  good: "#16a34a",
  bad: "#dc2626",
  neutral: "#0e7490",
  flat: "#64748b",
} as const;

/** A labeled line chart for a single metric's full history. Inline SVG. */
export function TrendChart({ metric, height = 150 }: { metric: ResolvedMetric; height?: number }) {
  const history = metric.history.filter((h) => h.value != null) as {
    period: string;
    value: number;
  }[];
  if (history.length < 2) {
    return <p className="text-sm text-ink-faint">Not enough history to chart a trend.</p>;
  }

  const width = 560;
  const padL = 40, padR = 12, padT = 12, padB = 26;
  const values = history.map((h) => h.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const stepX = innerW / (history.length - 1);

  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + innerH * (1 - (v - min) / range);

  const line = history.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h.value).toFixed(1)}`).join("");
  const area = `${line}L${x(history.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)}L${padL},${(padT + innerH).toFixed(1)}Z`;

  const tone = trendTone(metric.yoy_delta, metric.definition);
  const stroke = TONE_STROKE[tone];
  const gridVals = [min, min + range / 2, max];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
      aria-label={`${metric.definition.label} trend`}>
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={padL} x2={width - padR} y1={y(gv)} y2={y(gv)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={padL - 6} y={y(gv) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {gv.toFixed(metric.definition.precision)}
          </text>
        </g>
      ))}
      <path d={area} fill={stroke} opacity="0.07" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {history.map((h, i) => (
        <g key={h.period}>
          <circle cx={x(i)} cy={y(h.value)} r="2.4" fill={stroke} />
          {(i === 0 || i === history.length - 1 || i % 2 === 0) && (
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
              {h.period.replace("Q", " Q")}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
