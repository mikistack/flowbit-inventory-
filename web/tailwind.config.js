/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f7ff',
          100: '#e6edff',
          200: '#c5d6ff',
          300: '#9bb8ff',
          400: '#6f90ff',
          500: '#4d6dff',
          600: '#2e49f5',
          700: '#2238cc',
          800: '#1f32a6',
          900: '#1f3084',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
