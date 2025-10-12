/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.css",
    "./pages/**/*.{ts,tsx,js,jsx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      fontFamily: {
        sans: [
          'ui-sans-serif','system-ui','Segoe UI','Tahoma','Geneva','Verdana','sans-serif'
        ],
      },
    },
  },
  plugins: [],
};
