"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({
  autoFocus = false,
  placeholder = "Search facilities…",
  defaultValue = "",
}: {
  autoFocus?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <div className="relative flex-1">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      <button type="submit" className="rounded-lg bg-brand-deep px-5 text-sm font-semibold text-white hover:bg-brand">
        Search
      </button>
    </form>
  );
}
