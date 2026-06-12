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
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Single accent. Neutrals use Tailwind's built-in zinc scale.
        brand: {
          DEFAULT: "#fa520f",
          text: "#c2410c",
          200: "#ffd9c4",
          50: "#fff3ec",
        },
      },
      letterSpacing: {
        tight1: "-0.02em",
        tight2: "-0.022em",
      },
    },
  },
  plugins: [],
};

export default config;
