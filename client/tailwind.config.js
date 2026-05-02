/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1A1A1A',
          2: '#212121',
          3: '#2A2A2A',
        },
        border: '#2E2E2E',
        primary: {
          DEFAULT: '#F5A623',
          hover: '#E8951A',
          dark: '#C47A0F',
        },
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        muted: '#6B6B6B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
