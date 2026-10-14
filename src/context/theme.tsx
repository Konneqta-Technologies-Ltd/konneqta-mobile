import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Theme mode — mirrors the konneqta web app (components/DarkModeToggle.tsx):
 *  - `null`  → no explicit choice yet, follow the OS colour scheme
 *             (the `prefers-color-scheme` fallback in globals.css on the web)
 *  - 'light' / 'dark' → explicit choice, persisted and sticky
 * The choice is stored with AsyncStorage (localStorage on web) so it survives
 * restarts, exactly like localStorage.setItem('theme', ...) on the web.
 */
export type ThemePreference = 'light' | 'dark' | null;

const THEME_STORAGE_KEY = '@konneqta/theme';

type ThemeContextValue = {
  /** What the user explicitly picked (null = follow the OS). */
  preference: ThemePreference;
  /** The palette actually in effect: preference, or the OS scheme. */
  resolved: 'light' | 'dark';
  /** False until the stored preference has been read from disk. */
  isLoaded: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Switch between light and dark (and persist the choice). */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark')) {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // Corrupt/unavailable storage — fall back to the OS scheme.
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const resolved: 'light' | 'dark' = preference ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (next) {
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
    } else {
      AsyncStorage.removeItem(THEME_STORAGE_KEY).catch(() => {});
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, isLoaded, setPreference, toggleTheme }),
    [preference, resolved, isLoaded, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The Konneqta palette in effect — drop-in for the old system-only hook. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  return Colors[ctx?.resolved ?? 'light'];
}

/** Preference + setter — used by the dark-mode toggle and the root layout. */
export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used inside <ThemeProvider>');
  }
  return ctx;
}
