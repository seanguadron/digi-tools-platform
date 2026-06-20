import type { BlockType } from "@/lib/architect/types";

export type BlockDefinition = {
  id: BlockType;
  label: string;
  glyph: string;
  blurb: string;
  // Low-chroma accent applied only to the small type chip, not the whole card,
  // so the canvas stays calm (accents well under 10% of surface).
  accent: string;
};

export const BLOCK_TYPES: readonly BlockDefinition[] = [
  {
    id: "manager",
    label: "Manager",
    glyph: "MGR",
    blurb: "Coordinates a domain and owns its lifecycle.",
    accent: "oklch(0.72 0.12 200)",
  },
  {
    id: "worker",
    label: "Worker",
    glyph: "WRK",
    blurb: "Performs a focused unit of work or a concrete variant.",
    accent: "oklch(0.72 0.12 150)",
  },
  {
    id: "service",
    label: "Service",
    glyph: "SVC",
    blurb: "A stateless capability other parts of the system call.",
    accent: "oklch(0.72 0.12 250)",
  },
  {
    id: "base",
    label: "Base / Abstract",
    glyph: "BAS",
    blurb: "A base or abstract type that others derive from.",
    accent: "oklch(0.72 0.12 300)",
  },
  {
    id: "data",
    label: "Data / State",
    glyph: "DAT",
    blurb: "A data structure, state, or config the system holds.",
    accent: "oklch(0.74 0.12 95)",
  },
  {
    id: "adapter",
    label: "Adapter / Gateway",
    glyph: "ADP",
    blurb: "Wraps an external system behind an interface the app controls.",
    accent: "oklch(0.72 0.12 35)",
  },
  {
    id: "external",
    label: "External / Integration",
    glyph: "EXT",
    blurb: "A third-party system, engine, or API the app depends on.",
    accent: "oklch(0.72 0.12 25)",
  },
  {
    id: "utility",
    label: "Utility",
    glyph: "UTL",
    blurb: "A shared helper or cross-cutting concern.",
    accent: "oklch(0.72 0.04 250)",
  },
];

const BLOCK_BY_ID = new Map(BLOCK_TYPES.map((block) => [block.id, block]));

export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_BY_ID.get(type) ?? BLOCK_TYPES[0];
}
