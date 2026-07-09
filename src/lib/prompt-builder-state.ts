import builderData from "@/data/prompt-builder/builder.json";
import { getRoleActionSuggestions } from "@/lib/prompt-builder-options";
import {
  CARD_SECTIONS,
  getFormatCode,
  getRecommendedTrackValues,
  getSectionConfigurationKey,
  getSectionDeck,
  sanitizeCardSystemShape,
  SECTION_SLOT_BUDGETS,
  TRACK_IDS,
} from "@/lib/prompt-card-system";
import type {
  CardSection,
  TrackValues,
} from "@/lib/prompt-card-system";
import type {
  BuilderCatalog,
  PromptDraft,
  PromptRole,
  TrackId,
} from "@/lib/prompt-types";
import { insertIntoSlots } from "@/lib/slot-order";

export type { PromptDraft } from "@/lib/prompt-types";

export type EquippedCards = Record<CardSection, string[]>;
export type SnapMemory = Record<CardSection, Record<string, string[]>>;

export type CardSystemState = {
  tracks: TrackValues;
  equipped: EquippedCards;
  memory: SnapMemory;
  overrides: TrackId[];
  suggested: Record<CardSection, string | null>;
};

const builderCatalog = builderData as BuilderCatalog;

export const EMPTY_DRAFT = builderCatalog.emptyDraft;
export const EXAMPLE_DRAFT = builderCatalog.exampleDraft;
export const CRAFT_PARTS = builderCatalog.craftParts;
export const REQUIRED_FIELDS = builderCatalog.requiredFields;

export function createEmptyEquippedCards(): EquippedCards {
  return {
    context: [],
    action: [],
    format: [],
    target: [],
  };
}

export function createEmptySnapMemory(): SnapMemory {
  return {
    context: {},
    action: {},
    format: {},
    target: {},
  };
}

export function createEmptySuggestedCards(): Record<
  CardSection,
  string | null
> {
  return {
    context: null,
    action: null,
    format: null,
    target: null,
  };
}

export function createCardSystem(
  formatValue = EMPTY_DRAFT.format,
): CardSystemState {
  return {
    tracks: getRecommendedTrackValues(getFormatCode(formatValue)),
    equipped: createEmptyEquippedCards(),
    memory: createEmptySnapMemory(),
    overrides: [],
    suggested: createEmptySuggestedCards(),
  };
}

export function createEquippedSlots(
  values: Partial<Record<CardSection, readonly string[]>> = {},
): EquippedCards {
  return CARD_SECTIONS.reduce(
    (result, section) => {
      result[section] = Array.from(
        { length: SECTION_SLOT_BUDGETS[section] },
        (_, slotIndex) => values[section]?.[slotIndex] ?? "",
      );
      return result;
    },
    createEmptyEquippedCards(),
  );
}

function numberedActions(action: string) {
  return action
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean)
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");
}

export type PromptSectionKey =
  | "context"
  | "role"
  | "action"
  | "format"
  | "target";

export type PromptSection = {
  key: PromptSectionKey;
  heading: string;
  label: string;
  body: string;
};

