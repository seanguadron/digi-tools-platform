// Types for the CRAFT art-pack generator. The implementation is plain ESM so
// the node test runner can load it directly; this declaration lets app-side
// code (the studio page, the card-art route) import it under allowJs: false.

export declare const ART_THEME_IDS: readonly string[];

export type ArtThemeFile = {
  schemaVersion: number;
  theme: {
    id: string;
    name: string;
    pathSegment: string;
    filePrefix: string;
    fileExtension: string;
    generator: string;
    aspectRatio: string;
    style: string;
  };
  craft: Record<string, string>;
  roles: Record<string, string>;
  lineages: Record<string, string>;
  grades: Record<string, string[]>;
  archetypes: Record<string, string>;
  shared: Record<string, string>;
};

export type CraftArtEntry = {
  group: string;
  name: string;
  owner: string;
  target: string;
  status: string;
  unique: string;
  key: string;
  later?: boolean;
};

export declare function artThemePath(themeId: string): string;
export declare function artDocPath(themeId: string): string;
export declare function loadArtTheme(themeId: string): Promise<ArtThemeFile>;
export declare function artFileName(
  theme: ArtThemeFile,
  sequence: number,
  name: string,
): string;
export declare function collectCraftArtEntries(
  catalog: unknown,
  theme: ArtThemeFile,
): CraftArtEntry[];
export declare function craftArtCoverageErrors(
  catalog: unknown,
  theme: ArtThemeFile,
): string[];
export declare function renderCraftArtDoc(
  catalog: unknown,
  theme: ArtThemeFile,
): string;
export declare function generateCraftArtDocs(options?: {
  check?: boolean;
}): Promise<void>;
