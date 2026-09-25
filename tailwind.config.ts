import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B1B16",
        parchment: "#F3EEE1",
        parchment2: "#EAE2CF",
        olive: {
          DEFAULT: "#2F3D2A",
          light: "#425939",
          dark: "#1D2818",
        },
        clay: {
          DEFAULT: "#9C3B2E",
          light: "#B85643",
          dark: "#7A2C22",
        },
        gold: {
          DEFAULT: "#BE8A2E",
          light: "#D9AC55",
        },
      },
      fontFamily: {
        display: ["var(--font-amiri)", "serif"],
        body: ["var(--font-tajawal)", "sans-serif"],
      },
      backgroundImage: {
        "tatreez": "repeating-linear-gradient(45deg, rgba(156,59,46,0.06) 0, rgba(156,59,46,0.06) 2px, transparent 2px, transparent 12px)",
      },
      boxShadow: {
        card: "0 1px 0 rgba(27,27,22,0.06), 0 8px 20px -12px rgba(27,27,22,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
