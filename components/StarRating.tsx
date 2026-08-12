export function StarRating({
  value,
  size = 16,
}: {
  value: number | null;
  size?: number;
}) {
  if (value == null) return <span className="text-ink-faint">—</span>;
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
          <path
            d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.95 2.6.94-5.5-4-3.9 5.53-.8z"
            className={i <= full ? "fill-amber-400" : "fill-slate-200"}
          />
        </svg>
      ))}
    </span>
  );
}
