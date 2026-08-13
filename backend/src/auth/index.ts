import { z } from "zod";
import { getGhAuthStatus } from "./gh-status.js";
import { clearStoredPat, isPatConfigured, storePat } from "./token-store.js";

export function buildAuthStatus() {
  const gh = getGhAuthStatus();
  return {
    gh: {
      ok: gh.ok,
      user: gh.user,
      // Truncate noisy stderr for API clients
      error: gh.ok ? null : (gh.error?.slice(0, 400) ?? "gh not authenticated"),
    },
    pat: {
      configured: isPatConfigured(),
    },
    syncReady: gh.ok || isPatConfigured(),
  };
}

export const PAT_BODY_SCHEMA = z.object({
  token: z.string().min(8).max(256),
});

export function savePatFromBody(body: unknown) {
  const parsed = PAT_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Validation error",
      details: parsed.error.issues,
    };
  }
  storePat(parsed.data.token);
  return { ok: true as const, pat: { configured: true } };
}

export function removePat() {
  clearStoredPat();
  return { ok: true as const, pat: { configured: false } };
}
