/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'retro-yellow': '#E8F929',
        'retro-yellow-hover': '#D8E81F',
        'retro-green': '#00D084',
        'retro-green-light': '#E6FAF2',
        'retro-pink': '#FF599C',
        'retro-pink-light': '#FFEBF3',
        'retro-purple': '#A78BFA',
        'retro-blue': '#38BDF8',
        'retro-canvas': '#FAF7EE',
        'retro-cream': '#F4F0EA',
        'retro-black': '#121212',
      },
      boxShadow: {
        'brutal-sm': '2px 2px 0px #000000',
        'brutal': '4px 4px 0px #000000',
        'brutal-lg': '6px 6px 0px #000000',
        'brutal-xl': '8px 8px 0px #000000',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Plus Jakarta Sans', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
