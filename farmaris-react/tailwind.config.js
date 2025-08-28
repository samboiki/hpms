/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        farmaris: {
          primary: '#92400e',   // amber-800
          secondary: '#f59e0b',  // amber-500
          accent: '#ea580c',     // orange-600
        }
      }
    },
  },
  plugins: [],
}

