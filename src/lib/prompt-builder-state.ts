import builderData from "@/data/prompt-builder/builder.json";
import { getRoleActionSuggestions } from "@/lib/prompt-builder-options";
import {
  craftCardEngine,
  getFormatCode,
  getRecommendedTrackValues,
  sanitizeCardSystemShape,
} from "@/lib/prompt-card-system";
import type {
  CardSection,
  TrackValues,
} from "@/lib/prompt-card-system";
import {
  buildAudienceDefaultLine,
  CONTEXT_DEFAULT_TEXT,
} from "@/lib/prompt-defaults";
import type {
  BuilderCatalog,
  PromptDraft,
  PromptDraftTextField,
  PromptRole,
  TrackId,
} from "@/lib/prompt-types";

export type {
  PromptDraft,
  PromptDraftTextField,
} from "@/lib/prompt-types";

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

// The generic slot/track state machinery lives in src/lib/card-engine.ts;
// these bound re-exports keep the names this module has always provided.
export const createEmptyEquippedCards =
  craftCardEngine.createEmptyEquippedCards;
export const createEmptySnapMemory = craftCardEngine.createEmptySnapMemory;
export const createEmptySuggestedCards =
  craftCardEngine.createEmptySuggestedCards;
export const createEquippedSlots = craftCardEngine.createEquippedSlots;
export const reconcileCardSystem = craftCardEngine.reconcileCardSystem;
export const applyRecommendedTracks = craftCardEngine.applyRecommendedTracks;
export const setTrackValue = craftCardEngine.setTrackValue;
export const toggleEquippedCard = craftCardEngine.toggleEquippedCard;
export const placeEquippedCard = craftCardEngine.placeEquippedCard;
export const clearEquippedCards = craftCardEngine.clearEquippedCards;
export const removeEquippedCard = craftCardEngine.removeEquippedCard;

export function createCardSystem(
  formatValue = EMPTY_DRAFT.format,
): CardSystemState {
  return craftCardEngine.createCardSystem(
    getRecommendedTrackValues(getFormatCode(formatValue)),
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

export type BuildPromptOptions = {
  // Audience assumption from the active archetype, injected when Target
  // audience is left on "Use default". Null/undefined falls back to the
  // generic infer-and-state line.
  audienceDefault?: string | null;
};

export function buildPromptSections(
  draft: PromptDraft,
  selectedRoles: PromptRole[],
  cardInstructions: Record<CardSection, string[]>,
  options: BuildPromptOptions = {},
): PromptSection[] | null {
  if (
    (!draft.action.trim() && cardInstructions.action.length === 0) ||
    selectedRoles.length === 0
  ) {
    return null;
  }

  // Custom text always wins; the default line only stands in for an empty
  // field when its use-default choice is on.
  const contextLead =
    draft.context.trim() ||
    (draft.contextUseDefault ? CONTEXT_DEFAULT_TEXT : "");
  const targetLead =
    draft.targetAudience.trim() ||
    (draft.targetUseDefault
      ? buildAudienceDefaultLine(options.audienceDefault)
      : "");

  const context = [contextLead, ...cardInstructions.context]
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
  const targetAudience = [targetLead, ...cardInstructions.target]
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
  options: BuildPromptOptions = {},
) {
  const sections = buildPromptSections(
    draft,
    selectedRoles,
    cardInstructions,
    options,
  );
  if (!sections) {
    return "Complete the five C.R.A.F.T. sections to build your prompt.";
  }

  return sections
    .map((section) => `${section.heading}\n${section.body}`)
    .join("\n\n");
}

export function withDraftText(
  current: PromptDraft,
  field: PromptDraftTextField,
  value: string,
): PromptDraft {
  const next = { ...current, [field]: value };

  // Typing custom text is an explicit move away from the default line;
  // clearing the field later does not silently opt back in.
  if (field === "context") {
    next.contextUseDefault = false;
  }

  if (field === "targetAudience") {
    next.targetUseDefault = false;
  }

  return next;
}

export function isFieldComplete(
  draft: PromptDraft,
  field: keyof PromptDraft,
) {
  // Context and Target audience are satisfied by custom text OR the
  // use-default choice; the assembled prompt injects the default line.
  if (field === "context") {
    return draft.context.trim().length > 0 || draft.contextUseDefault;
  }

  if (field === "targetAudience") {
    return draft.targetAudience.trim().length > 0 || draft.targetUseDefault;
  }

  const value = draft[field];
  if (typeof value === "boolean") {
    return value;
  }

  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

function restoredString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
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

  // Coerce field-by-field: this path also restores URL shares and imported
  // session files, so a tampered payload must degrade to defaults, not leak
  // arbitrary shapes into the draft. Saves that predate the use-default
  // booleans inherit them from EMPTY_DRAFT (true).
  return {
    context: restoredString(parsed.context, EMPTY_DRAFT.context),
    roleIds: validRoleIds,
    action: restoredString(parsed.action, EMPTY_DRAFT.action),
    format: restoredString(parsed.format, EMPTY_DRAFT.format),
    formatNotes: restoredString(parsed.formatNotes, EMPTY_DRAFT.formatNotes),
    targetAudience: restoredString(
      parsed.targetAudience,
      EMPTY_DRAFT.targetAudience,
    ),
    contextUseDefault:
      typeof parsed.contextUseDefault === "boolean"
        ? parsed.contextUseDefault
        : EMPTY_DRAFT.contextUseDefault,
    targetUseDefault:
      typeof parsed.targetUseDefault === "boolean"
        ? parsed.targetUseDefault
        : EMPTY_DRAFT.targetUseDefault,
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
