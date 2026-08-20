import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f5f7fa",
          100: "#e2e8f0",
          200: "#cbd5e1",
          300: "#94a3b8",
          400: "#707a88",
          500: "#4b5563",
          600: "#263342",
          700: "#1a222c",
          800: "#11161d",
          900: "#0a0d11",
          950: "#030507",
        },
        civitas: {
          bg: "#030507",
          header: "#05070a",
          card: "#0a0d11",
          elevated: "#0d1117",
          input: "#080b0f",
          hover: "#11161d",
          border: "#1a222c",
          "border-subtle": "#141a22",
          "border-hover": "#263342",
          "text-primary": "#f5f7fa",
          "text-secondary": "#a7b0bd",
          "text-muted": "#707a88",
          "text-disabled": "#4b5563",
        },
        teal: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        // Sovereign Ledger Theme Extensions
        primary: {
          DEFAULT: "#4f46e5",
          dark: "#3525cd",
          container: "#4f46e5",
          "on-container": "#dad7ff",
        },
        surface: {
          DEFAULT: "#f7f9fb",
          dim: "#d8dadc",
          bright: "#f7f9fb",
          lowest: "#ffffff",
          low: "#f2f4f6",
          container: "#eceef0",
          high: "#e6e8ea",
          highest: "#e0e3e5",
        },
        "on-surface": {
          DEFAULT: "#191c1e",
          variant: "#464555",
        },
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

