"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useUndoableState } from "@/hooks/use-undoable-state";
import type {
  PictureCardSystemState,
  PictureDraft,
} from "@/lib/picture-types";

type DeckSnapshot = {
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
};

const HISTORY_LIMIT = 100;

// Composite draft+cards history so one undo step restores both atomically.
// Thin adapter over the shared useUndoableState, mirroring the CRAFT deck.
export function usePictureDeckHistory({
  enabled,
  draft,
  cardSystem,
  setDraft,
  setCardSystem,
}: {
  enabled: boolean;
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
  setDraft: Dispatch<SetStateAction<PictureDraft>>;
  setCardSystem: Dispatch<SetStateAction<PictureCardSystemState>>;
}) {
  const snapshot = useMemo(
    () => ({ draft, cardSystem }),
    [cardSystem, draft],
  );

  const applySnapshot = useCallback(
    (next: DeckSnapshot) => {
      setDraft(next.draft);
      setCardSystem(next.cardSystem);
    },
    [setCardSystem, setDraft],
  );

  const { canUndo, canRedo, checkpoint, undo, redo } =
    useUndoableState<DeckSnapshot>({
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
