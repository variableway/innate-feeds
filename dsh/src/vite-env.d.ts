/**
 * Environment types for the Bun-based build pipeline (host builds this
 * package via frontend/scripts/build.ts — Bun.build `define` injects the
 * values at build time; same contract as frontend/src/vite-env.d.ts).
 */
interface ImportMetaEnv {
  /** App base URL — "/" locally, "/{repo}/" on GitHub Pages project sites. */
  readonly BASE_URL: string;
  /** "true" in static (no-backend) mode. */
  readonly VITE_STATIC_MODE?: string;
  /** Optional override for the static data base URL. */
  readonly VITE_STATIC_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css";
