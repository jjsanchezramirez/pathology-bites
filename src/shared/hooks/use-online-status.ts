// src/shared/hooks/use-online-status.ts
"use client";

import { useEffect, useState } from "react";

/**
 * Reactive `navigator.onLine` value. Re-renders consumers when the browser
 * fires `online` / `offline` events.
 *
 * Use this to gate network-dependent work — auto-saves, redirects, image
 * fetches — instead of letting them fail and retry indefinitely. The browser
 * signal is best-effort (it can lag behind reality), so callers should still
 * handle `fetch` failures, but it's good enough to stop the noisy retry
 * cascades that show up in offline testing.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
