import { useCallback, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;
export const DEFAULT_PAGE_SIZE = 20;

const STORAGE_KEY = "innate-feeds:page-size";

function readStoredPageSize(): number {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(value)) {
      return value;
    }
  } catch {
    // localStorage unavailable — fall through to default
  }
  return DEFAULT_PAGE_SIZE;
}

export function usePageSize() {
  const [pageSize, setPageSizeState] = useState<number>(readStoredPageSize);

  const setPageSize = useCallback((next: number) => {
    setPageSizeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable — keep in-memory value only
    }
  }, []);

  return [pageSize, setPageSize] as const;
}
