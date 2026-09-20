/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgBase: "#0a0d12",
        surface: "#111620",
        surfaceBorder: "#1e293b",
        routeSafe: "#10b981",
        routeUnsafe: "#ef4444",
        routeTight: "#f59e0b",
        floodWave: "#3b82f6",
        floodFill: "#1e3a8a",
      },
    },
  },
  plugins: [],
};
