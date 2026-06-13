/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        electric: "#2563EB",
        "electric-light": "#3B82F6",
        bg: "#F0F2F5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // "Electric Embossed" — soft outer lift + cool inner glow on white cards
        embossed:
          "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(37,99,235,0.08), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 6px rgba(37,99,235,0.04)",
        "embossed-lg":
          "0 2px 4px rgba(15,23,42,0.05), 0 16px 40px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
        glow: "0 0 0 4px rgba(37,99,235,0.15), 0 0 24px rgba(37,99,235,0.35)",
        "glow-lg": "0 0 0 8px rgba(37,99,235,0.12), 0 0 40px rgba(37,99,235,0.45)",
      },
      keyframes: {
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0.45)" },
          "50%": { boxShadow: "0 0 0 16px rgba(37,99,235,0)" },
        },
        scanline: {
          "0%": { top: "8%" },
          "50%": { top: "88%" },
          "100%": { top: "8%" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2s ease-in-out infinite",
        scanline: "scanline 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
