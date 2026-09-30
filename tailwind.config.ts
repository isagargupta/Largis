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
          DEFAULT: "#0d1321",
          muted: "#465063",
          subtle: "#737d90",
        },
        line: "#e2e6ee",
        paper: {
          DEFAULT: "#ffffff",
          soft: "#f4f6fa",
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
          50: "#eef1ff",
          100: "#dfe5ff",
          200: "#c3cefe",
          300: "#9aacfc",
          400: "#6d83f7",
          500: "#4a61ee",
          600: "#3346dc",
          700: "#2937b5",
          800: "#25318f",
          900: "#232d71",
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
