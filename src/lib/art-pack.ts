import sciFiData from "@/data/prompt-builder/art-themes/sci-fi.json";
import fantasyData from "@/data/prompt-builder/art-themes/fantasy.json";
import superheroData from "@/data/prompt-builder/art-themes/superhero.json";
import { artPackEntry } from "../../scripts/art-pack.mjs";
import type { ArtPackFile, ResolvedArt } from "../../scripts/art-pack.mjs";

// The app's door onto the active art pack.
//
// A card's mechanics live in the catalog and are the same in every world; its
// picture and its character bio live in a pack and change with the world.
// This module is still the only place the app decides WHICH pack is showing —
// it just holds all three worlds now and lets the deck's picker flip between
// them. Every resolver reads the active pack at CALL time, and art/bio flow
// through render-time callbacks everywhere, so a switch needs nothing but a
// re-render: no reload, no refetch, no per-component wiring.
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

const PACKS = [
  sciFiData as ArtPackFile,
  fantasyData as ArtPackFile,
  superheroData as ArtPackFile,
];

/** The worlds the picker offers, in display order. */
export const ART_PACK_OPTIONS = PACKS.map((candidate) => ({
  id: candidate.theme.id,
  name: candidate.theme.name,
}));

let activePack = PACKS[0];

/** True only for the id of a pack this build actually ships. localStorage is
 *  user-editable, so a restored value must pass this before it is trusted. */
export function isArtPackId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    PACKS.some((candidate) => candidate.theme.id === value)
  );
}

export function getActiveArtPackId() {
  return activePack.theme.id;
}

/**
 * Point every resolver at another world. Returns whether anything changed;
 * the caller owns triggering the re-render (the deck keeps the active id in
 * state for exactly that reason).
 */
export function setActiveArtPack(id: string): boolean {
  const next = PACKS.find((candidate) => candidate.theme.id === id);
  if (!next || next === activePack) {
    return false;
  }
  activePack = next;
  return true;
}

export function artFor(key: string): ResolvedArt | undefined {
  return artPackEntry(activePack, key);
}

/**
 * Resolve from a NAMED pack rather than the active one. The guide's world
 * cards use this: each shows its own world's art regardless of which world
 * is currently selected.
 */
export function packArtFor(packId: string, key: string) {
  const pack = PACKS.find((candidate) => candidate.theme.id === packId);
  return pack ? artPackEntry(pack, key) : undefined;
}

export function roleArt(roleId: string) {
  return artFor(`roles.${roleId}`);
}

/** The guide page's C.R.A.F.T. acronym cards, in the active world's art. */
export function craftLetterArt(letter: string) {
  return artFor(`craft.${letter}`);
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
