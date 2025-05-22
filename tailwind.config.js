/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './templates/**/*.{html,js}', // Escaneia todos os arquivos HTML e JS na pasta templates
    './static/js/**/*.{html,js}'  // Escaneia todos os arquivos JS na pasta static/js
  ],
  theme: {
    extend: {
      animation: {
        pulse: 'pulse 1.5s ease-in-out infinite',
      }
    }
  },
  plugins: []
}