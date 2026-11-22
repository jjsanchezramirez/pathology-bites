"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` on the server and during the client's hydration render, `true`
 * afterwards.
 *
 * Use it to gate any render that reads client-only state restored at startup,
 * most commonly the localStorage-backed SWR cache (`swr-cache-provider.tsx`):
 * on a full page load the server renders with an empty cache (`isLoading`
 * true) while the client's first render already has cached data, so a page
 * that branches on `isLoading` hydrates a different tree and React throws a
 * hydration mismatch. Rendering the loading state until hydrated keeps the
 * first client render identical to the server's.
 *
 * Unlike a `useState(false)` + `useEffect` mounted flag, this returns `true`
 * immediately on client-side navigations (no hydration happens there), so the
 * loading skeleton only shows for one frame on a hard refresh.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
