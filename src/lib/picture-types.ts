import type {
  CardIllustration,
  CardLineageOf,
  CardSystemStateOf,
  EquippedCardsOf,
  SnapMemoryOf,
  TrackDefinitionOf,
  TrackValuesOf,
} from "@/lib/card-engine";
import type { PictureSection } from "@/lib/picture-prompt";

export type PictureTrackId = "intensity";

export type PictureTrackValues = TrackValuesOf<PictureTrackId>;
export type PictureTrackDefinition = TrackDefinitionOf<PictureTrackId>;
export type PictureCardLineage = CardLineageOf<PictureSection, PictureTrackId>;
export type PictureEquippedCards = EquippedCardsOf<PictureSection>;
export type PictureSnapMemory = SnapMemoryOf<PictureSection>;
export type PictureCardSystemState = CardSystemStateOf<
  PictureSection,
  PictureTrackId
>;

export type PictureDraft = {
  subject: string;
  negative: string;
  mjTailEnabled: boolean;
  aspectRatio: string;
  stylize: number | null;
  chaos: number | null;
  weird: number | null;
};

export type PictureDraftTextField = "subject" | "negative";

export type PictureMjTailPreset = {
  aspectRatio?: string;
  stylize?: number | null;
  chaos?: number | null;
  weird?: number | null;
  negative?: string;
};

export type PictureArchetype = {
  id: string;
  code: string;
  name: string;
  description: string;
  tracks: PictureTrackValues;
  equipped: Partial<Record<PictureSection, readonly string[]>>;
  mjTail?: PictureMjTailPreset;
  effects: readonly string[];
  illustration: CardIllustration;
};

export type PictureProofScenario = {
  id: string;
  name: string;
  proves: string;
  panel: number;
  tracks?: Partial<PictureTrackValues>;
  equipped?: Partial<Record<PictureSection, readonly string[]>>;
  draft?: Partial<PictureDraft>;
  checks: readonly string[];
};

export type PictureRange = {
  min: number;
  max: number;
  step: number;
  fallback: number;
};

export type PictureAspectOption = {
  id: string;
  label: string;
  value: string;
};

export type PicturePart = {
  letter: string;
  label: string;
  summary: string;
};

export type PictureTracksCatalog = {
  schemaVersion: 1;
  sectionTracks: Record<PictureSection, readonly PictureTrackId[]>;
  slotBudgets: Record<PictureSection, number>;
  definitions: PictureTrackDefinition[];
  defaultValues: PictureTrackValues;
};

export type PictureCardsCatalog = {
  schemaVersion: 1;
  cards: PictureCardLineage[];
};

export type PictureArchetypesCatalog = {
  schemaVersion: 1;
  archetypes: PictureArchetype[];
};

export type PictureBuilderCatalog = {
  schemaVersion: 1;
  emptyDraft: PictureDraft;
  exampleDraft: PictureDraft;
  pictureParts: PicturePart[];
  requiredFields: {
    label: string;
    field: keyof PictureDraft;
  }[];
  aspectRatios: PictureAspectOption[];
  stylizeRange: PictureRange;
  chaosRange: PictureRange;
  weirdRange: PictureRange;
};

export type PictureProofScenariosCatalog = {
  schemaVersion: 1;
  baseDraft: Partial<PictureDraft>;
  scenarios: PictureProofScenario[];
};
