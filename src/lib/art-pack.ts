import packData from "@/data/prompt-builder/art-themes/sci-fi.json";
import { artPackEntry } from "../../scripts/art-pack.mjs";
import type { ArtPackFile, ResolvedArt } from "../../scripts/art-pack.mjs";

// The app's door onto the active art pack.
//
// A card's mechanics live in the catalog and are the same in every world; its
// picture and its character bio live in a pack and change with the world. This
// module is the only place the app decides WHICH pack is showing, so adding a
// picker later means changing one constant rather than hunting imports.
//
// Path derivation and the entry shape live in scripts/art-pack.mjs so plain
// `node` (the data scripts) and the browser share one implementation.

export type { ResolvedArt };

/**
 * The parts of a resolved image the card chrome actually reads. Both a pack
 * entry and the PICTURE deck's inline illustrations satisfy it, which is what
 * lets one card face serve both decks.
 */
export type CardArtRef = {
  src: string;
  status: "planned" | "generated";
};

const pack = packData as ArtPackFile;

export const ACTIVE_ART_PACK = {
  id: pack.theme.id,
  name: pack.theme.name,
} as const;

export function artFor(key: string): ResolvedArt | undefined {
  return artPackEntry(pack, key);
}

export function roleArt(roleId: string) {
  return artFor(`roles.${roleId}`);
}

export function lineageArt(lineageId: string) {
  return artFor(`lineages.${lineageId}`);
}

export function gradeArt(lineageId: string, index: number) {
  return artFor(`grades.${lineageId}[${index}]`);
}

export function archetypeArt(archetypeId: string) {
  return artFor(`archetypes.${archetypeId}`);
}

export function sharedArt(key: string) {
  return artFor(`shared.${key}`);
}

/**
 * A lineage card's face. A grade only overrides its lineage once that grade's
 * own art exists, so a deck with lineage art and no grade art is still fully
 * illustrated rather than half empty.
 */
export function cardArt(lineageId: string, gradeIndex: number | null) {
  if (gradeIndex !== null) {
    const grade = gradeArt(lineageId, gradeIndex);
    if (grade?.status === "generated") {
      return grade;
    }
  }
  return lineageArt(lineageId);
}

/**
 * Archetypes a player saved themselves have no pack entry - they are made at
 * runtime, not authored - so they fall back to the pack's shared preset swatch.
 */
export function archetypeArtWithFallback(archetypeId: string) {
  return archetypeArt(archetypeId) ?? sharedArt("custom-preset");
}
