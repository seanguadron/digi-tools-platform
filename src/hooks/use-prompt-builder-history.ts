"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  CardSystemState,
  PromptDraft,
} from "@/lib/prompt-builder-state";

type BuilderSnapshot = {
  draft: PromptDraft;
  cardSystem: CardSystemState;
};

const HISTORY_LIMIT = 100;

export function usePromptBuilderHistory({
  enabled,
  draft,
  cardSystem,
  setDraft,
  setCardSystem,
}: {
  enabled: boolean;
  draft: PromptDraft;
  cardSystem: CardSystemState;
  setDraft: Dispatch<SetStateAction<PromptDraft>>;
  setCardSystem: Dispatch<SetStateAction<CardSystemState>>;
}) {
  const pastRef = useRef<BuilderSnapshot[]>([]);
  const futureRef = useRef<BuilderSnapshot[]>([]);
  const latestRef = useRef<BuilderSnapshot>({ draft, cardSystem });
  const [counts, setCounts] = useState({ past: 0, future: 0 });

  useEffect(() => {
    latestRef.current = { draft, cardSystem };
  }, [cardSystem, draft]);

  const updateCounts = useCallback(() => {
    setCounts({
      past: pastRef.current.length,
      future: futureRef.current.length,
    });
  }, []);

  const checkpoint = useCallback(() => {
    if (!enabled) {
      return;
    }

    pastRef.current.push(latestRef.current);
    if (pastRef.current.length > HISTORY_LIMIT) {
      pastRef.current.shift();
    }
    futureRef.current = [];
    updateCounts();
  }, [enabled, updateCounts]);

  const applySnapshot = useCallback((snapshot: BuilderSnapshot) => {
    latestRef.current = snapshot;
    setDraft(snapshot.draft);
    setCardSystem(snapshot.cardSystem);
    updateCounts();
  }, [setCardSystem, setDraft, updateCounts]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) {
      return false;
    }

    futureRef.current.unshift(latestRef.current);
    applySnapshot(previous);
    return true;
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const next = futureRef.current.shift();
    if (!next) {
      return false;
    }

    pastRef.current.push(latestRef.current);
    applySnapshot(next);
    return true;
  }, [applySnapshot]);

  return useMemo(
    () => ({
      canUndo: enabled && counts.past > 0,
      canRedo: enabled && counts.future > 0,
      checkpoint,
      undo,
      redo,
    }),
    [checkpoint, counts.future, counts.past, enabled, redo, undo],
  );
}
