/** Default lookback for digest issues, starred repos, and README prefetch. */
export const DEFAULT_SYNC_WINDOW_DAYS = 90;

/** Calendar date `YYYY-MM-DD` that is `days` before `now` (UTC). */
export function dateDaysAgo(days: number, now = new Date()): string {
  const safe =
    Number.isFinite(days) && days > 0 ? days : DEFAULT_SYNC_WINDOW_DAYS;
  const ms = safe * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms).toISOString().slice(0, 10);
}

export function isoDaysAgo(days: number, now = new Date()): string {
  const safe =
    Number.isFinite(days) && days > 0 ? days : DEFAULT_SYNC_WINDOW_DAYS;
  return new Date(now.getTime() - safe * 24 * 60 * 60 * 1000).toISOString();
}
