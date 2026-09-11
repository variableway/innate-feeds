export type ThemeVariant =
  | "dsh"
  | "linear"
  | "notion"
  | "shadcn-zinc"
  | "shadcn-slate"
  | "shadcn-stone"
  | "shadcn-gray"
  | "shadcn-neutral"
  | "marshmallow"
  | "art-deco";

export type ColorMode = "light" | "dark" | "system";

export interface ThemeOption {
  id: ThemeVariant;
  label: string;
}

/** Single source of truth for selectable theme variants. */
export const THEME_VARIANTS: readonly ThemeOption[] = [
  { id: "dsh", label: "DSH" },
  { id: "linear", label: "Linear" },
  { id: "notion", label: "Notion" },
  { id: "shadcn-zinc", label: "Shadcn Zinc" },
  { id: "shadcn-slate", label: "Shadcn Slate" },
  { id: "shadcn-stone", label: "Shadcn Stone" },
  { id: "shadcn-gray", label: "Shadcn Gray" },
  { id: "shadcn-neutral", label: "Shadcn Neutral" },
  { id: "marshmallow", label: "Marshmallow" },
  { id: "art-deco", label: "Art Deco" },
] as const;

export const DEFAULT_THEME_VARIANT: ThemeVariant = "dsh";
export const DEFAULT_COLOR_MODE: ColorMode = "system";

export const THEME_COOKIE_NAME = "innate-theme";
export const THEME_STORAGE_KEY = "innate-theme";
export const LEGACY_FEEDS_THEME_KEY = "innate-feeds-theme";

export interface StoredTheme {
  variant: ThemeVariant;
  colorMode: ColorMode;
}

const VARIANT_IDS = new Set<string>(THEME_VARIANTS.map((v) => v.id));

export function isThemeVariant(value: string): value is ThemeVariant {
  return VARIANT_IDS.has(value);
}

export function migrateLegacyVariant(
  stored: string | null,
): ThemeVariant | null {
  if (!stored) return null;
  if (stored === "default") return "dsh";
  if (isThemeVariant(stored)) return stored;
  return null;
}

function getSystemColorMode(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveColorMode(colorMode: ColorMode): "light" | "dark" {
  return colorMode === "system" ? getSystemColorMode() : colorMode;
}

export function applyThemeToDocument(
  variant: ThemeVariant,
  colorMode: ColorMode,
): "light" | "dark" {
  const root = document.documentElement;
  const resolved = resolveColorMode(colorMode);

  root.classList.toggle("dark", resolved === "dark");
  root.setAttribute("data-theme", variant === "dsh" ? "" : variant);

  return resolved;
}

function parseStoredThemeJson(raw: string | null): StoredTheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    if (
      parsed.variant &&
      isThemeVariant(parsed.variant) &&
      parsed.colorMode &&
      ["light", "dark", "system"].includes(parsed.colorMode)
    ) {
      return {
        variant: parsed.variant,
        colorMode: parsed.colorMode as ColorMode,
      };
    }
  } catch {
    /* ignore malformed JSON */
  }
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function readStoredTheme(): StoredTheme {
  const defaults: StoredTheme = {
    variant: DEFAULT_THEME_VARIANT,
    colorMode: DEFAULT_COLOR_MODE,
  };

  if (typeof window === "undefined") return defaults;

  const fromCookie = parseStoredThemeJson(readCookie(THEME_COOKIE_NAME));
  if (fromCookie) return fromCookie;

  const fromStorage = parseStoredThemeJson(
    localStorage.getItem(THEME_STORAGE_KEY),
  );
  if (fromStorage) return fromStorage;

  const legacyVariant = migrateLegacyVariant(
    localStorage.getItem(LEGACY_FEEDS_THEME_KEY),
  );
  if (legacyVariant) {
    return { variant: legacyVariant, colorMode: DEFAULT_COLOR_MODE };
  }

  return defaults;
}

export function writeStoredTheme(theme: StoredTheme): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(theme);
  localStorage.setItem(THEME_STORAGE_KEY, payload);
  writeCookie(THEME_COOKIE_NAME, payload);
  // Keep legacy key mapped for older sessions
  localStorage.setItem(
    LEGACY_FEEDS_THEME_KEY,
    theme.variant === "dsh" ? "default" : theme.variant,
  );
}
