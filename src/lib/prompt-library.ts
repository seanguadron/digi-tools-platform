"use client";

import { makeId, readStored, writeStored } from "@/lib/prompt-storage";
import type {
  CardSystemState,
  PromptDraft,
} from "@/lib/prompt-builder-state";

const LIBRARY_KEY = "digitools.prompt-builder.library-v1";
const LIBRARY_LIMIT = 50;

export type SavedPrompt = {
  id: string;
  name: string;
  savedAt: string;
  draft: PromptDraft;
  cardSystem: CardSystemState;
};

export function listSavedPrompts(): SavedPrompt[] {
  const entries = readStored<SavedPrompt[]>(LIBRARY_KEY, []);
  return Array.isArray(entries) ? entries : [];
}

export function saveToLibrary(
  name: string,
  draft: PromptDraft,
  cardSystem: CardSystemState,
): SavedPrompt[] {
  const entry: SavedPrompt = {
    id: makeId(),
    name: name.trim() || "Untitled prompt",
    savedAt: new Date().toISOString(),
    draft,
    cardSystem,
  };
  const next = [entry, ...listSavedPrompts()].slice(0, LIBRARY_LIMIT);
  writeStored(LIBRARY_KEY, next);
  return next;
}

export function deleteFromLibrary(id: string): SavedPrompt[] {
  const next = listSavedPrompts().filter((entry) => entry.id !== id);
  writeStored(LIBRARY_KEY, next);
  return next;
}
