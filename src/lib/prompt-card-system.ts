// CRAFT-deck instance of the generic card engine. This module binds the
// prompt-builder catalogs to src/lib/card-engine.ts and re-exports the bound
// members under the names the rest of the CRAFT surface has always imported —
// consumers of this module are unaffected by the extraction.
import cardsData from "@/data/prompt-builder/cards.json";
import formatsData from "@/data/prompt-builder/formats.json";
import tracksData from "@/data/prompt-builder/tracks.json";
import { cardArt, lineageArt } from "@/lib/art-pack";
import { createCardEngine } from "@/lib/card-engine";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import type {
  CardLineage,
  CardSection,
  CardsCatalog,
  FormatsCatalog,
  TrackId,
  TracksCatalog,
  TrackValues,
} from "@/lib/prompt-types";

export type {
  CardLineage,
  CardSection,
  TrackDefinition,
  TrackId,
  TrackValues,
} from "@/lib/prompt-types";

export const CARD_SECTIONS: readonly CardSection[] = [
  "context",
  "action",
  "format",
  "target",
];
export const TRACK_IDS: readonly TrackId[] = [
  "contextDepth",
  "evidenceRigor",
  "autonomy",
  "challenge",
  "outputDetail",
  "structure",
  "audienceExpertise",
  "voiceFormality",
];

const cardsCatalog = cardsData as CardsCatalog;
const formatsCatalog = formatsData as FormatsCatalog;
const tracksCatalog = tracksData as TracksCatalog;

export function getCardFamily(section: CardSection): "Tactic" | "Modifier" {
  return section === "action" ? "Tactic" : "Modifier";
}

export const craftCardEngine = createCardEngine<
  CardSection,
  TrackId,
  CardLineage
>({
  sections: CARD_SECTIONS,
  trackIds: TRACK_IDS,
  cards: cardsCatalog.cards,
  sectionTracks: tracksCatalog.sectionTracks,
  slotBudgets: tracksCatalog.slotBudgets,
  trackDefinitions: tracksCatalog.definitions,
  defaultTrackValues: tracksCatalog.defaultValues,
  vocabulary: tracksCatalog.vocabulary,
  cardFamily: getCardFamily,
  // This deck's pictures and bios come from the active art pack rather than
  // from the catalog, so a second world can be dropped in beside the first.
  cardArt: (lineage, gradeIndex) => cardArt(lineage.id, gradeIndex),
  cardBio: (lineage) => lineageArt(lineage.id)?.bio,
});

export const SECTION_TRACKS = tracksCatalog.sectionTracks;
export const SECTION_SLOT_BUDGETS = tracksCatalog.slotBudgets;
export const DEFAULT_TRACK_VALUES = tracksCatalog.defaultValues;

export function getFormatCode(formatValue: string) {
  return (
    FORMAT_OPTIONS.find((option) => option.value === formatValue)?.code ?? "LIST"
  );
}

export function getRecommendedTrackValues(formatCode: string): TrackValues {
  return {
    ...(formatsCatalog.recommendedTracks[formatCode] ?? DEFAULT_TRACK_VALUES),
  };
}

export const getTrackDefinition = craftCardEngine.getTrackDefinition;
export const getTrackMax = craftCardEngine.getTrackMax;
export const getSectionConfigurationKey =
  craftCardEngine.getSectionConfigurationKey;
export const isLineageCompatible = craftCardEngine.isLineageCompatible;
export const getSectionDeck = craftCardEngine.getSectionDeck;
export const getCardGrade = craftCardEngine.getCardGrade;
export const getLineage = craftCardEngine.getLineage;
export const getEquippedInstructions = craftCardEngine.getEquippedInstructions;
export const sanitizeCardSystemShape = craftCardEngine.sanitizeCardSystemShape;
