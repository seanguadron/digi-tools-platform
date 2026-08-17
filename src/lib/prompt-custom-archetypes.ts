"use client";

import { makeId, readStored, writeStored } from "@/lib/prompt-storage";
import type { CardSystemState } from "@/lib/prompt-builder-state";
import type { PromptArchetype } from "@/lib/prompt-archetypes";

const CUSTOM_KEY = "digitools.prompt-builder.custom-archetypes-v1";
const CUSTOM_LIMIT = 24;

export const CUSTOM_ARCHETYPE_PREFIX = "custom-";

export function isCustomArchetype(archetype: PromptArchetype): boolean {
  return archetype.id.startsWith(CUSTOM_ARCHETYPE_PREFIX);
}

// Shape-check each stored preset: localStorage is user-editable, and these
// entries feed rendering (name, code, effects), the export filename chain,
// and the audience default line. Tracks/equipped stay loosely typed here —
// applyArchetype runs them through sanitizeCardSystemShape.
function isStoredArchetypeShape(entry: unknown): entry is PromptArchetype {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<PromptArchetype>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.formatCode === "string" &&
    Array.isArray(candidate.roleIds) &&
    (candidate.equipped === undefined ||
      (typeof candidate.equipped === "object" &&
        candidate.equipped !== null)) &&
    Array.isArray(candidate.effects) &&
    candidate.effects.every((effect) => typeof effect === "string") &&
    (candidate.action === undefined || typeof candidate.action === "string") &&
    (candidate.formatNotes === undefined ||
      typeof candidate.formatNotes === "string") &&
    (candidate.defaultAudience === undefined ||
      typeof candidate.defaultAudience === "string")
  );
}

export function listCustomArchetypes(): PromptArchetype[] {
  const entries = readStored<PromptArchetype[]>(CUSTOM_KEY, []);
  return Array.isArray(entries) ? entries.filter(isStoredArchetypeShape) : [];
}

export function buildCustomArchetype(
  name: string,
  formatCode: string,
  roleIds: readonly string[],
  action: string,
  formatNotes: string,
  cardSystem: CardSystemState,
): PromptArchetype {
  const equipped = {
    context: cardSystem.equipped.context.filter(Boolean),
    action: cardSystem.equipped.action.filter(Boolean),
    format: cardSystem.equipped.format.filter(Boolean),
    target: cardSystem.equipped.target.filter(Boolean),
  };
  const supportCount = Object.values(equipped).reduce(
    (total, cards) => total + cards.length,
    0,
  );
  const roles = roleIds.slice(0, 3);
  const cleanName = name.trim() || "My preset";
  const code =
    cleanName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "MINE";

  return {
    id: `${CUSTOM_ARCHETYPE_PREFIX}${makeId()}`,
    code,
    name: cleanName,
    description: "Your saved roles, tracks, and cards.",
    formatCode,
    roleIds: roles,
    tracks: { ...cardSystem.tracks },
    equipped,
    action,
    formatNotes,
    effects: [
      `Sets ${formatCode} as the base output type.`,
      `Loads ${roles.length} role ${
        roles.length === 1 ? "card" : "cards"
      } and ${supportCount} support ${
        supportCount === 1 ? "card" : "cards"
      }.`,
      "Preserves the user's Context and Target writing fields.",
    ],
    // No illustration: a saved preset has no pack entry of its own, so it
    // borrows the pack's shared preset swatch at render time. Storing a path
    // here would freeze one world's art into a saved preset forever.
  };
}

export function saveCustomArchetype(
  archetype: PromptArchetype,
): PromptArchetype[] {
  const next = [archetype, ...listCustomArchetypes()].slice(0, CUSTOM_LIMIT);
  writeStored(CUSTOM_KEY, next);
  return next;
}

export function deleteCustomArchetype(id: string): PromptArchetype[] {
  const next = listCustomArchetypes().filter(
    (archetype) => archetype.id !== id,
  );
  writeStored(CUSTOM_KEY, next);
  return next;
}
