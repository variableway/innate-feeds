/**
 * Desktop (Tauri) integration helpers.
 *
 * In the web build (GitHub Pages static mode or API mode against a remote
 * backend) these are dead-branched: `isTauri()` returns false and the
 * `@tauri-apps/api` module is dynamically imported only inside
 * `getBackendInfo()`, so it never enters the main web bundle.
 */

interface BackendInfo {
  host: string;
  port: number;
  ready: boolean;
}

let backendInfoCache: BackendInfo | null = null;

/** Whether the frontend is running inside a Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Ask the Rust host where the sidecar backend is listening. The host spawns the
 * sidecar on a free port at startup and waits for `/api/health` before
 * returning, so by the time this resolves the backend is ready. Cached.
 */
export async function getBackendInfo(): Promise<BackendInfo> {
  if (backendInfoCache) return backendInfoCache;
  const { invoke } = await import("@tauri-apps/api/core");
  const info = await invoke<BackendInfo>("get_backend_info");
  backendInfoCache = info;
  return info;
}

/**
 * Resolve the API base URL: the sidecar origin when running in Tauri, the
 * relative `/api` otherwise (proxied to the Hono backend by Vite in dev, or
 * served behind the same origin in Docker).
 */
export async function resolveApiBase(): Promise<string> {
  if (isTauri()) {
    const info = await getBackendInfo();
    return `http://${info.host}:${info.port}/api`;
  }
  return "/api";
}
