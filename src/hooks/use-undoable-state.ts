"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UndoableStateOptions<T> = {
  // The live value; mirrored into a ref so checkpoint() captures the state
  // as it was *before* the mutation that follows it.
  value: T;
  // Applies a snapshot back to the owning state (may fan out to several setters).
  applySnapshot: (snapshot: T) => void;
  // Max past states retained; oldest are dropped first.
  limit: number;
  // When false, checkpoint() no-ops and the flags read false; stacks are kept.
  enabled?: boolean;
  // Snapshots for which true is returned are never recorded or re-pushed
  // (e.g. a null document before New/Open).
  isEmpty?: (value: T) => boolean;
};

export type UndoableState = {
  canUndo: boolean;
  canRedo: boolean;
  // depth = total states in the timeline; position = index of the current one.
  depth: number;
  position: number;
  // Record the CURRENT value before a mutation. Equal consecutive tags coalesce.
  checkpoint: (tag?: string) => void;
  // Force the next checkpoint to start a new coalescing group.
  seal: () => void;
  undo: () => boolean;
  redo: () => boolean;
  // Jump to an absolute timeline position (history panels).
  jump: (target: number) => void;
  // Drop all history (e.g. after New/Open replaces the state wholesale).
  reset: () => void;
};

export function useUndoableState<T>({
  value,
  applySnapshot,
  limit,
  enabled = true,
  isEmpty,
}: UndoableStateOptions<T>): UndoableState {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const latest = useRef<T>(value);
  const lastTag = useRef<string | null>(null);
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  const [depth, setDepth] = useState(1);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  const empty = useCallback(
    (snapshot: T) => (isEmpty ? isEmpty(snapshot) : false),
    [isEmpty],
  );

  const sync = useCallback(() => {
    setCanUndoState(past.current.length > 0);
    setCanRedoState(future.current.length > 0);
    setDepth(past.current.length + future.current.length + 1);
    setPosition(past.current.length);
  }, []);

  const checkpoint = useCallback(
    (tag?: string) => {
      if (!enabled) {
        return;
      }
      if (empty(latest.current)) {
        return;
      }
      if (tag && tag === lastTag.current) {
        return;
      }
      past.current.push(latest.current);
      if (past.current.length > limit) {
        past.current.shift();
      }
      future.current = [];
      lastTag.current = tag ?? null;
      sync();
    },
    [empty, enabled, limit, sync],
  );

  const seal = useCallback(() => {
    lastTag.current = null;
  }, []);

  const apply = useCallback(
    (snapshot: T) => {
      latest.current = snapshot;
      applySnapshot(snapshot);
    },
    [applySnapshot],
  );

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) {
      return false;
    }
    if (!empty(latest.current)) {
      future.current.push(latest.current);
    }
    lastTag.current = null;
    apply(previous);
    sync();
    return true;
  }, [apply, empty, sync]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) {
      return false;
    }
    if (!empty(latest.current)) {
      past.current.push(latest.current);
    }
    lastTag.current = null;
    apply(next);
    sync();
    return true;
  }, [apply, empty, sync]);

  const jump = useCallback(
    (target: number) => {
      while (past.current.length > target) {
        if (!undo()) {
          break;
        }
      }
      while (past.current.length < target) {
        if (!redo()) {
          break;
        }
      }
    },
    [undo, redo],
  );

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    lastTag.current = null;
    setCanUndoState(false);
    setCanRedoState(false);
    setDepth(1);
    setPosition(0);
  }, []);

  return useMemo(
    () => ({
      canUndo: enabled && canUndoState,
      canRedo: enabled && canRedoState,
      depth,
      position,
      checkpoint,
      seal,
      undo,
      redo,
      jump,
      reset,
    }),
    [
      canRedoState,
      canUndoState,
      checkpoint,
      depth,
      enabled,
      jump,
      position,
      redo,
      reset,
      seal,
      undo,
    ],
  );
}
