/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        /* Cuerpo: Libre Franklin (autoalojada en /public/fonts por la CSP) */
        sans: ['"Libre Franklin"', '"Segoe UI"', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
        /* Títulos: Publico Banner (licenciada) con fallback Georgia */
        display: ['"Publico Banner"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      colors: {
        /* Guía oficial de Marca UniSabana — variante A */
        brand: {
          50:  '#ECF1F8', /* tarjeta / fondo suave */
          100: '#DCE5F3', /* Pantone 2707 — azul pálido */
          200: '#98B1D3', /* Pantone 292 — azul claro */
          300: '#98B1D3',
          400: '#003A86', /* Pantone 286 — azul medio */
          500: '#003A86',
          600: '#003A86',
          700: '#00205B', /* Pantone 281 — azul institucional (rector) */
          800: '#001A4A',
          900: '#00133A',
          950: '#000D29',
        },
        crema: '#FAF3DC',   /* Pantone 7499 — fondo de soporte, con moderación */
        /* Oro: acento/aviso puntual (sobre crema, texto oscuro) */
        oro: {
          50:  '#FAF3DC',
          100: '#F3E8C4',
          200: '#D9C99B',
          500: '#89764B',
          600: '#89764B',
          700: '#6B5C37',
          800: '#00205B',
        },
        /* Rojo de criticidad: único rojo permitido */
        red: {
          50:  '#FBEFF1',
          100: '#F5D9DD',
          200: '#E3A9B1',
          500: '#A6192E',
          600: '#A6192E',
          700: '#8A1527',
          800: '#6E1020',
        },
        /* Grises de marca (cuerpo #5A606C, tintas Black 90/70) */
        slate: {
          50:  '#F5F8FC',
          100: '#ECF1F8',
          200: '#DCE5F3',
          300: '#B3B3B3',
          400: '#5A606C',
          500: '#5A606C',
          600: '#4D4D4D',
          700: '#333333',
          800: '#1A1A1A',
          900: '#1A1A1A',
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
