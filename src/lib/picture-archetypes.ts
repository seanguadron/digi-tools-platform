import archetypesData from "@/data/picture-deck/archetypes.json";
import type {
  PictureArchetype,
  PictureArchetypesCatalog,
} from "@/lib/picture-types";

const archetypesCatalog = archetypesData as PictureArchetypesCatalog;

export const PICTURE_ARCHETYPES: PictureArchetype[] =
  archetypesCatalog.archetypes;

export type { PictureArchetype } from "@/lib/picture-types";
