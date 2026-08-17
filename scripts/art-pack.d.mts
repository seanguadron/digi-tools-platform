// Types for the art-pack key/path model. The implementation is plain ESM
// because plain `node` runs the data scripts; this declaration lets app-side
// code import it under allowJs: false. See art-pack.mjs for the why.

export type ArtPackGroup =
  | "craft"
  | "roles"
  | "lineages"
  | "archetypes"
  | "grades"
  | "shared";

export type ArtPackStatus = "planned" | "generated";

/** One image as authored in a pack file. No path: the path is derived. */
export type ArtPackEntry = {
  prompt: string;
  alt: string;
  bio?: string;
  status: ArtPackStatus;
};

/** The same entry once resolved, carrying the derived path. */
export type ResolvedArt = {
  key: string;
  src: string;
  alt: string;
  prompt: string;
  bio?: string;
  status: ArtPackStatus;
};

export type ArtPackFile = {
  schemaVersion: number;
  theme: {
    id: string;
    name: string;
    filePrefix: string;
    fileExtension: string;
    generator: string;
    aspectRatio: string;
    style: string;
  };
  craft: Record<string, ArtPackEntry>;
  roles: Record<string, ArtPackEntry>;
  lineages: Record<string, ArtPackEntry>;
  grades: Record<string, ArtPackEntry[]>;
  archetypes: Record<string, ArtPackEntry>;
  shared: Record<string, ArtPackEntry>;
};

export declare const ART_PACK_GROUPS: readonly ArtPackGroup[];

export declare class ArtPackKeyError extends Error {}

export declare function parseArtKey(key: string): {
  group: ArtPackGroup;
  id: string;
  index: number | null;
};
export declare function artKeyFor(
  group: ArtPackGroup,
  id: string,
  index?: number,
): string;
export declare function artPathFor(packId: string, key: string): string;
export declare function artRelativePath(packId: string, key: string): string;
export declare function isArtPackEntry(value: unknown): value is ArtPackEntry;
export declare function artPackEntry(
  pack: ArtPackFile,
  key: string,
): ResolvedArt | undefined;
