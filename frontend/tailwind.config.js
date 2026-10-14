/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        /* Paleta oficial Universidad de La Sabana */
        brand: {
          50:  '#eef1f8',
          100: '#d5ddf0',
          200: '#adbae1',
          300: '#7d92cc',
          400: '#546eb7',
          500: '#3653a0',
          600: '#1e3a88',
          700: '#11225a', /* color institucional exacto del logo */
          800: '#0d1a47',
          900: '#081133',
          950: '#04091f',
        },
        sabana: {
          navy:  '#11225a',
          blue:  '#1e3a88',
          light: '#eef1f8',
          gold:  '#c8972a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
