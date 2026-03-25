// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          DEFAULT: '#0a0e14',
          surface: '#0f1520',
          border: '#1e2a3a',
          hover: '#2a3f5a',
          text: '#c8d0e0',
          muted: '#4a6080',
          dim: '#2a3a50',
        },
        green: { DEFAULT: '#00e5a0', bg: '#0d2a1e' },
        red: { DEFAULT: '#ff4d6a', bg: '#2a0d14' },
        amber: { DEFAULT: '#ffb84d', bg: '#2a1f00' },
        blue: { DEFAULT: '#4a9eff', bg: '#0d1f35' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': '9px',
        xs: '11px',
        sm: '12px',
        base: '13px',
        md: '14px',
        lg: '16px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
        '4xl': '36px',
      },
      borderWidth: {
        DEFAULT: '1px',
        '0.5': '0.5px',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
