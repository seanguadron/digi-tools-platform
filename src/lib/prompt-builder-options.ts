import formatsData from "@/data/prompt-builder/formats.json";
import suggestionsData from "@/data/prompt-builder/suggestions.json";
import type {
  FormatsCatalog,
  PromptRole,
  SuggestionsCatalog,
} from "@/lib/prompt-types";

export type { FormatOption } from "@/lib/prompt-types";

const formatsCatalog = formatsData as FormatsCatalog;
const suggestionsCatalog = suggestionsData as SuggestionsCatalog;

export const FORMAT_OPTIONS = formatsCatalog.formats;
export const FORMAT_MODIFIERS = formatsCatalog.modifiers;
export const AUDIENCE_MODIFIERS = suggestionsCatalog.audienceModifiers;

export function getRoleActionSuggestions(role?: PromptRole) {
  if (!role) {
    return [];
  }

  return (
    role.ability?.bullets ??
    suggestionsCatalog.roleActions[role.id] ??
    suggestionsCatalog.categoryActions[role.category] ??
    []
  );
}
