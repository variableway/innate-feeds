export interface DataManifest {
  version: number;
  generatedAt: string;
  feeds: {
    trending: string[];
    starred: string[];
  };
}

export function extractChunkDate(path: string): string | null {
  const match = path.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  return match?.[1] ?? null;
}

export function getTrendingDatesFromManifest(manifest: DataManifest): string[] {
  return manifest.feeds.trending
    .map(extractChunkDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .reverse();
}

export function upsertManifestPath(paths: string[], nextPath: string): string[] {
  const merged = new Set(paths);
  merged.add(nextPath);
  return Array.from(merged).sort();
}
