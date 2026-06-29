import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const INNATE_HOME =
  process.env.INNATE_HOME || join(homedir(), ".innate");

export function getDefaultDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  mkdirSync(INNATE_HOME, { recursive: true });
  return join(INNATE_HOME, "feeds.db");
}
