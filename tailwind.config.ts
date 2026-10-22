import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Design tokens live here; without this their utilities are never emitted.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          // Matchnight palette: ground, surface, raised, line, strong line (navy ink).
          950: "#0b1322",
          900: "#131e33",
          800: "#1b2842",
          700: "#233352",
          600: "#2e3f60",
        },
        "theme-primary": "rgb(var(--theme-primary-rgb) / <alpha-value>)",
        "theme-secondary": "rgb(var(--theme-secondary-rgb) / <alpha-value>)",
        "theme-tertiary": "rgb(var(--theme-tertiary-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        rating: "rgb(var(--rating-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        accent: {
          /** @deprecated Use theme-primary — kept for gradual migration */
          green: "rgb(var(--theme-primary-rgb) / <alpha-value>)",
          "green-2": "rgb(var(--theme-secondary-rgb) / <alpha-value>)",
          gold: "#fbbf24",
          red: "#ef4444",
        },
        "mode-current": "rgb(var(--mode-current-rgb) / <alpha-value>)",
        "mode-era": "rgb(var(--mode-era-rgb) / <alpha-value>)",
      },
      borderRadius: {
        // Matchnight: squared kit-tag corners everywhere.
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
        lg: "4px",
        xl: "6px",
        "2xl": "6px",
        "3xl": "8px",
        card: "var(--fl-radius-card)",
        tile: "var(--fl-radius-tile)",
        control: "var(--fl-radius-control)",
      },
      fontFamily: {
        cond: ["var(--font-cond)", "Arial Narrow", "sans-serif"],
        /* Anton via --font-display; Arial Black only as paint fallback. */
        display: ["var(--font-display)", "Arial Black", "Impact", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        /* Alias — prefer font-display in new code. */
        pitch: ["var(--font-display)", "Arial Black", "Impact", "sans-serif"],
      },
      animation: {
        "card-in": "cardIn 0.35s ease-out forwards",
        "fade-up": "fadeUp 0.4s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        cardIn: {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 transparent" },
          "50%": { boxShadow: "0 0 20px 2px var(--theme-glow-soft)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
