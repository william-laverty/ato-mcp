import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: "#0b0b14",
        paper: "#f5f5f7",
        night: "#05030f",
        brand: {
          DEFAULT: "#5039bd",
          bright: "#7a5cff",
          soft: "#c794ff",
        },
        ember: "#ff9a3c",
      },
      letterSpacing: {
        snugger: "-0.02em",
        caps: "0.14em",
      },
      animation: {
        chipMarquee: "chipMarquee 32s linear infinite",
        shimmer: "shimmer 2.6s ease-in-out infinite",
        floatSlow: "floatSlow 7s ease-in-out infinite",
      },
      keyframes: {
        chipMarquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%, 100%": { backgroundPosition: "120% 0" },
          "50%": { backgroundPosition: "-20% 0" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
