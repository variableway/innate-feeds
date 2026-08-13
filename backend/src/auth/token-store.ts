import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { getDefaultDbPath, INNATE_HOME } from "../db/paths.js";

const ALGO = "aes-256-gcm";

function secretsDir(): string {
  // Prefer directory of DB_PATH so secrets stay next to the database.
  const dbPath = getDefaultDbPath();
  const dir = join(dirname(dbPath), "secrets");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function keyPath(): string {
  return join(secretsDir(), "pat.key");
}

function tokenPath(): string {
  return join(secretsDir(), "github_pat.enc");
}

function loadOrCreateKey(): Buffer {
  const path = keyPath();
  if (existsSync(path)) {
    return readFileSync(path);
  }
  mkdirSync(INNATE_HOME, { recursive: true });
  const key = randomBytes(32);
  writeFileSync(path, key, { mode: 0o600 });
  return key;
}

function deriveKey(raw: Buffer): Buffer {
  // scrypt for stable 32-byte key material if file length varies
  if (raw.length === 32) return raw;
  return scryptSync(raw, "innate-feeds-pat", 32);
}

/** Whether an encrypted PAT file exists (never returns the token). */
export function isPatConfigured(): boolean {
  return existsSync(tokenPath());
}

export function clearStoredPat(): void {
  const path = tokenPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function storePat(token: string): void {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 8) {
    throw new Error("PAT looks invalid (too short)");
  }
  const key = deriveKey(loadOrCreateKey());
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]);
  writeFileSync(tokenPath(), payload.toString("base64"), { mode: 0o600 });
}

export function readStoredPat(): string | null {
  if (!isPatConfigured()) return null;
  const key = deriveKey(loadOrCreateKey());
  const payload = Buffer.from(readFileSync(tokenPath(), "utf8"), "base64");
  if (payload.length < 12 + 16 + 1) {
    throw new Error("Corrupt PAT store");
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Env for `gh` child processes: inject stored PAT as GH_TOKEN when present.
 * Does not log or return the token.
 */
export function ghProcessEnv(
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...base };
  try {
    const pat = readStoredPat();
    if (pat) {
      env.GH_TOKEN = pat;
      env.GITHUB_TOKEN = pat;
    }
  } catch {
    // Ignore decrypt errors; gh may still use interactive auth.
  }
  return env;
}
