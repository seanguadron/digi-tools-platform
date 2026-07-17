"use client";

import { useCallback, useSyncExternalStore } from "react";

// Live matchMedia state without effect-driven setState. SSR snapshots false
// (the server has no viewport); useSyncExternalStore re-reads on the client
// before paint, so a phone never flashes the desktop branch.
//
// Both matchMedia calls are guarded: this runs during render, and the app has
// no error boundary, so a throw in a locked-down webview would take the whole
// tool down for a layout preference. Refusal resolves to false — the same
// safe-default shape as the storage guard in use-mobile-preview.ts.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let media: MediaQueryList;
      try {
        media = window.matchMedia(query);
      } catch {
        return () => {};
      }
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
    () => false,
  );
}
