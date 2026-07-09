export interface PromptRole {
  id: string;
  name: string;
  category: string;
  description: string;
  core: boolean;
  ability: {
    summary: string;
    bullets: readonly string[];
  };
  illustration: CardIllustration;
}

export type FormatOption = {
  code: string;
  name: string;
  value: string;
};

export type PromptDraft = {
  context: string;
  roleIds: string[];
  action: string;
  format: string;
  formatNotes: string;
  targetAudience: string;
};

export type CardSection = "context" | "action" | "format" | "target";

export type TrackId =
  | "contextDepth"
  | "evidenceRigor"
  | "autonomy"
  | "challenge"
  | "outputDetail"
  | "structure"
  | "audienceExpertise"
  | "voiceFormality";

export type TrackValues = Record<TrackId, number>;

export type TrackDefinition = {
  id: TrackId;
  label: string;
  description: string;
  points: readonly string[];
};

export type CardGrade = {
  name: string;
  description: string;
  instruction: string;
  illustration: CardIllustration;
};

export type CardIllustration = {
  src: string;
  alt: string;
  motif: string;
  prompt: string;
  status: "planned" | "generated";
};

export type CardLineage = {
  id: string;
  code: string;
  section: CardSection;
  driver: TrackId;
  goals: readonly string[];
  grades: readonly CardGrade[];
  illustration: CardIllustration;
  affinity?: Partial<Record<TrackId, readonly [number, number]>>;
};

export type ProofScenario = {
  id: string;
  name: string;
  proves: string;
  panel: number;
  formatCode: string;
  roles: readonly string[];
  tracks?: Partial<TrackValues>;
  equipped?: Partial<Record<CardSection, readonly string[]>>;
  draft?: Partial<
    Pick<
      PromptDraft,
      "context" | "action" | "formatNotes" | "targetAudience"
    >
  >;
  suggested?: Partial<Record<CardSection, string>>;
  outputExpanded?: boolean;
  checks: readonly string[];
};

export type PromptArchetype = {
  id: string;
  code: string;
  name: string;
  description: string;
  formatCode: string;
  roleIds: readonly string[];
  tracks: TrackValues;
  equipped: Partial<Record<CardSection, readonly string[]>>;
  effects: readonly string[];
  illustration: CardIllustration;
  action?: string;
  formatNotes?: string;
};

export type RolesCatalog = {
  schemaVersion: 2;
  roles: PromptRole[];
};

export type TracksCatalog = {
  schemaVersion: 1;
  sectionTracks: Record<CardSection, readonly TrackId[]>;
  slotBudgets: Record<CardSection, number>;
  definitions: TrackDefinition[];
  defaultValues: TrackValues;
  vocabulary: Record<
    string,
    Partial<Record<TrackId, readonly string[]>>
  >;
};

export type FormatsCatalog = {
  schemaVersion: 1;
  formats: FormatOption[];
  recommendedTracks: Record<string, TrackValues>;
  modifiers: string[];
};

export type CardsCatalog = {
  schemaVersion: 2;
  cards: CardLineage[];
};

export type ArchetypesCatalog = {
  schemaVersion: 2;
  archetypes: PromptArchetype[];
};

export type SuggestionsCatalog = {
  schemaVersion: 1;
  categoryActions: Record<string, readonly string[]>;
  roleActions: Record<string, readonly string[]>;
  audienceModifiers: string[];
};

export type BuilderCatalog = {
  schemaVersion: 1;
  emptyDraft: PromptDraft;
  exampleDraft: PromptDraft;
  craftParts: {
    letter: string;
    label: string;
    summary: string;
  }[];
  requiredFields: {
    label: string;
    field: keyof PromptDraft;
  }[];
};

export type ProofScenariosCatalog = {
  schemaVersion: 1;
  baseDraft: NonNullable<ProofScenario["draft"]>;
  scenarios: ProofScenario[];
};
