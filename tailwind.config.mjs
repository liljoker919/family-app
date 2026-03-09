/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'royal-blue': {
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#b9d9ff',
          300: '#7bb9ff',
          400: '#3597ff',
          500: '#0a76f1',
          600: '#0059ce',
          700: '#0046a7',
          800: '#053c89',
          900: '#0a3472',
          950: '#07214b',
        },
      },
    },
  },
  plugins: [],
}
