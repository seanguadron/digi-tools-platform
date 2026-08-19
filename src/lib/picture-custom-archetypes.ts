"use client";

import { makeId, readStored, writeStored } from "@/lib/prompt-storage";
import { PICTURE_SECTIONS } from "@/lib/picture-prompt";
import type {
  PictureArchetype,
  PictureCardSystemState,
  PictureDraft,
} from "@/lib/picture-types";

const CUSTOM_KEY = "digitools.picture-deck.custom-archetypes-v1";
const CUSTOM_LIMIT = 24;

export const CUSTOM_ARCHETYPE_PREFIX = "custom-";

export function isCustomPictureArchetype(archetype: PictureArchetype): boolean {
  return archetype.id.startsWith(CUSTOM_ARCHETYPE_PREFIX);
}

// Shape-check each stored preset: localStorage is user-editable, and these
// entries feed rendering (name, code, effects) and the export filename chain.
// Tracks/equipped stay loosely typed here — applying a preset runs them
// through the engine's sanitizeCardSystemShape, and tail numbers go through
// the range clamp in picture-deck-state.
function isStoredArchetypeShape(entry: unknown): entry is PictureArchetype {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<PictureArchetype>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.tracks === "object" &&
    candidate.tracks !== null &&
    (candidate.equipped === undefined ||
      (typeof candidate.equipped === "object" &&
        candidate.equipped !== null)) &&
    Array.isArray(candidate.effects) &&
    candidate.effects.every((effect) => typeof effect === "string") &&
    (candidate.mjTail === undefined ||
      (typeof candidate.mjTail === "object" && candidate.mjTail !== null))
  );
}

export function listCustomPictureArchetypes(): PictureArchetype[] {
  const entries = readStored<PictureArchetype[]>(CUSTOM_KEY, []);
  return Array.isArray(entries) ? entries.filter(isStoredArchetypeShape) : [];
}

const INTENSITY_LABELS = ["Subtle", "Bold", "Extreme"];

export function buildCustomPictureArchetype(
  name: string,
  draft: PictureDraft,
  cardSystem: PictureCardSystemState,
): PictureArchetype {
  const equipped: Partial<Record<(typeof PICTURE_SECTIONS)[number], string[]>> =
    {};
  let cardCount = 0;
  for (const section of PICTURE_SECTIONS) {
    const ids = cardSystem.equipped[section].filter(Boolean);
    if (ids.length > 0) {
      equipped[section] = ids;
      cardCount += ids.length;
    }
  }

  const cleanName = name.trim() || "My preset";
  const code =
    cleanName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "MINE";
  const intensityLabel =
    INTENSITY_LABELS[cardSystem.tracks.intensity] ?? "Bold";

  return {
    id: `${CUSTOM_ARCHETYPE_PREFIX}${makeId()}`,
    code,
    name: cleanName,
    description: "Your saved cards, intensity, and tail preset.",
    tracks: { ...cardSystem.tracks },
    equipped,
    mjTail: draft.mjTailEnabled
      ? {
          aspectRatio: draft.aspectRatio,
          ...(draft.stylize !== null ? { stylize: draft.stylize } : {}),
          ...(draft.chaos !== null ? { chaos: draft.chaos } : {}),
          ...(draft.weird !== null ? { weird: draft.weird } : {}),
          ...(draft.negative.trim() ? { negative: draft.negative } : {}),
        }
      : undefined,
    effects: [
      `Loads ${cardCount} equipped ${cardCount === 1 ? "card" : "cards"} at ${intensityLabel} intensity.`,
      draft.mjTailEnabled
        ? `Sets the Midjourney tail preset to ${draft.aspectRatio}.`
        : "Leaves the Midjourney tail off.",
      "Preserves your subject line.",
    ],
  };
}

export function saveCustomPictureArchetype(
  archetype: PictureArchetype,
): PictureArchetype[] {
  const next = [archetype, ...listCustomPictureArchetypes()].slice(
    0,
    CUSTOM_LIMIT,
  );
  writeStored(CUSTOM_KEY, next);
  return next;
}

export function deleteCustomPictureArchetype(id: string): PictureArchetype[] {
  const next = listCustomPictureArchetypes().filter(
    (archetype) => archetype.id !== id,
  );
  writeStored(CUSTOM_KEY, next);
  return next;
}
