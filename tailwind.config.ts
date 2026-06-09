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
        accent: {
          green: "#22c55e",
          gold: "#fbbf24",
          red: "#ef4444",
        },
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" },
          "50%": { boxShadow: "0 0 20px 2px rgba(34, 197, 94, 0.15)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
