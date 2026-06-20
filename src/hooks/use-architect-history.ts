"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ArchitectProject } from "@/lib/architect/types";

const LIMIT = 120;

/**
 * Undo/redo over the whole project. checkpoint() is called *before* a mutation.
 * An optional tag coalesces consecutive edits that share it — so typing into one
 * field is a single undo step, while each structural op (add/delete/move/connect)
 * is its own. Project updates are immutable, so snapshots can be stored by ref.
 */
export function useArchitectHistory({
  project,
  setProject,
}: {
  project: ArchitectProject;
  setProject: Dispatch<SetStateAction<ArchitectProject>>;
}) {
  const past = useRef<ArchitectProject[]>([]);
  const future = useRef<ArchitectProject[]>([]);
  const latest = useRef(project);
  const lastTag = useRef<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    latest.current = project;
  }, [project]);

  const checkpoint = useCallback((tag?: string) => {
    if (tag && tag === lastTag.current) {
      return;
    }
    past.current.push(latest.current);
    if (past.current.length > LIMIT) {
      past.current.shift();
    }
    future.current = [];
    lastTag.current = tag ?? null;
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) {
      return false;
    }
    future.current.push(latest.current);
    latest.current = previous;
    lastTag.current = null;
    setProject(previous);
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    return true;
  }, [setProject]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) {
      return false;
    }
    past.current.push(latest.current);
    latest.current = next;
    lastTag.current = null;
    setProject(next);
    setCanRedo(future.current.length > 0);
    setCanUndo(true);
    return true;
  }, [setProject]);

  return { checkpoint, undo, redo, canUndo, canRedo };
}
