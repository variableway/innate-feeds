"use client";

import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyThemeToDocument,
  readStoredTheme,
  writeStoredTheme,
  THEME_VARIANTS,
  type ThemeVariant,
} from "@/lib/innate-theme";

export function VariantSelector() {
  const [variant, setVariant] = useState<ThemeVariant>("dsh");

  useEffect(() => {
    setVariant(readStoredTheme().variant);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Palette className="size-4 text-muted-foreground" />
      <select
        value={variant}
        onChange={(event) => {
          const next = event.target.value as ThemeVariant;
          setVariant(next);
          const stored = readStoredTheme();
          writeStoredTheme({ ...stored, variant: next });
          applyThemeToDocument(next, stored.colorMode);
        }}
        className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Theme variant"
      >
        {THEME_VARIANTS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
