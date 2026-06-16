/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        electric: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },
        bg: '#F0F2F5',
      },
      fontFamily: {
        display: ['Outfit', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        embossed: 'inset 1px 1px 0px 0px rgba(255, 255, 255, 0.5), 2px 2px 4px 0px rgba(0, 0, 0, 0.04), -1px -1px 2px 0px rgba(0, 0, 0, 0.02)',
        'embossed-lg': 'inset 1px 1px 0px 0px rgba(255, 255, 255, 0.6), 4px 4px 12px 0px rgba(0, 0, 0, 0.06), -2px -2px 4px 0px rgba(0, 0, 0, 0.02)',
        glow: '0 0 12px 0px rgba(37, 99, 235, 0.15)',
        'glow-lg': '0 0 24px 0px rgba(37, 99, 235, 0.25)',
      }
    },
  },
  plugins: [],
}
