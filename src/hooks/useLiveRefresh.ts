import { useCallback, useEffect, useState } from 'react';

/** Fast contract state is intentionally modest; historical scans run less often. */
export const FAST_REFRESH_MS = 15_000;
export const HISTORY_REFRESH_MS = 60_000;

export function useLiveRefresh() {
  const [fastVersion, setFastVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const refreshNow = useCallback((includeHistory = false) => {
    setFastVersion((value) => value + 1);
    if (includeHistory) setHistoryVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    const fastTimer = window.setInterval(() => refreshNow(false), FAST_REFRESH_MS);
    const historyTimer = window.setInterval(() => refreshNow(true), HISTORY_REFRESH_MS);
    const foreground = () => { if (document.visibilityState === 'visible') refreshNow(true); };
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    return () => {
      window.clearInterval(fastTimer);
      window.clearInterval(historyTimer);
      window.removeEventListener('focus', foreground);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [refreshNow]);

  return { fastVersion, historyVersion, refreshNow };
}
