import { useEffect, useRef } from 'react';

type RealtimeRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export const useRealtimeRefresh = (
  refresh: () => Promise<void> | void,
  { enabled = true, intervalMs = 45_000 }: RealtimeRefreshOptions = {},
) => {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) {
      return undefined;
    }

    const tick = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) {
        return;
      }

      void refreshRef.current();
    };

    const intervalId = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', tick);
      window.removeEventListener('online', tick);
    };
  }, [enabled, intervalMs]);
};
