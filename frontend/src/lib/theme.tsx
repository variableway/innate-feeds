import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemeToDocument,
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME_VARIANT,
  LEGACY_FEEDS_THEME_KEY,
  readStoredTheme,
  resolveColorMode,
  THEME_STORAGE_KEY,
  writeStoredTheme,
  type ColorMode,
  type ThemeVariant,
} from "@innate/shared/theme-catalog";

interface ThemeContextValue {
  variant: ThemeVariant;
  colorMode: ColorMode;
  resolvedColorMode: "light" | "dark";
  setVariant: (variant: ThemeVariant) => void;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<ThemeVariant>(() =>
    typeof window === "undefined"
      ? DEFAULT_THEME_VARIANT
      : readStoredTheme().variant,
  );
  const [colorMode, setColorModeState] = useState<ColorMode>(() =>
    typeof window === "undefined"
      ? DEFAULT_COLOR_MODE
      : readStoredTheme().colorMode,
  );
  const [resolvedColorMode, setResolvedColorMode] = useState<"light" | "dark">(
    "light",
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setVariantState(stored.variant);
    setColorModeState(stored.colorMode);
    const resolved = applyThemeToDocument(stored.variant, stored.colorMode);
    setResolvedColorMode(resolved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const resolved = applyThemeToDocument(variant, colorMode);
    setResolvedColorMode(resolved);
  }, [variant, colorMode, hydrated]);

  useEffect(() => {
    if (colorMode !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = resolveColorMode("system");
      setResolvedColorMode(resolved);
      applyThemeToDocument(variant, "system");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [colorMode, variant]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== THEME_STORAGE_KEY &&
        event.key !== LEGACY_FEEDS_THEME_KEY
      ) {
        return;
      }
      const stored = readStoredTheme();
      setVariantState(stored.variant);
      setColorModeState(stored.colorMode);
      const resolved = applyThemeToDocument(stored.variant, stored.colorMode);
      setResolvedColorMode(resolved);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setVariant = useCallback((next: ThemeVariant) => {
    setVariantState(next);
    writeStoredTheme({ variant: next, colorMode });
  }, [colorMode]);

  const setColorMode = useCallback((next: ColorMode) => {
    setColorModeState(next);
    writeStoredTheme({ variant, colorMode: next });
  }, [variant]);

  const toggleColorMode = useCallback(() => {
    setColorModeState((current) => {
      const resolved = resolveColorMode(current);
      const next = resolved === "dark" ? "light" : "dark";
      writeStoredTheme({ variant, colorMode: next });
      return next;
    });
  }, [variant]);

  const value = useMemo(
    () => ({
      variant,
      colorMode,
      resolvedColorMode,
      setVariant,
      setColorMode,
      toggleColorMode,
    }),
    [variant, colorMode, resolvedColorMode, setVariant, setColorMode, toggleColorMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
