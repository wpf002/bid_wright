import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Warm slate + amber — construction without caricature
        slate: {
          950: "#0b0f14",
          900: "#111827",
          850: "#161d29",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
          50: "#f8fafc",
        },
        amber: {
          500: "#f59e0b",
          600: "#d97706",
          400: "#fbbf24",
        },
        brand: {
          DEFAULT: "#d97706",
          fg: "#0b0f14",
          bg: "#fef3c7",
        },
      },
      fontFamily: {
        // next/font injects these CSS variables; the literals stay as fallbacks.
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)",
        card: "0 4px 20px -4px rgb(0 0 0 / 0.06), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
