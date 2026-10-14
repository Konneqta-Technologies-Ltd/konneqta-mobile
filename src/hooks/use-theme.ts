/**
 * The Konneqta palette in effect.
 *
 * Resolution order (mirrors the konneqta web app): the user's explicit
 * light/dark choice if they made one, otherwise the OS colour scheme.
 * Implemented in src/context/theme.tsx — this re-export keeps every existing
 * `useTheme()` call site unchanged.
 */
export { useTheme } from '@/context/theme';
