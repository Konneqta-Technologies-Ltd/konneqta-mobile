/**
 * Konneqta brand theme — mirrors the CSS custom properties in the konneqta
 * web app (app/globals.css) and the official logo (public/konneqta-logo.svg),
 * so both apps stay visually in sync.
 */

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

export const Colors = {
  light: {
    text: '#18181b', // --foreground
    textSecondary: '#737373', // --secondary-text-color
    background: '#ffffff', // --background
    surface: '#F8F7F5', // --main-text-color (warm cream) for subtle surfaces
    backgroundSelected: '#E5E5E5', // --border-color
    border: '#3f3f46', // form inputs: `border-zinc-700` on the web
    borderSubtle: '#E5E5E5', // hairlines & dividers: `border-zinc-300`
    orange: '#FF6B2C', // --main-orange
    orangeLogo: '#F2843F', // logo orange (konneqta-logo.svg)
    purple: '#6A56A4', // logo purple (konneqta-logo.svg)
    danger: '#dc2626',
    dangerSoft: '#fef2f2',
    dangerBorder: '#fecaca',
    splashBackground: '#000000', // launch experience (manifest background_color)
  },
  dark: {
    text: '#ededed', // .dark --foreground
    textSecondary: '#737373', // subtitle stays #737373 in dark mode on the web
    background: '#18181b', // .dark --background (zinc-900)
    surface: '#27272a', // zinc-800
    backgroundSelected: '#3f3f46', // zinc-700
    border: 'rgba(255, 255, 255, 0.5)', // `dark:border-white/50`
    borderSubtle: '#52525b', // `dark:bg-zinc-700`
    orange: '#FF6B2C',
    orangeLogo: '#F2843F',
    purple: '#6A56A4',
    danger: '#ef4444',
    dangerSoft: 'rgba(239, 68, 68, 0.12)',
    dangerBorder: 'rgba(239, 68, 68, 0.35)',
    splashBackground: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Outfit — the Konneqta typeface (`body { font-family: var(--font-outfit) }`
 * on the web). Values are the fontFamily STRINGS registered by expo-font;
 * the font asset modules themselves are loaded at startup in
 * src/app/_layout.tsx via FontSources.
 */
export const Fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extrabold: 'Outfit_800ExtraBold',
} as const;

/** Font sources passed to useFonts() in src/app/_layout.tsx. */
export const FontSources = {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radius scale — `rounded-xl` on the web is 12px. */
export const Radius = {
  md: 10,
  lg: 12,
  xl: 20,
  full: 9999,
} as const;
