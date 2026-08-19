import galleryData from "@/data/picture-deck/art-themes/gallery.json";
import { artPackEntry } from "../../scripts/art-pack.mjs";
import type { ArtPackFile, ResolvedArt } from "../../scripts/art-pack.mjs";

// The PICTURE deck's door onto its art pack. One pack, by design: every card
// teaches an image-making technique, so its art IS a demonstration of that
// technique - there is no second world to reskin into, and therefore no
// picker and no mutable active-pack seam. This is art-pack.ts minus the
// switching machinery.

export type { ResolvedArt };

const pack = galleryData as ArtPackFile;

export function pictureArtFor(key: string): ResolvedArt | undefined {
  return artPackEntry(pack, key);
}

export function pictureLineageArt(lineageId: string) {
  return pictureArtFor(`lineages.${lineageId}`);
}

/** The guide page's P.I.C.T.U.R.E. acronym cards. */
export function pictureLetterArt(letter: string) {
  return pictureArtFor(`craft.${letter}`);
}

export function pictureGradeArt(lineageId: string, index: number) {
  return pictureArtFor(`grades.${lineageId}[${index}]`);
}

export function pictureArchetypeArt(archetypeId: string) {
  return pictureArtFor(`archetypes.${archetypeId}`);
}

export function pictureSharedArt(key: string) {
  return pictureArtFor(`shared.${key}`);
}

/**
 * A card face at a grade. A grade only overrides its lineage once that
 * grade's own art exists, so the deck stays fully illustrated while the
 * per-grade variants are still generating.
 */
export function pictureCardArt(lineageId: string, gradeIndex: number | null) {
  if (gradeIndex !== null) {
    const grade = pictureGradeArt(lineageId, gradeIndex);
    if (grade?.status === "generated") {
      return grade;
    }
  }
  return pictureLineageArt(lineageId);
}

/**
 * Archetypes a player saved themselves have no pack entry - they are made at
 * runtime, not authored - so they fall back to the pack's shared preset
 * swatch.
 */
export function pictureArchetypeArtWithFallback(archetypeId: string) {
  return pictureArchetypeArt(archetypeId) ?? pictureSharedArt("custom-preset");
}
