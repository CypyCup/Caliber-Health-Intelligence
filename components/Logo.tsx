export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" className="fill-brand-deep" />
        {/* a caliper / measurement mark */}
        <path
          d="M9 8v13.5M23 8v13.5M9 21.5h14M13 8h6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="16" cy="25.5" r="1.6" fill="white" />
      </svg>
      <span className="font-semibold tracking-tight text-ink">
        Caliber<span className="text-brand"> Workforce Atlas</span>
      </span>
    </span>
  );
}
