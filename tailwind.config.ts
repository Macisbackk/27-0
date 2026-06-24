import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#0a0f0d",
          900: "#0f1814",
          800: "#162420",
          700: "#1e3029",
          600: "#2a4539",
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
      fontFamily: {
        display: ["Arial Black", "Impact", "var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        pitch: ["var(--font-pitch)", "Anton", "Arial Black", "Impact", "sans-serif"],
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
