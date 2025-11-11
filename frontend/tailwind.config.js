/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.css', // ✅ correct glob
    './pages/**/*.{ts,tsx,js,jsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      container: { center: true, padding: '1rem' },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Tahoma',
          'Geneva',
          'Verdana',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#ECF9FA',
          100: '#B9E9EE',
          200: '#5FC6D0',
          300: '#34AEBB',
          400: '#148898',
          500: '#117281',
          600: '#0F5F6B',
          700: '#0D4B56',
          800: '#0A3A45',
          900: '#072B33',
        },
      },
      boxShadow: {
        'brand-sm': '0 1px 2px 0 rgba(14, 165, 233, 0.05)',
        'brand': '0 4px 6px -1px rgba(14, 165, 233, 0.1), 0 2px 4px -1px rgba(14, 165, 233, 0.06)',
        'brand-md': '0 10px 15px -3px rgba(14, 165, 233, 0.1), 0 4px 6px -2px rgba(14, 165, 233, 0.05)',
        'brand-lg': '0 20px 25px -5px rgba(14, 165, 233, 0.1), 0 10px 10px -5px rgba(14, 165, 233, 0.04)',
        'brand-xl': '0 25px 50px -12px rgba(14, 165, 233, 0.25)',
      },
      borderRadius: {
        'brand': '0.5rem',
        'brand-lg': '0.75rem',
        'brand-xl': '1rem',
      },
      transitionProperty: {
        'brand': 'all',
      },
      transitionDuration: {
        'brand': '300ms',
      },
      transitionTimingFunction: {
        'brand': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
