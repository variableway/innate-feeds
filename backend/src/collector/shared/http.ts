const USER_AGENT =
  "innate-feeds/0.1 (+https://github.com/variableway/innate-feeds)";

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { headers = {}, timeout = 30000, retries = 3 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      });

      if (!res.ok) {
        const body = await res.text().then((t) => t.slice(0, 200));
        throw new Error(`HTTP ${res.status}: ${body}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      console.warn(
        `[http] Retry ${attempt}/${retries} for ${url} in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("unreachable");
}

export async function fetchHtml(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const { headers = {}, timeout = 30000 } = options;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      ...headers,
    },
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}
