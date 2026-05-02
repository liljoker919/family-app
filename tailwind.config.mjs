/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Primary palette — centered on Hey Blue (#1D4ED8)
        'royal-blue': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8', // Hey Blue — primary action colour
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e3270',
          950: '#172554',
        },
        // Brand accent colours
        'indigo-pop': '#6366f1',
        'mint-fresh': '#34d399',
        'coral-punch': '#fb7185',
        // Neutral tokens
        'ink': '#1f2937',
        'soft-gray': '#f3f4f6',
      },
      fontFamily: {
        // Inter for body / UI text
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Poppins for friendly headlines
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Soft-corner standard: lg=12px, xl=16px, 2xl=24px
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
