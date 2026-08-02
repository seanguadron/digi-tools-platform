import builderData from "@/data/picture-deck/builder.json";
import { pictureCardEngine } from "@/lib/picture-card-system";
import type { PictureTail } from "@/lib/picture-prompt";
import type {
  PictureBuilderCatalog,
  PictureCardSystemState,
  PictureDraft,
  PictureDraftTextField,
  PictureRange,
} from "@/lib/picture-types";

const builderCatalog = builderData as PictureBuilderCatalog;

export const EMPTY_PICTURE_DRAFT = builderCatalog.emptyDraft;
export const EXAMPLE_PICTURE_DRAFT = builderCatalog.exampleDraft;
export const PICTURE_PARTS = builderCatalog.pictureParts;
export const PICTURE_REQUIRED_FIELDS = builderCatalog.requiredFields;
export const PICTURE_ASPECT_RATIOS = builderCatalog.aspectRatios;
export const STYLIZE_RANGE = builderCatalog.stylizeRange;
export const CHAOS_RANGE = builderCatalog.chaosRange;
export const WEIRD_RANGE = builderCatalog.weirdRange;

const ASPECT_RATIO_VALUES = new Set(
  builderCatalog.aspectRatios.map((option) => option.value),
);

export function createPictureCardSystem(): PictureCardSystemState {
  return pictureCardEngine.createCardSystem();
}

export function withPictureDraftText(
  current: PictureDraft,
  field: PictureDraftTextField,
  value: string,
): PictureDraft {
  return { ...current, [field]: value };
}

export function isPictureFieldComplete(
  draft: PictureDraft,
  field: keyof PictureDraft,
) {
  const value = draft[field];
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== null && value !== false;
}

// The merge module's tail input, derived from the draft in one place.
export function draftTail(draft: PictureDraft): PictureTail {
  return {
    enabled: draft.mjTailEnabled,
    aspectRatio: draft.aspectRatio,
    stylize: draft.stylize,
    chaos: draft.chaos,
    weird: draft.weird,
    negative: draft.negative,
  };
}

function restoredString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function restoredBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

// Tail numbers restore to null unless they are finite and in range —
// a tampered payload degrades instead of smuggling junk into the tail.
function restoredTailNumber(value: unknown, range: PictureRange) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(Math.round(value), range.min), range.max);
}

function restoredAspectRatio(value: unknown) {
  return typeof value === "string" && ASPECT_RATIO_VALUES.has(value)
    ? value
    : EMPTY_PICTURE_DRAFT.aspectRatio;
}

// Coerce field-by-field: this path restores autosave, URL shares, imported
// session files, and library entries, so a tampered payload must degrade to
// defaults, not leak arbitrary shapes into the draft.
export function restorePictureDraft(value: string): PictureDraft {
  const parsed = JSON.parse(value) as Partial<PictureDraft>;

  return {
    subject: restoredString(parsed.subject, EMPTY_PICTURE_DRAFT.subject),
    negative: restoredString(parsed.negative, EMPTY_PICTURE_DRAFT.negative),
    mjTailEnabled: restoredBoolean(
      parsed.mjTailEnabled,
      EMPTY_PICTURE_DRAFT.mjTailEnabled,
    ),
    aspectRatio: restoredAspectRatio(parsed.aspectRatio),
    stylize: restoredTailNumber(parsed.stylize, STYLIZE_RANGE),
    chaos: restoredTailNumber(parsed.chaos, CHAOS_RANGE),
    weird: restoredTailNumber(parsed.weird, WEIRD_RANGE),
  };
}

export function restorePictureCardSystem(value: string): PictureCardSystemState {
  const restored = JSON.parse(value) as Partial<PictureCardSystemState>;

  // Sanitize against the current catalog so stale saves (removed cards,
  // out-of-range values) degrade gracefully instead of ghost-slotting.
  return pictureCardEngine.sanitizeCardSystemShape({
    tracks: {
      ...pictureCardEngine.defaultTrackValues,
      ...restored.tracks,
    },
    equipped: {
      ...pictureCardEngine.createEmptyEquippedCards(),
      ...restored.equipped,
    },
    memory: pictureCardEngine.createEmptySnapMemory(),
    overrides: Array.isArray(restored.overrides) ? restored.overrides : [],
    suggested: pictureCardEngine.createEmptySuggestedCards(),
  });
}
