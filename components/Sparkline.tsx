import type { TrendTone } from "@/lib/format";

const TONE_STROKE: Record<TrendTone, string> = {
  good: "#16a34a",
  bad: "#dc2626",
  neutral: "#0e7490",
  flat: "#64748b",
};

/** Tiny inline-SVG sparkline. No chart library — always builds, fully themeable. */
export function Sparkline({
  values,
  tone = "neutral",
  width = 96,
  height = 28,
}: {
  values: (number | null)[];
  tone?: TrendTone;
  width?: number;
  height?: number;
}) {
  const pts = values.filter((v): v is number => v != null);
  if (pts.length < 2) {
    return <div style={{ width, height }} className="rounded bg-slate-50" aria-hidden />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (values.length - 1);

  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    d += `${d ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const lastVal = pts[pts.length - 1];
  const lastX = pad + (values.length - 1) * stepX;
  const lastY = pad + (height - pad * 2) * (1 - (lastVal - min) / range);
  const stroke = TONE_STROKE[tone];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2.2" fill={stroke} />
    </svg>
  );
}
