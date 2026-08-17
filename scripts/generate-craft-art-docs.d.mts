// Types for the CRAFT art-pack generator. The implementation is plain ESM so
// the node test runner can load it directly; this declaration lets app-side
// code (the studio page, the card-art route) import it under allowJs: false.

import type { ArtPackFile } from "./art-pack.d.mts";

export declare function installedArtPackIds(): string[];

export type ArtThemeFile = ArtPackFile;

export type CraftArtEntry = {
  group: string;
  name: string;
  owner: string;
  target: string;
  status: string;
  unique: string;
  bio?: string;
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
