import cardsData from "@/data/prompt-builder/cards.json";
import formatsData from "@/data/prompt-builder/formats.json";
import tracksData from "@/data/prompt-builder/tracks.json";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import type {
  CardLineage,
  CardSection,
  CardsCatalog,
  FormatsCatalog,
  TrackDefinition,
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
const trackDefinitions = new Map<TrackId, TrackDefinition>(
  tracksCatalog.definitions.map((definition) => [
    definition.id,
    definition,
  ]),
);

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

export function getTrackDefinition(trackId: TrackId, formatCode: string) {
  const definition = trackDefinitions.get(trackId);
  if (!definition) {
    throw new Error(`Unknown prompt track: ${trackId}`);
  }

  const vocabulary = tracksCatalog.vocabulary[formatCode]?.[trackId];

  return vocabulary ? { ...definition, points: vocabulary } : definition;
}

export function getSectionConfigurationKey(
  section: CardSection,
  values: TrackValues,
) {
  return SECTION_TRACKS[section]
    .map((trackId) => `${trackId}:${values[trackId]}`)
    .join("|");
}

export function isLineageCompatible(
  lineage: CardLineage,
  values: TrackValues,
) {
  return TRACK_IDS.every((trackId) => {
    const range = lineage.affinity?.[trackId];
    return !range || (values[trackId] >= range[0] && values[trackId] <= range[1]);
  });
}

export function getSectionDeck(section: CardSection, values: TrackValues) {
  return cardsCatalog.cards.filter(
    (lineage) =>
      lineage.section === section && isLineageCompatible(lineage, values),
  );
}

export function getCardGrade(lineage: CardLineage, values: TrackValues) {
  const gradeIndex = Math.min(
    values[lineage.driver],
    lineage.grades.length - 1,
  );

  return lineage.grades[gradeIndex];
}

export function getLineage(lineageId: string) {
  return cardsCatalog.cards.find((lineage) => lineage.id === lineageId);
}

export function getCardFamily(section: CardSection): "Tactic" | "Modifier" {
  return section === "action" ? "Tactic" : "Modifier";
}

export function getEquippedInstructions(
  equipped: Record<CardSection, string[]>,
  values: TrackValues,
) {
  function instructionsFor(section: CardSection) {
    return equipped[section]
      .map((lineageId) => getLineage(lineageId))
      .filter((lineage): lineage is CardLineage => Boolean(lineage))
      .map((lineage) => getCardGrade(lineage, values).instruction);
  }

  return {
    context: instructionsFor("context"),
    action: instructionsFor("action"),
    format: instructionsFor("format"),
    target: instructionsFor("target"),
  };
}

export function getTrackMax(trackId: TrackId) {
  return (trackDefinitions.get(trackId)?.points.length ?? 4) - 1;
}

// Drops anything a stored card-system state may carry that the current catalog
// no longer recognizes: unknown or wrong-section card ids, over-budget slots,
// removed tracks, and out-of-range track values. Old saves, share links, and
// custom archetypes degrade gracefully instead of leaving ghost slots.
export function sanitizeCardSystemShape<
  T extends {
    tracks: TrackValues;
    equipped: Record<CardSection, string[]>;
    overrides: TrackId[];
  },
>(state: T | null | undefined): T {
  const tracks = {} as TrackValues;
  for (const trackId of TRACK_IDS) {
    const raw = state?.tracks?.[trackId];
    const max = getTrackMax(trackId);
    tracks[trackId] =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(Math.max(Math.round(raw), 0), max)
        : Math.min(DEFAULT_TRACK_VALUES[trackId], max);
  }

  const equipped = {} as Record<CardSection, string[]>;
  for (const section of CARD_SECTIONS) {
    const candidate = state?.equipped?.[section];
    const ids = Array.isArray(candidate) ? candidate : [];
    equipped[section] = ids
      .filter(
        (id, index) =>
          getLineage(id)?.section === section && ids.indexOf(id) === index,
      )
      .slice(0, SECTION_SLOT_BUDGETS[section]);
  }

  const overrideList = state?.overrides;
  const overrides = Array.isArray(overrideList)
    ? overrideList.filter((trackId) => TRACK_IDS.includes(trackId))
    : [];

  // A null state degrades to the three sanitized keys; every in-repo caller
  // passes a full object, so the cast only covers that degraded path.
  return { ...(state ?? ({} as T)), tracks, equipped, overrides };
}
