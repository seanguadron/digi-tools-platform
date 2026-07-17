"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Resolves a portal container without lying to hydration
 * (docs/ARCHITECTURE.md §2).
 *
 * Reading the DOM during render to pick a portal target — the
 * `typeof document === "undefined" ? null : document.body` idiom — makes the
 * server render `null` and the client render a portal. Different tree shapes
 * is a hydration mismatch, and React's only recovery at the root is to throw
 * away the server HTML and client-render the document. That re-acquires the
 * <html> singleton, which wipes its attributes and reapplies layout.tsx's
 * props, silently undoing the no-flash theme bootstrap (2026-07-17).
 *
 * The server snapshot is `null`, so the hydration render matches the server
 * exactly; React then re-reads the client snapshot and the portal mounts
 * before paint — the bar never blanks. Same store idiom as `useMediaQuery`.
 *
 * The hazard is precise: a portal breaks hydration only when it inserts REAL
 * DOM into its container during the FIRST render, because that container is
 * itself being hydrated and its children then differ from the server's. A
 * portal whose children render to nothing (an `open`-gated dialog, an idle
 * dnd-kit DragOverlay) adds no nodes and is inert — measured, not assumed.
 * Use this hook for any first-render portal regardless: the distinction is
 * too easy to lose the next time the children change.
 *
 * @param elementId Slot to portal into; omit for `document.body`.
 */

// The target never changes after mount, so nothing to subscribe to. Both
// snapshots below return stable DOM references, so React never re-renders in
// a loop.
const subscribe = () => () => {};

export function usePortalTarget(elementId?: string): HTMLElement | null {
  const getSnapshot = useCallback(
    () => (elementId ? document.getElementById(elementId) : document.body),
    [elementId],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
