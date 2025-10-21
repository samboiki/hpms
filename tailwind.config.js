/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          'sidebar': '#01b9d4',
        },
        'accent': {
          coral: '#ff6b6b',
          lavender: '#9b6bff',
          azure: '#01b9d4',
          mint: '#00d68f',
          gold: '#ffd700',
        },
        'success': {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        'warning': {
          50: '#fefce8',
          500: '#eab308',
          600: '#ca8a04',
        },
        'error': {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        'primary': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Rubik', 'sans-serif'],
        rubik: ['Rubik', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 15px rgba(94, 234, 212, 0.3)',
        'float': '0 10px 30px -5px rgba(1, 185, 212, 0.1)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        }
      }
    },
  },
  plugins: [],
}