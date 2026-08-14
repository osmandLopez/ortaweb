/** @type {import('tailwindcss').Config} */

/*
 * Orta Novedades — sistema de diseño "El Mostrador"
 *
 * Cada color tiene un trabajo. No se usan de forma intercambiable:
 *   cielo   -> acción: botones primarios, enlaces, foco
 *   oro     -> temporada: rebajas y campañas de calendario
 *   mistico -> apartado: reservas, abonos, saldo pendiente
 *   tinta   -> texto, encabezados, footer
 *   papel   -> superficies
 */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        papel: {
          DEFAULT: '#FFFFFF',
          mostrador: '#F7F7F8', // fondo de sección, un tono por debajo de la tarjeta
        },
        cielo: {
          50: '#E6F7FD',
          100: '#C2ECFA',
          200: '#8CDCF6',
          300: '#4FC8F0',
          400: '#1AB2E8',
          500: '#00A3E0', // primario de marca
          600: '#0086BA',
          700: '#026A93',
          800: '#085674',
          900: '#0C475F',
          DEFAULT: '#00A3E0',
        },
        oro: {
          50: '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#EAB308', // secundario: temporada
          600: '#CA8A04',
          700: '#A16207',
          800: '#854D0E',
          900: '#713F12',
          DEFAULT: '#EAB308',
        },
        mistico: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7', // acento: apartados
          600: '#9333EA',
          700: '#7E22CE',
          800: '#6B21A8',
          900: '#581C87',
          DEFAULT: '#A855F7',
        },
        tinta: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B', // texto principal / footer
          950: '#09090B',
          DEFAULT: '#18181B',
        },
      },

      fontFamily: {
        // Rótulo: Archivo variable, se usa en eje ancho expandido (ver global.css)
        display: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
        // Cuerpo: humanista, legible en móvil
        sans: ['Karla', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Cifras de nota: folios, abonos, contadores, SKU
        nota: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        // Escala de rótulo — saltos amplios a propósito, sin pasos intermedios tibios
        'rotulo-sm': ['clamp(1.75rem, 4vw, 2.5rem)', { lineHeight: '0.95', letterSpacing: '-0.02em' }],
        'rotulo': ['clamp(2.5rem, 7vw, 4.5rem)', { lineHeight: '0.9', letterSpacing: '-0.03em' }],
        'rotulo-xl': ['clamp(3.25rem, 11vw, 7.5rem)', { lineHeight: '0.86', letterSpacing: '-0.04em' }],
        // Etiquetas de mostrador
        etiqueta: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em' }],
      },

      borderRadius: {
        nota: '10px',
      },

      boxShadow: {
        // Sombras planas, de papel sobre mostrador — sin blur difuso genérico
        mostrador: '0 1px 0 0 #E4E4E7, 0 2px 0 0 rgba(24,24,27,0.04)',
        alzada: '0 10px 24px -12px rgba(24,24,27,0.28)',
        cielo: '0 0 0 3px #C2ECFA',
      },

      backgroundImage: {
        // Trama de troquel para separadores y bordes de nota
        troquel: 'repeating-linear-gradient(90deg, #D4D4D8 0 6px, transparent 6px 12px)',
        'troquel-v': 'repeating-linear-gradient(180deg, #D4D4D8 0 6px, transparent 6px 12px)',
      },

      keyframes: {
        cinta: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        sello: {
          '0%': { opacity: '0', transform: 'rotate(-14deg) scale(1.6)' },
          '60%': { opacity: '1', transform: 'rotate(-9deg) scale(0.96)' },
          '100%': { opacity: '1', transform: 'rotate(-9deg) scale(1)' },
        },
        'deslizar-izq': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        cinta: 'cinta 32s linear infinite',
        sello: 'sello 420ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        'deslizar-izq': 'deslizar-izq 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },

      maxWidth: {
        mostrador: '78rem',
      },
    },
  },
  plugins: [],
};
