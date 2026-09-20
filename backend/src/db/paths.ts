import { existsSync, mkdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, parse, resolve } from "path";
import { fileURLToPath } from "url";

export const INNATE_HOME =
  process.env.INNATE_HOME || join(homedir(), ".innate");

let repoRoot: string | null | undefined;

/**
 * Repo root for anchoring relative DB_PATH values, found by walking up from
 * this module to the package.json that declares the backend workspace. Works
 * both for `bun src/...` runs (module at backend/src/db) and the bundled
 * output (backend/dist). Null when no workspace marker exists above us.
 */
function findRepoRoot(): string | null {
  if (repoRoot !== undefined) return repoRoot;
  let dir = dirname(fileURLToPath(import.meta.url));
  const { root } = parse(dir);
  while (dir !== root) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          workspaces?: unknown;
        };
        if (Array.isArray(pkg.workspaces) && pkg.workspaces.includes("backend")) {
          repoRoot = dir;
          return dir;
        }
      } catch {
        // Malformed package.json — keep walking up.
      }
    }
    dir = dirname(dir);
  }
  repoRoot = null;
  return null;
}

export function getDefaultDbPath(): string {
  if (process.env.DB_PATH) {
    // Anchor relative paths to the repo root instead of the launch cwd so
    // `DB_PATH=feeds.db` resolves to the same file whether bun runs from the
    // repo root or from backend/. Absolute paths pass through unchanged.
    const dbPath = resolve(
      findRepoRoot() ?? process.cwd(),
      process.env.DB_PATH,
    );
    mkdirSync(dirname(dbPath), { recursive: true });
    return dbPath;
  }
  mkdirSync(INNATE_HOME, { recursive: true });
  return join(INNATE_HOME, "feeds.db");
}
