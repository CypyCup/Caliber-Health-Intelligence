"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompareSelector({
  options,
  selected,
}: {
  options: { ccn: string; name: string }[];
  selected: string[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function push(next: string[]) {
    const params = new URLSearchParams();
    if (next.length) params.set("ccns", next.join(","));
    router.push(`/compare?${params.toString()}`);
  }

  function add() {
    const match = options.find((o) => o.name.toLowerCase() === value.trim().toLowerCase());
    if (match && !selected.includes(match.ccn) && selected.length < 4) {
      push([...selected, match.ccn]);
      setValue("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        list="facility-options"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        placeholder="Add a facility to compare…"
        className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <datalist id="facility-options">
        {options.map((o) => (
          <option key={o.ccn} value={o.name} />
        ))}
      </datalist>
      <button
        onClick={add}
        disabled={selected.length >= 4}
        className="rounded-lg bg-brand-deep px-3 py-2 text-sm font-semibold text-white hover:bg-brand disabled:opacity-50"
      >
        Add
      </button>
      {selected.length > 0 && (
        <button onClick={() => push([])} className="text-sm text-ink-faint hover:text-brand">
          Clear
        </button>
      )}
      <span className="text-xs text-ink-faint">Up to 4</span>
    </div>
  );
}
