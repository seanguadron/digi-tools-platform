// Types for the Card Art Studio's file layer. The implementation is plain
// ESM in card-art-store.mjs so the node test runner can load it directly;
// this declaration is the typed door the app-side route handler comes through
// (tsconfig sets allowJs: false, so the .mjs is not otherwise importable).

export declare const VARIANT_ROOT: string;

export declare class CardArtError extends Error {
  status: number;
  constructor(message: string, status?: number);
}

export type CardArtVariant = {
  id: string;
  letter: string;
  cropped: boolean;
  file: string;
};

export type CardArtEntry = {
  key: string;
  sequence: number;
  name: string;
  group: string;
  later: boolean;
  owner: string;
  fileName: string;
  target: string;
  status: string;
  prompt: string;
  variants: CardArtVariant[];
};

export type CardArtManifest = {
  theme: string;
  style: string;
  entries: CardArtEntry[];
  progress: { generated: number; total: number };
};

export type CardArtStore = {
  listEntries(themeId: string): Promise<CardArtManifest>;
  readVariantFile(
    themeId: string,
    key: string,
    variantId: string,
  ): Promise<{ bytes: Uint8Array; file: string }>;
  addVariant(themeId: string, key: string, dataUrl: string): Promise<CardArtVariant>;
  saveCrop(
    themeId: string,
    key: string,
    variantId: string,
    dataUrl: string,
  ): Promise<CardArtVariant>;
  deleteVariant(
    themeId: string,
    key: string,
    variantId: string,
  ): Promise<{ removed: string }>;
  selectVariant(
    themeId: string,
    key: string,
    variantId: string,
    webpDataUrl: string,
  ): Promise<{ target: string; selected: string; statusChanged: boolean }>;
  clearLive(
    themeId: string,
    key: string,
  ): Promise<{ target: string; statusChanged: boolean }>;
  variantDir(themeId: string, entry: { target: string }): string;
  livePath(entry: { target: string }): string;
};

export declare function createCardArtStore(options?: {
  root?: string;
  regenerateDocs?: boolean;
}): CardArtStore;
