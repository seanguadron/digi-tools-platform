import archetypesData from "@/data/prompt-builder/archetypes.json";
import type {
  ArchetypesCatalog,
  PromptArchetype,
} from "@/lib/prompt-types";

const archetypesCatalog = archetypesData as ArchetypesCatalog;

export const PROMPT_ARCHETYPES = archetypesCatalog.archetypes;

export type { PromptArchetype };
