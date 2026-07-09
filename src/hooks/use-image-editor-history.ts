"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ImageDoc } from "@/lib/image-editor/types";

// Undo depth. Bitmaps are heavier than JSON, so this is lower than the
// Architect's (a full-layer copy-on-write snapshot can be several MB). Only the
// changed layer's bitmap is duplicated per edit; unchanged layers share refs.
const LIMIT = 32;

/**
 * Undo/redo over the whole document, mirroring use-architect-history:
 * checkpoint() is called *before* a mutation, snapshots are stored by reference
 * (the doc is immutable / copy-on-write), and an optional tag coalesces
 * consecutive edits that share it. Also exposes a reactive timeline (depth +
 * position) so a History panel can jump to any state.
 */
export function useImageEditorHistory({
  doc,
  setDoc,
}: {
  doc: ImageDoc | null;
  setDoc: Dispatch<SetStateAction<ImageDoc | null>>;
}) {
  const past = useRef<ImageDoc[]>([]);
  const future = useRef<ImageDoc[]>([]);
  const latest = useRef<ImageDoc | null>(doc);
  const lastTag = useRef<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // depth = total states in the timeline; position = index of the current one.
  const [depth, setDepth] = useState(1);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    latest.current = doc;
  }, [doc]);

  const sync = useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
    setDepth(past.current.length + future.current.length + 1);
    setPosition(past.current.length);
  }, []);

  const checkpoint = useCallback(
    (tag?: string) => {
      if (!latest.current) {
        return;
      }
      if (tag && tag === lastTag.current) {
        return;
      }
      past.current.push(latest.current);
      if (past.current.length > LIMIT) {
        past.current.shift();
      }
      future.current = [];
      lastTag.current = tag ?? null;
      sync();
    },
    [sync],
  );

  // Force the next checkpoint to start a new coalescing group.
  const seal = useCallback(() => {
    lastTag.current = null;
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) {
      return false;
    }
    if (latest.current) {
      future.current.push(latest.current);
    }
    latest.current = previous;
    lastTag.current = null;
    setDoc(previous);
    sync();
    return true;
  }, [setDoc, sync]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) {
      return false;
    }
    if (latest.current) {
      past.current.push(latest.current);
    }
    latest.current = next;
    lastTag.current = null;
    setDoc(next);
    sync();
    return true;
  }, [setDoc, sync]);

  // Jump to an absolute timeline position (History panel).
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

  // Drop all history (e.g. after New / Open replaces the document wholesale).
  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    lastTag.current = null;
    setCanUndo(false);
    setCanRedo(false);
    setDepth(1);
    setPosition(0);
  }, []);

  return {
    checkpoint,
    seal,
    undo,
    redo,
    jump,
    reset,
    canUndo,
    canRedo,
    depth,
    position,
  };
}
