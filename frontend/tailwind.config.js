/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bloomberg: {
          bg: '#0a0a0a',
          panel: '#111111',
          border: '#1f1f1f',
          'border-bright': '#2a2a2a',
          text: '#e8e8e8',
          muted: '#888888',
          accent: '#ff6600',
          'accent-dim': '#cc5200',
          'accent-glow': 'rgba(255, 102, 0, 0.15)',
          up: '#00d37f',
          'up-dim': 'rgba(0, 211, 127, 0.15)',
          down: '#ff3b3b',
          'down-dim': 'rgba(255, 59, 59, 0.15)',
          blue: '#4a9eff',
          purple: '#a855f7',
          yellow: '#fbbf24',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', 'Courier', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
        xs: '0.70rem',
        sm: '0.75rem',
      },
      animation: {
        'ticker': 'ticker 40s linear infinite',
        'ticker-fast': 'ticker 20s linear infinite',
        'blink': 'blink 1s step-end infinite',
        'flash-up': 'flashUp 0.6s ease-out',
        'flash-down': 'flashDown 0.6s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        flashUp: {
          '0%': { backgroundColor: 'rgba(0, 211, 127, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashDown: {
          '0%': { backgroundColor: 'rgba(255, 59, 59, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(255,102,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,102,0,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
