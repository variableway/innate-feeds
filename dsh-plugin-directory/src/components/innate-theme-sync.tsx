"use client";

import { useEffect } from "react";
import { useTheme as useNextTheme } from "next-themes";
import {
  applyThemeToDocument,
  LEGACY_FEEDS_THEME_KEY,
  readStoredTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
  type ColorMode,
} from "@/lib/innate-theme";

/** Bridges next-themes color mode with shared variant + cookie/localStorage sync. */
export function InnateThemeSync() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  useEffect(() => {
    const stored = readStoredTheme();
    applyThemeToDocument(stored.variant, stored.colorMode);
    setTheme(stored.colorMode);
  }, [setTheme]);

  useEffect(() => {
    if (!theme) return;
    const stored = readStoredTheme();
    const colorMode = (theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : stored.colorMode) as ColorMode;
    writeStoredTheme({ variant: stored.variant, colorMode });
    applyThemeToDocument(stored.variant, colorMode);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== THEME_STORAGE_KEY &&
        event.key !== LEGACY_FEEDS_THEME_KEY
      ) {
        return;
      }
      const stored = readStoredTheme();
      applyThemeToDocument(stored.variant, stored.colorMode);
      setTheme(stored.colorMode);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setTheme]);

  return null;
}
