import { useCallback, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

export function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function writeTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event("theme-changed"));
}

/** Apply stored theme to <html> (call once before React mounts). */
export function initThemeFromStorage(): void {
  writeTheme(readTheme());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener("theme-changed", sync);
    return () => window.removeEventListener("theme-changed", sync);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = readTheme() === "light" ? "dark" : "light";
    writeTheme(next);
    setTheme(next);
  }, []);

  const setThemeExplicit = useCallback((next: Theme) => {
    writeTheme(next);
    setTheme(next);
  }, []);

  return { theme, toggleTheme, setTheme: setThemeExplicit };
}
