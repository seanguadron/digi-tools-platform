"use client";

import { useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/lib/save-status";

// A restore's outcome. `null` means the run was cancelled (e.g. StrictMode
// double-mount or unmount mid-await): nothing is committed and the ready gate
// stays closed for that run.
export type LocalDraftRestoreResult = {
  status: SaveStatus;
  savedAt?: Date | null;
} | null;

export type LocalDraftOptions<T> = {
  // The persisted value; the save effect re-runs when its identity changes
  // (adapters memoize composite values).
  value: T;
  // Runs once per effect-mount, deferred one tick. May be async; check
  // ctx.isCancelled() after awaits before touching state.
  restore: (ctx: {
    isCancelled: () => boolean;
  }) => LocalDraftRestoreResult | Promise<LocalDraftRestoreResult>;
  // Writes the value. Return "large" to skip the write on a size budget;
  // throw for storage failure (maps to "unavailable"). Keys and byte formats
  // stay inside the adapter (docs/ARCHITECTURE.md §6).
  save: (value: T, savedAt: Date) => "saved" | "large";
  // When false, the save effect does nothing for this value (e.g. null doc).
  canSave?: (value: T) => boolean;
  // 0 (default): write synchronously in the effect and commit status one tick
  // later (cancellable). >0: defer the whole save by this many milliseconds.
  debounceMs?: number;
};

export function useLocalDraft<T>({
  value,
  restore,
  save,
  canSave,
  debounceMs = 0,
}: LocalDraftOptions<T>) {
  const restoredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("restoring");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let result: LocalDraftRestoreResult;
      try {
        result = await restore({ isCancelled: () => cancelled });
      } catch {
        result = { status: "unavailable" };
      }
      if (cancelled || result === null) {
        return;
      }
      if (result.savedAt) {
        setLastSavedAt(result.savedAt);
      }
      setStatus(result.status);
      restoredRef.current = true;
      setReady(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [restore]);

  useEffect(() => {
    if (!restoredRef.current) {
      return;
    }
    if (canSave && !canSave(value)) {
      return;
    }

    let timer: number | null = null;

    const commit = (outcome: SaveStatus, savedAt: Date | null) => {
      if (outcome === "saved" && savedAt) {
        setLastSavedAt(savedAt);
      }
      setStatus(outcome);
    };

    if (debounceMs > 0) {
      timer = window.setTimeout(() => {
        const savedAt = new Date();
        try {
          commit(save(value, savedAt), savedAt);
        } catch {
          commit("unavailable", null);
        }
      }, debounceMs);
    } else {
      // Write now; commit the status one tick later so an unmount between
      // render and commit never strands a state update.
      const savedAt = new Date();
      let outcome: SaveStatus;
      try {
        outcome = save(value, savedAt);
      } catch {
        outcome = "unavailable";
      }
      timer = window.setTimeout(() => commit(outcome, savedAt), 0);
    }

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [canSave, debounceMs, save, value]);

  return { ready, status, lastSavedAt };
}
