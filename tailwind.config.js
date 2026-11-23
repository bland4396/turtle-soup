/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#090c14',
          900: '#0f1422',
          800: '#161d30',
          700: '#1e2842',
        },
        amberwarm: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
      },
      boxShadow: {
        lantern: '0 0 32px rgba(245, 158, 11, 0.14)',
      },
    },
  },
  plugins: [],
};
