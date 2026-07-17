"use client";

import { useCallback, useSyncExternalStore } from "react";

// Session-scoped "Preview anyway" override for mobile-gated tools
// (docs/ARCHITECTURE.md §2). The value lives in sessionStorage under
// digitools.mobile-preview.<toolId>; a module-level emitter covers same-tab
// writes (the storage event only fires across tabs), and an in-memory set
// keeps the override working for the page when storage is refused.
const listeners = new Set<() => void>();
const memoryOverrides = new Set<string>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function storageKey(toolId: string) {
  return `digitools.mobile-preview.${toolId}`;
}

function readOverride(toolId: string | null): boolean {
  if (!toolId) {
    return false;
  }
  if (memoryOverrides.has(toolId)) {
    return true;
  }
  try {
    return sessionStorage.getItem(storageKey(toolId)) === "1";
  } catch {
    return false;
  }
}

export function useMobilePreviewOverride(toolId: string | null) {
  const overridden = useSyncExternalStore(
    subscribe,
    () => readOverride(toolId),
    () => false,
  );

  const override = useCallback(() => {
    if (!toolId) {
      return;
    }
    memoryOverrides.add(toolId);
    try {
      sessionStorage.setItem(storageKey(toolId), "1");
    } catch {
      // Storage refusal only costs persistence across reloads; the
      // in-memory override above still applies for this page.
    }
    emit();
  }, [toolId]);

  return { overridden, override };
}
