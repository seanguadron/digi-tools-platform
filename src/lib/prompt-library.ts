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

// Shape-check each stored entry: localStorage is user-editable, so a
// malformed entry must drop out on read instead of crashing the panel or the
// load path. Field types inside draft/cardSystem are coerced separately by
// restoreDraft/restoreCardSystem when an entry is loaded.
function isSavedPromptShape(entry: unknown): entry is SavedPrompt {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<SavedPrompt>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.draft === "object" &&
    candidate.draft !== null &&
    typeof candidate.cardSystem === "object" &&
    candidate.cardSystem !== null
  );
}

export function listSavedPrompts(): SavedPrompt[] {
  const entries = readStored<SavedPrompt[]>(LIBRARY_KEY, []);
  return Array.isArray(entries) ? entries.filter(isSavedPromptShape) : [];
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
