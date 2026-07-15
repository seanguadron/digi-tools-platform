"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useUndoableState } from "@/hooks/use-undoable-state";
import type {
  CardSystemState,
  PromptDraft,
} from "@/lib/prompt-builder-state";

type BuilderSnapshot = {
  draft: PromptDraft;
  cardSystem: CardSystemState;
};

const HISTORY_LIMIT = 100;

// Composite draft+cards history so one undo step restores both atomically.
// Thin adapter over the shared useUndoableState.
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
  const snapshot = useMemo(
    () => ({ draft, cardSystem }),
    [cardSystem, draft],
  );

  const applySnapshot = useCallback(
    (next: BuilderSnapshot) => {
      setDraft(next.draft);
      setCardSystem(next.cardSystem);
    },
    [setCardSystem, setDraft],
  );

  const { canUndo, canRedo, checkpoint, undo, redo } =
    useUndoableState<BuilderSnapshot>({
      value: snapshot,
      applySnapshot,
      limit: HISTORY_LIMIT,
      enabled,
    });

  return useMemo(
    () => ({ canUndo, canRedo, checkpoint, undo, redo }),
    [canRedo, canUndo, checkpoint, redo, undo],
  );
}
