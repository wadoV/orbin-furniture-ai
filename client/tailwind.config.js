/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#1A1A1A', 2: '#212121', 3: '#2A2A2A' },
        border: '#2E2E2E',
        primary: { DEFAULT: '#F5A623', hover: '#E8951A', dark: '#C47A0F' },
        success: '#22C55E',
        danger:  '#EF4444',
        warning: '#F59E0B',
        muted:   '#6B6B6B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(245,166,35,0.25)',
        'glow':    '0 0 24px rgba(245,166,35,0.35)',
        'glow-lg': '0 0 48px rgba(245,166,35,0.30)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #F5A623 0%, #C47A0F 100%)',
      },
      animation: {
        'slide-grid': 'slideGrid 28s linear infinite',
      },
      keyframes: {
        slideGrid: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '48px 48px' },
        },
      },
    },
  },
  plugins: [],
}
