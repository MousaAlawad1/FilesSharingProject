import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

/**
 * Shairley — شيّرلي
 * Senior-grade design system: "Brass on Ink"
 *
 * - Surfaces stack from `surface-1` (deepest) up to `surface-4` (popovers).
 * - Foreground tones step from `fg-1` (primary text) to `fg-4` (subtle).
 * - Accents: `brass` (warm gold) for primary, `brick` for destructive, `sage` for success.
 * - All tokens are HSL-driven so opacity modifiers (`/30`, `/70`, ...) just work.
 */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1320px' },
    },
    extend: {
      colors: {
        // shadcn baseline (kept for any ui/* primitives that reference them)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        // Shairley palette
        ink: 'hsl(var(--ink))',
        sheen: 'hsl(var(--sheen))',

        'surface-1': 'hsl(var(--surface-1))',
        'surface-2': 'hsl(var(--surface-2))',
        'surface-3': 'hsl(var(--surface-3))',
        'surface-4': 'hsl(var(--surface-4))',

        line: 'hsl(var(--line))',
        'line-strong': 'hsl(var(--line-strong))',

        'fg-1': 'hsl(var(--fg-1))',
        'fg-2': 'hsl(var(--fg-2))',
        'fg-3': 'hsl(var(--fg-3))',
        'fg-4': 'hsl(var(--fg-4))',

        brass: {
          DEFAULT: 'hsl(var(--brass))',
          hover: 'hsl(var(--brass-hover))',
          ring: 'hsl(var(--brass-ring))',
        },
        brick: {
          DEFAULT: 'hsl(var(--brick))',
          soft: 'hsl(var(--brick-soft))',
        },
        sage: 'hsl(var(--sage))',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Cairo',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'depth-1': '0 1px 0 hsl(var(--sheen) / 0.04) inset, 0 1px 2px rgba(0,0,0,0.35)',
        'depth-2':
          '0 1px 0 hsl(var(--sheen) / 0.05) inset, 0 8px 24px -12px rgba(0,0,0,0.55)',
        'depth-3':
          '0 1px 0 hsl(var(--sheen) / 0.06) inset, 0 24px 60px -20px rgba(0,0,0,0.7)',
        brass: '0 8px 24px -10px hsl(var(--brass) / 0.55)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 6px)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
