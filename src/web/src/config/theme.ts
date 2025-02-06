import { ThemeMode } from '../types/common';
import type { Config } from 'tailwindcss'; // v3.3.0+
import { createTheme } from '@shadcn/ui/theme'; // v1.0.0+

// Storage key for theme preference
export const THEME_STORAGE_KEY = 'hotgigs-theme-mode';
export const DEFAULT_THEME_MODE = ThemeMode.SYSTEM;
export const COLOR_CONTRAST_RATIO = 4.5; // WCAG 2.1 AA compliance
export const TYPOGRAPHY_SCALE_RATIO = 1.25;

// Theme color interface with WCAG compliance
export interface ThemeColors {
  background: {
    default: string;
    hover: string;
    active: string;
  };
  foreground: {
    primary: string;
    secondary: string;
    muted: string;
  };
  primary: {
    default: string;
    hover: string;
    contrast: string;
  };
  secondary: {
    default: string;
    hover: string;
    contrast: string;
  };
  accent: {
    default: string;
    hover: string;
    contrast: string;
  };
  destructive: {
    default: string;
    hover: string;
    contrast: string;
  };
  success: {
    default: string;
    hover: string;
    contrast: string;
  };
  warning: {
    default: string;
    hover: string;
    contrast: string;
  };
}

// Typography system interface
export interface ThemeTypography {
  fontSans: string;
  fontMono: string;
  fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  fontWeights: {
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  lineHeights: {
    none: string;
    tight: string;
    snug: string;
    normal: string;
    relaxed: string;
    loose: string;
  };
}

// Spacing system interface
export interface ThemeSpacing {
  spacing: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    8: string;
    10: string;
    12: string;
    16: string;
    20: string;
    24: string;
  };
  containerWidths: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  breakpoints: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

// Default theme configuration
export const defaultThemeConfig = {
  colors: {
    background: {
      default: 'hsl(var(--background))',
      hover: 'hsl(var(--background-hover))',
      active: 'hsl(var(--background-active))',
    },
    foreground: {
      primary: 'hsl(var(--foreground-primary))',
      secondary: 'hsl(var(--foreground-secondary))',
      muted: 'hsl(var(--foreground-muted))',
    },
    primary: {
      default: 'hsl(var(--primary))',
      hover: 'hsl(var(--primary-hover))',
      contrast: 'hsl(var(--primary-contrast))',
    },
    secondary: {
      default: 'hsl(var(--secondary))',
      hover: 'hsl(var(--secondary-hover))',
      contrast: 'hsl(var(--secondary-contrast))',
    },
    accent: {
      default: 'hsl(var(--accent))',
      hover: 'hsl(var(--accent-hover))',
      contrast: 'hsl(var(--accent-contrast))',
    },
    destructive: {
      default: 'hsl(var(--destructive))',
      hover: 'hsl(var(--destructive-hover))',
      contrast: 'hsl(var(--destructive-contrast))',
    },
    success: {
      default: 'hsl(var(--success))',
      hover: 'hsl(var(--success-hover))',
      contrast: 'hsl(var(--success-contrast))',
    },
    warning: {
      default: 'hsl(var(--warning))',
      hover: 'hsl(var(--warning-hover))',
      contrast: 'hsl(var(--warning-contrast))',
    },
  },
  typography: {
    fontSans: "'Inter var', -apple-system, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', Consolas, monospace",
    fontSizes: {
      xs: '0.75rem',
      sm: '0.938rem',
      base: '1.172rem',
      lg: '1.465rem',
      xl: '1.831rem',
      '2xl': '2.289rem',
      '3xl': '2.861rem',
      '4xl': '3.576rem',
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
  },
  spacing: {
    spacing: {
      0: '0',
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      8: '2rem',
      10: '2.5rem',
      12: '3rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
    },
    containerWidths: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    breakpoints: {
      xs: '320px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },
} as const;

// Theme variable generator with WCAG compliance
export function getThemeVariables(mode: ThemeMode): Record<string, string> {
  const isLight = mode === ThemeMode.LIGHT;

  return {
    '--background': isLight ? '0 0% 100%' : '240 10% 3.9%',
    '--background-hover': isLight ? '0 0% 95%' : '240 10% 8.9%',
    '--background-active': isLight ? '0 0% 90%' : '240 10% 13.9%',
    
    '--foreground-primary': isLight ? '240 10% 3.9%' : '0 0% 98%',
    '--foreground-secondary': isLight ? '240 5% 34%' : '240 5% 64.9%',
    '--foreground-muted': isLight ? '240 3.8% 46.1%' : '240 5% 54.9%',
    
    '--primary': isLight ? '221.2 83.2% 53.3%' : '217.2 91.2% 59.8%',
    '--primary-hover': isLight ? '221.2 83.2% 48.3%' : '217.2 91.2% 54.8%',
    '--primary-contrast': isLight ? '0 0% 100%' : '0 0% 100%',
    
    '--secondary': isLight ? '240 5.9% 10%' : '240 3.7% 15.9%',
    '--secondary-hover': isLight ? '240 5.9% 15%' : '240 3.7% 20.9%',
    '--secondary-contrast': isLight ? '0 0% 100%' : '0 0% 100%',
    
    '--accent': isLight ? '262.1 83.3% 57.8%' : '262.1 83.3% 62.8%',
    '--accent-hover': isLight ? '262.1 83.3% 52.8%' : '262.1 83.3% 57.8%',
    '--accent-contrast': isLight ? '0 0% 100%' : '0 0% 100%',
    
    '--destructive': isLight ? '0 84.2% 60.2%' : '0 84.2% 65.2%',
    '--destructive-hover': isLight ? '0 84.2% 55.2%' : '0 84.2% 60.2%',
    '--destructive-contrast': isLight ? '0 0% 100%' : '0 0% 100%',
    
    '--success': isLight ? '142.1 76.2% 36.3%' : '142.1 76.2% 41.3%',
    '--success-hover': isLight ? '142.1 76.2% 31.3%' : '142.1 76.2% 36.3%',
    '--success-contrast': isLight ? '0 0% 100%' : '0 0% 100%',
    
    '--warning': isLight ? '38 92% 50%' : '38 92% 55%',
    '--warning-hover': isLight ? '38 92% 45%' : '38 92% 50%',
    '--warning-contrast': isLight ? '0 0% 100%' : '0 0% 100%',
  };
}

// Enhanced system theme detection
export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return ThemeMode.LIGHT;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;

  // Apply high contrast adjustments if needed
  if (prefersHighContrast) {
    document.documentElement.setAttribute('data-high-contrast', 'true');
  }

  return mediaQuery.matches ? ThemeMode.DARK : ThemeMode.LIGHT;
}

// Export theme configuration for Tailwind
export const tailwindConfig: Partial<Config> = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: defaultThemeConfig.spacing.containerWidths,
    },
    extend: {
      colors: defaultThemeConfig.colors,
      typography: defaultThemeConfig.typography,
      spacing: defaultThemeConfig.spacing.spacing,
      screens: defaultThemeConfig.spacing.breakpoints,
    },
  },
};