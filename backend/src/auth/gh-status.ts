import { execFileSync } from "child_process";

export type GhAuthStatus = {
  ok: boolean;
  user: string | null;
  error: string | null;
};

function extractUser(text: string): string | null {
  const match =
    text.match(/Logged in to github\.com account (\S+)/i) ||
    text.match(/Logged in to .* account (\S+)/i);
  return match?.[1]?.replace(/['"]/g, "") ?? null;
}

/**
 * Read-only probe of `gh auth status` (ADR-D5: prefer gh over pasted PAT).
 */
export function getGhAuthStatus(): GhAuthStatus {
  try {
    const output = execFileSync("gh", ["auth", "status"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    return {
      ok: true,
      user: extractUser(output),
      error: null,
    };
  } catch (err: unknown) {
    const stderr =
      err &&
      typeof err === "object" &&
      "stderr" in err &&
      (err as { stderr: unknown }).stderr != null
        ? String((err as { stderr: Buffer | string }).stderr)
        : "";
    const stdout =
      err &&
      typeof err === "object" &&
      "stdout" in err &&
      (err as { stdout: unknown }).stdout != null
        ? String((err as { stdout: Buffer | string }).stdout)
        : "";
    const combined = `${stdout}\n${stderr}`;
    const user = extractUser(combined);
    // Some gh versions exit non-zero but still report logged-in on stderr.
    if (user || /Logged in to/i.test(combined)) {
      return { ok: true, user, error: null };
    }
    const message =
      stderr.trim() ||
      (err instanceof Error ? err.message : "gh auth status failed");
    return {
      ok: false,
      user: null,
      error: message.slice(0, 400),
    };
  }
}