export function buildPromptSections(
  draft: PromptDraft,
  selectedRoles: PromptRole[],
  cardInstructions: Record<CardSection, string[]>,
): PromptSection[] | null {
  if (
    (!draft.action.trim() && cardInstructions.action.length === 0) ||
    selectedRoles.length === 0
  ) {
    return null;
  }

  const context = [draft.context.trim(), ...cardInstructions.context]
    .filter(Boolean)
    .join("\n");
  const action = [...cardInstructions.action, draft.action.trim()]
    .filter(Boolean)
    .join("\n");
  const format = [
    draft.format.trim(),
    ...cardInstructions.format,
    draft.formatNotes.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const targetAudience = [
    draft.targetAudience.trim(),
    ...cardInstructions.target,
  ]
    .filter(Boolean)
    .join("\n");
  const roleLoadout = selectedRoles
    .map((role, index) => {
      const position = index === 0 ? "Lead role" : `Supporting role ${index}`;
      const priorities = getRoleActionSuggestions(role)
        .slice(0, 3)
        .map((priority) => `- ${priority}`)
        .join("\n");
      return `${index + 1}. ${position}: ${role.name}\n${role.description}\nRole priorities:\n${priorities}`;
    })
    .join("\n\n");

  return [
    { key: "context", heading: "CONTEXT", label: "Context", body: context },
    {
      key: "role",
      heading: "ROLE LOADOUT",
      label: "Roles",
      body: `Use the lead role as the primary decision-making perspective. Use supporting roles to strengthen the work without overriding the lead role.\n\n${roleLoadout}`,
    },
    {
      key: "action",
      heading: "ACTION",
      label: "Action",
      body: numberedActions(action),
    },
    { key: "format", heading: "FORMAT", label: "Format", body: format },
    {
      key: "target",
      heading: "TARGET AUDIENCE",
      label: "Target",
      body: targetAudience,
    },
  ];
}

export function buildPrompt(
  draft: PromptDraft,
  selectedRoles: PromptRole[],
  cardInstructions: Record<CardSection, string[]>,
) {
  const sections = buildPromptSections(draft, selectedRoles, cardInstructions);
  if (!sections) {
    return "Complete the five C.R.A.F.T. sections to build your prompt.";
  }

  return sections
    .map((section) => `${section.heading}\n${section.body}`)
    .join("\n\n");
}

export function isFieldComplete(
  draft: PromptDraft,
  field: keyof PromptDraft,
) {
  const value = draft[field];
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

export function reconcileCardSystem(
  current: CardSystemState,
  nextTracks: TrackValues,
  nextOverrides = current.overrides,
) {
  const nextMemory: SnapMemory = {
    context: { ...current.memory.context },
    action: { ...current.memory.action },
    format: { ...current.memory.format },
    target: { ...current.memory.target },
  };
  const nextEquipped: EquippedCards = {
    context: [...current.equipped.context],
    action: [...current.equipped.action],
    format: [...current.equipped.format],
    target: [...current.equipped.target],
  };
  const nextSuggested = createEmptySuggestedCards();

  CARD_SECTIONS.forEach((section) => {
    const oldKey = getSectionConfigurationKey(section, current.tracks);
    const newKey = getSectionConfigurationKey(section, nextTracks);

    if (oldKey === newKey) {
      nextSuggested[section] = current.suggested[section];
      return;
    }

    const sectionMemory = nextMemory[section];
    sectionMemory[oldKey] = current.equipped[section];
    const memoryKeys = Object.keys(sectionMemory);
    if (memoryKeys.length > 12) {
      delete sectionMemory[memoryKeys[0]];
    }

    const deckIds = getSectionDeck(section, nextTracks).map(
      (lineage) => lineage.id,
    );
    const sourceSlots = sectionMemory[newKey] ?? current.equipped[section];
    const restored = Array.from(
      { length: SECTION_SLOT_BUDGETS[section] },
      (_, slotIndex) => {
        const lineageId = sourceSlots[slotIndex] ?? "";
        return deckIds.includes(lineageId) ? lineageId : "";
      },
    );
    const removedIndex = current.equipped[section].findIndex(
      (lineageId, slotIndex) =>
        Boolean(lineageId) && restored[slotIndex] !== lineageId,
    );
    const restoredIds = restored.filter(Boolean);
    const replacement =
      removedIndex >= 0
        ? deckIds.find(
            (lineageId, index) =>
              index >= removedIndex && !restoredIds.includes(lineageId),
          ) ??
          deckIds.find((lineageId) => !restoredIds.includes(lineageId)) ??
          null
        : null;

    nextEquipped[section] = restored;
    nextSuggested[section] = replacement;
  });

  return {
    tracks: nextTracks,
    equipped: nextEquipped,
    memory: nextMemory,
    overrides: nextOverrides,
    suggested: nextSuggested,
  };
}

export function applyRecommendedTracks(
  current: CardSystemState,
  recommended: TrackValues,
  preserveOverrides: boolean,
) {
  if (!preserveOverrides) {
    return reconcileCardSystem(current, recommended, []);
  }

  const nextTracks = { ...current.tracks };
  TRACK_IDS.forEach((trackId) => {
    if (!current.overrides.includes(trackId)) {
      nextTracks[trackId] = recommended[trackId];
    }
  });

  return reconcileCardSystem(current, nextTracks);
}

export function setTrackValue(
  current: CardSystemState,
  trackId: TrackId,
  value: number,
) {
  if (current.tracks[trackId] === value) {
    return current;
  }

  const nextOverrides = current.overrides.includes(trackId)
    ? current.overrides
    : [...current.overrides, trackId];

  return reconcileCardSystem(
    current,
    { ...current.tracks, [trackId]: value },
    nextOverrides,
  );
}

export function toggleEquippedCard(
  current: CardSystemState,
  section: CardSection,
  lineageId: string,
) {
  const nextCards = Array.from(
    { length: SECTION_SLOT_BUDGETS[section] },
    (_, slotIndex) => current.equipped[section][slotIndex] ?? "",
  );
  const selectedIndex = nextCards.indexOf(lineageId);

  if (selectedIndex >= 0) {
    nextCards[selectedIndex] = "";
  } else {
    const emptyIndex = nextCards.indexOf("");
    if (emptyIndex >= 0) {
      nextCards[emptyIndex] = lineageId;
    }
  }

  return {
    ...current,
    equipped: { ...current.equipped, [section]: nextCards },
    suggested: { ...current.suggested, [section]: null },
  };
}

export function placeEquippedCard(
  current: CardSystemState,
  section: CardSection,
  slotIndex: number,
  lineageId: string,
) {
  const nextCards = insertIntoSlots(
    current.equipped[section],
    slotIndex,
    lineageId,
    SECTION_SLOT_BUDGETS[section],
  );

  return {
    ...current,
    equipped: { ...current.equipped, [section]: nextCards },
    suggested: { ...current.suggested, [section]: null },
  };
}

export function clearEquippedCards(
  current: CardSystemState,
  section: CardSection,
) {
  return {
    ...current,
    equipped: {
      ...current.equipped,
      [section]: Array.from(
        { length: SECTION_SLOT_BUDGETS[section] },
        () => "",
      ),
    },
    suggested: { ...current.suggested, [section]: null },
  };
}

export function removeEquippedCard(
  current: CardSystemState,
  section: CardSection,
  slotIndex: number,
) {
  const nextCards = Array.from(
    { length: SECTION_SLOT_BUDGETS[section] },
    (_, index) => current.equipped[section][index] ?? "",
  );
  nextCards[slotIndex] = "";

  return {
    ...current,
    equipped: { ...current.equipped, [section]: nextCards },
  };
}

export function restoreDraft(value: string, roles: PromptRole[]): PromptDraft {
  const parsed = JSON.parse(value) as Partial<PromptDraft> & {
    roleId?: string;
  };
  const savedRoleIds = Array.isArray(parsed.roleIds)
    ? parsed.roleIds
    : parsed.roleId
      ? [parsed.roleId]
      : [];
  const validRoleIds = savedRoleIds
    .filter((roleId) => roles.some((role) => role.id === roleId))
    .slice(0, 3);

  return {
    ...EMPTY_DRAFT,
    ...parsed,
    roleIds: validRoleIds,
  };
}

export function restoreCardSystem(
  value: string,
  formatValue: string,
): CardSystemState {
  const restored = JSON.parse(value) as Partial<CardSystemState>;

  // Sanitize against the current catalog so stale saves (removed cards or
  // tracks, out-of-range values) degrade gracefully instead of ghost-slotting.
  return sanitizeCardSystemShape({
    tracks: {
      ...getRecommendedTrackValues(getFormatCode(formatValue)),
      ...restored.tracks,
    },
    equipped: {
      ...createEmptyEquippedCards(),
      ...restored.equipped,
    },
    memory: createEmptySnapMemory(),
    overrides: Array.isArray(restored.overrides) ? restored.overrides : [],
    suggested: createEmptySuggestedCards(),
  });
}
