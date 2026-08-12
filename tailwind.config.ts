import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Caliber Health Intelligence — restrained, research-grade palette.
        ink: {
          DEFAULT: "#0f172a", // slate-900
          soft: "#334155", // slate-700
          faint: "#64748b", // slate-500
        },
        paper: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc", // slate-50
          panel: "#f1f5f9", // slate-100
        },
        brand: {
          DEFAULT: "#0e7490", // cyan-700 — "Caliber" mark
          deep: "#155e75", // cyan-800
          tint: "#ecfeff", // cyan-50
        },
        // Risk severity scale (used only for rule-based flags).
        risk: {
          info: "#0891b2",
          watch: "#ca8a04",
          elevated: "#ea580c",
          high: "#dc2626",
          critical: "#991b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
