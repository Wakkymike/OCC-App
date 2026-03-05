'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeId = 'light' | 'medium' | 'dark' | 'high-contrast' | 'calm';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
}

export const THEMES: ThemeOption[] = [
  { id: 'light', label: 'Light', description: 'Default bright theme' },
  { id: 'medium', label: 'Medium', description: 'Balanced mid-tone theme' },
  { id: 'dark', label: 'Dark', description: 'Dark background, easy on eyes' },
  { id: 'high-contrast', label: 'High Contrast', description: 'Bold borders & colours for low vision' },
  { id: 'calm', label: 'Calm', description: 'Muted colours, no animations' },
];

const STORAGE_KEY = 'occ-theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('light');

  // Read persisted preference on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (stored && THEMES.some((t) => t.id === stored)) {
        setThemeState(stored);
        document.documentElement.setAttribute('data-theme', stored);
      }
    } catch {
      /* SSR / localStorage unavailable */
    }
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* quota exceeded etc */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
