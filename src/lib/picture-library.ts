"use client";

import { makeId, readStored, writeStored } from "@/lib/prompt-storage";
import type {
  PictureCardSystemState,
  PictureDraft,
} from "@/lib/picture-types";

const LIBRARY_KEY = "digitools.picture-deck.library-v1";
const LIBRARY_LIMIT = 50;

export type SavedPicturePrompt = {
  id: string;
  name: string;
  savedAt: string;
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
};

// Shape-check each stored entry: localStorage is user-editable, so a
// malformed entry must drop out on read instead of crashing the panel or the
// load path. Field types inside draft/cardSystem are coerced separately by
// restorePictureDraft/restorePictureCardSystem when an entry is loaded.
function isSavedPromptShape(entry: unknown): entry is SavedPicturePrompt {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<SavedPicturePrompt>;
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

export function listSavedPicturePrompts(): SavedPicturePrompt[] {
  const entries = readStored<SavedPicturePrompt[]>(LIBRARY_KEY, []);
  return Array.isArray(entries) ? entries.filter(isSavedPromptShape) : [];
}

export function saveToPictureLibrary(
  name: string,
  draft: PictureDraft,
  cardSystem: PictureCardSystemState,
): SavedPicturePrompt[] {
  const entry: SavedPicturePrompt = {
    id: makeId(),
    name: name.trim() || "Untitled prompt",
    savedAt: new Date().toISOString(),
    draft,
    cardSystem,
  };
  const next = [entry, ...listSavedPicturePrompts()].slice(0, LIBRARY_LIMIT);
  writeStored(LIBRARY_KEY, next);
  return next;
}

export function deleteFromPictureLibrary(id: string): SavedPicturePrompt[] {
  const next = listSavedPicturePrompts().filter((entry) => entry.id !== id);
  writeStored(LIBRARY_KEY, next);
  return next;
}
