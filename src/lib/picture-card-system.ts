// PICTURE-deck instance of the generic card engine: binds the picture-deck
// catalogs and names the bound members in this deck's vocabulary. The panel
// list itself lives in picture-prompt.ts (alias-free) so the merge module and
// its tests never touch JSON.
import cardsData from "@/data/picture-deck/cards.json";
import tracksData from "@/data/picture-deck/tracks.json";
import { createCardEngine } from "@/lib/card-engine";
import { pictureCardArt, pictureLineageArt } from "@/lib/picture-art-pack";
import { PICTURE_SECTIONS } from "@/lib/picture-prompt";
import type { PictureSection } from "@/lib/picture-prompt";
import type {
  PictureCardLineage,
  PictureCardsCatalog,
  PictureTrackId,
  PictureTracksCatalog,
} from "@/lib/picture-types";

export const PICTURE_TRACK_IDS: readonly PictureTrackId[] = ["intensity"];

const cardsCatalog = cardsData as PictureCardsCatalog;
const tracksCatalog = tracksData as PictureTracksCatalog;

// Card-family label per panel: what the topline of a card face reads.
const SECTION_FAMILIES: Record<PictureSection, string> = {
  protagonist: "Subject",
  illumination: "Light",
  canvas: "Medium",
  tone: "Palette",
  universe: "World",
  references: "Reference",
  execution: "Finish",
};

export function getPictureCardFamily(section: PictureSection): string {
  return SECTION_FAMILIES[section];
}

export const pictureCardEngine = createCardEngine<
  PictureSection,
  PictureTrackId,
  PictureCardLineage
>({
  sections: PICTURE_SECTIONS,
  trackIds: PICTURE_TRACK_IDS,
  cards: cardsCatalog.cards,
  sectionTracks: tracksCatalog.sectionTracks,
  slotBudgets: tracksCatalog.slotBudgets,
  trackDefinitions: tracksCatalog.definitions,
  defaultTrackValues: tracksCatalog.defaultValues,
  cardFamily: getPictureCardFamily,
  // Art and flavor live in the gallery pack, resolved at render time - the
  // same seam the CRAFT deck uses, minus the world switch.
  cardArt: (lineage, gradeIndex) => pictureCardArt(lineage.id, gradeIndex),
  cardBio: (lineage) => pictureLineageArt(lineage.id)?.bio,
});

export const PICTURE_SLOT_BUDGETS = tracksCatalog.slotBudgets;
export const PICTURE_DEFAULT_TRACK_VALUES = tracksCatalog.defaultValues;

// The equipped cards' grade instructions per section — the fragments the
// picture-prompt merge joins into the one-line prompt.
export const getEquippedFragments = pictureCardEngine.getEquippedInstructions;
