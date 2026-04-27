import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-2': 'rgb(var(--color-accent-2) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'monospace'],
        body: ['var(--font-body)', 'monospace'],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      boxShadow: {
        pixel: '4px 4px 0 0 rgb(var(--color-shadow))',
        'pixel-sm': '2px 2px 0 0 rgb(var(--color-shadow))',
        'pixel-lg': '8px 8px 0 0 rgb(var(--color-shadow))',
        'pixel-accent': '4px 4px 0 0 rgb(var(--color-accent))',
      },
    },
  },
  plugins: [],
} satisfies Config;
