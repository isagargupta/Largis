import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", md: "2rem", xl: "3.25rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#15171c",
          muted: "#4c4f5a",
          subtle: "#7d7f88",
        },
        line: "#e5e0d6",
        paper: {
          DEFAULT: "#fbfaf6",
          soft: "#f3efe6",
        },
        gold: {
          50: "#faf6ec",
          100: "#f3e9d2",
          200: "#e7d4aa",
          300: "#d9bd84",
          400: "#c9a664",
          500: "#b48e4d",
          600: "#96733b",
          700: "#77592f",
        },
        navy: {
          DEFAULT: "#0a1628",
          800: "#101f38",
          700: "#182a48",
        },
        night: {
          DEFAULT: "#0b0b0d",
          800: "#141417",
          700: "#1d1d21",
        },
        brand: {
          50: "#f0f2f8",
          100: "#e0e5f2",
          200: "#c2cbe5",
          300: "#9ba9d4",
          400: "#7083bf",
          500: "#4b5ea6",
          600: "#2f438e",
          700: "#253676",
          800: "#1d2a5d",
          900: "#161f46",
        },
      },
      backgroundImage: {
        "grid-navy":
          "linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
      },
      keyframes: {
        "menu-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "menu-in": "menu-in 0.18s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
