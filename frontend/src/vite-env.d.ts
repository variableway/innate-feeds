/**
 * Environment types for the Bun-based build pipeline. Vite is no longer a
 * dependency: scripts/build.ts injects these values at build time via
 * Bun.build `define`, and scripts/dev.ts does the same for the dev server.
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
