import type { Config } from 'tailwindcss'; // v3.3.0+
import { defaultThemeConfig } from './src/config/theme';
import shadcnPlugin from '@shadcn/ui/plugin'; // v1.0.0+
import animatePlugin from 'tailwindcss-animate'; // v1.0.0+

export default {
  // Define content sources for Tailwind processing
  content: [
    './src/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],

  // Enable class-based dark mode strategy
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    // Container configuration
    container: {
      center: true,
      padding: '2rem',
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px'
      }
    },

    // Theme extensions and customizations
    extend: {
      // Color system with CSS variable support and WCAG compliance
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground-primary))',
        
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-contrast))',
          hover: 'hsl(var(--primary-hover))',
          active: 'hsl(var(--primary-hover))'
        },
        
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-contrast))',
          hover: 'hsl(var(--secondary-hover))',
          active: 'hsl(var(--secondary-hover))'
        },
        
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-contrast))',
          hover: 'hsl(var(--accent-hover))'
        },
        
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-contrast))',
          hover: 'hsl(var(--destructive-hover))'
        },
        
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-contrast))',
          hover: 'hsl(var(--success-hover))'
        },
        
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-contrast))',
          hover: 'hsl(var(--warning-hover))'
        },
        
        muted: {
          DEFAULT: 'hsl(var(--background-hover))',
          foreground: 'hsl(var(--foreground-muted))'
        },
        
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))'
      },

      // Border radius system
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },

      // Typography system with 1.25 scale ratio
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultThemeConfig.typography.fontSans.split(',')],
        mono: ['var(--font-mono)', ...defaultThemeConfig.typography.fontMono.split(',')]
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.938rem', { lineHeight: '1.25rem' }],
        base: ['1.172rem', { lineHeight: '1.5rem' }],
        lg: ['1.465rem', { lineHeight: '1.75rem' }],
        xl: ['1.831rem', { lineHeight: '1.75rem' }],
        '2xl': ['2.289rem', { lineHeight: '2rem' }],
        '3xl': ['2.861rem', { lineHeight: '2.25rem' }],
        '4xl': ['3.576rem', { lineHeight: '2.5rem' }]
      },

      // Spacing system with 4px (0.25rem) base unit
      spacing: defaultThemeConfig.spacing.spacing,

      // Animation utilities
      animation: {
        'fade-in': 'fadeIn 200ms ease-in',
        'fade-out': 'fadeOut 200ms ease-out',
        'slide-in': 'slideIn 200ms ease-out',
        'slide-out': 'slideOut 200ms ease-in',
        'scale-in': 'scaleIn 200ms ease-out',
        'scale-out': 'scaleOut 200ms ease-in'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        slideIn: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        slideOut: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' }
        },
        scaleOut: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(0.95)' }
        }
      }
    }
  },

  // Plugin configurations
  plugins: [
    shadcnPlugin({
      // shadcn/ui plugin configuration
      prefix: '',
      cssVariables: true,
      highContrast: true,
      darkMode: true
    }),
    animatePlugin
  ]
} satisfies Config;