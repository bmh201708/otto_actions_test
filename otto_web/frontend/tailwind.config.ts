import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-bright": "var(--surface-bright)",
        "surface-container": "var(--surface-container)",
        "surface-container-low": "var(--surface-container-low)",
        "surface-container-lowest": "var(--surface-container-lowest)",
        "surface-container-high": "var(--surface-container-high)",
        "surface-container-highest": "var(--surface-container-highest)",
        "surface-variant": "var(--surface-variant)",
        "surface-tint": "var(--surface-tint)",
        primary: "var(--primary)",
        "primary-container": "var(--primary-container)",
        outline: "var(--outline)",
        "outline-variant": "var(--outline-variant)",
        "on-surface": "var(--on-surface)",
        "on-surface-variant": "var(--on-surface-variant)",
        "on-primary": "var(--on-primary)",
        secondary: "var(--secondary)",
        tertiary: "var(--tertiary)",
        error: "var(--error)"
      },
      fontFamily: {
        display: ["var(--font-serif)", "serif"],
        headline: ["var(--font-serif)", "serif"],
        body: ["var(--font-sans)", "sans-serif"],
        label: ["var(--font-sans)", "sans-serif"]
      },
      boxShadow: {
        talisman: "0 28px 60px -24px rgba(27, 29, 14, 0.14)",
        ambient: "0 20px 40px -15px rgba(27, 29, 14, 0.1)",
        glow: "0 8px 26px rgba(183, 16, 42, 0.28)"
      },
      borderRadius: {
        organic: "2rem"
      },
      backgroundImage: {
        "cinnabar-glow":
          "radial-gradient(circle at top left, rgba(219,49,63,0.15), transparent 45%)",
        "silk-grid":
          "radial-gradient(circle at center, rgba(27,29,14,0.12) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
