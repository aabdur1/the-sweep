import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        'cream-dark': 'var(--cream-dark)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'chicago-red': 'var(--chicago-red)',
        'red-deep': 'var(--red-deep)',
        'chicago-blue': 'var(--chicago-blue)',
        'blue-deep': 'var(--blue-deep)',
        rule: 'var(--rule)',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
