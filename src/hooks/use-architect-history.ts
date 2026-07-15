"use client";

import type { Dispatch, SetStateAction } from "react";
import { useUndoableState } from "@/hooks/use-undoable-state";
import type { ArchitectProject } from "@/lib/architect/types";

const LIMIT = 120;

/**
 * Undo/redo over the whole project. checkpoint() is called *before* a mutation.
 * An optional tag coalesces consecutive edits that share it — so typing into one
 * field is a single undo step, while each structural op (add/delete/move/connect)
 * is its own. Project updates are immutable, so snapshots can be stored by ref.
 * Thin adapter over the shared useUndoableState.
 */
export function useArchitectHistory({
  project,
  setProject,
}: {
  project: ArchitectProject;
  setProject: Dispatch<SetStateAction<ArchitectProject>>;
}) {
  const { checkpoint, undo, redo, canUndo, canRedo } =
    useUndoableState<ArchitectProject>({
      value: project,
      applySnapshot: setProject,
      limit: LIMIT,
    });

  return { checkpoint, undo, redo, canUndo, canRedo };
}
