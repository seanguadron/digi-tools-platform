"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useUndoableState } from "@/hooks/use-undoable-state";
import type { ImageDoc } from "@/lib/image-editor/types";

// Undo depth. Bitmaps are heavier than JSON, so this is lower than the
// Architect's (a full-layer copy-on-write snapshot can be several MB). Only the
// changed layer's bitmap is duplicated per edit; unchanged layers share refs.
const LIMIT = 32;

/**
 * Undo/redo over the whole document: checkpoint() is called *before* a
 * mutation, snapshots are stored by reference (the doc is immutable /
 * copy-on-write), and an optional tag coalesces consecutive edits that share
 * it. Also exposes a reactive timeline (depth + position) so a History panel
 * can jump to any state. Thin adapter over the shared useUndoableState.
 */
export function useImageEditorHistory({
  doc,
  setDoc,
}: {
  doc: ImageDoc | null;
  setDoc: Dispatch<SetStateAction<ImageDoc | null>>;
}) {
  return useUndoableState<ImageDoc | null>({
    value: doc,
    applySnapshot: setDoc,
    limit: LIMIT,
    isEmpty: useCallback((snapshot: ImageDoc | null) => snapshot === null, []),
  });
}
