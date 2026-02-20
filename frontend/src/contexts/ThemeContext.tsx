import React, { createContext, useContext, useEffect, useState } from 'react';
import { getApiUrl, apiFetch } from '@/lib/api';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setThemeAndSave: (theme: Theme) => Promise<void>;
  actualTheme: 'dark' | 'light';
  isAnimating: boolean;
  triggerThemeChange: () => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  setThemeAndSave: async () => { },
  actualTheme: 'light',
  isAnimating: false,
  triggerThemeChange: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'legal-pro-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('light');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let systemTheme: 'light' | 'dark' = 'light';

    if (theme === 'system') {
      systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    const finalTheme = theme === 'system' ? systemTheme : theme;
    setActualTheme(finalTheme);
    root.classList.add(finalTheme);
  }, [theme]);

  // Apply theme locally (localStorage + DOM) — used internally
  const applyTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  };

  // Save theme to DB silently (fire-and-forget, no error surfacing)
  const saveThemeToDB = async (newTheme: Theme) => {
    try {
      await apiFetch(getApiUrl('/api/v1/auth/me'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: { theme: newTheme } }),
      });
    } catch {
      // Silently ignore — localStorage is still updated so UX is unaffected
    }
  };

  // Public: set theme locally only (used by FormattingContext init sync)
  const setTheme = (newTheme: Theme) => {
    applyTheme(newTheme);
  };

  // Public: set theme AND save to DB — used by toggle button and Settings
  const setThemeAndSave = async (newTheme: Theme) => {
    applyTheme(newTheme);
    await saveThemeToDB(newTheme);
  };

  // Toggle (used by ThemeToggle animation flow)
  const triggerThemeChange = () => {
    const newTheme = actualTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    saveThemeToDB(newTheme); // fire-and-forget
  };

  const value = {
    theme,
    setTheme,
    setThemeAndSave,
    actualTheme,
    isAnimating,
    triggerThemeChange,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};