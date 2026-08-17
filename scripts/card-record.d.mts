// Types for the Card tab's read/write model. Implementation is plain ESM in
// card-record.mjs; see its header for why the writable fields are a table.

export type CardFieldKind = "line" | "text" | "list";

export type CardField = {
  id: string;
  label: string;
  kind: CardFieldKind;
  hint?: string;
  value: string | string[];
};

export type CardRecord = {
  key: string;
  kind: string;
  hasRecord: boolean;
  fields: CardField[];
  structural: { label: string; value: string }[];
  note: string;
};

export declare class CardRecordError extends Error {}

export declare function readCardRecord(catalog: unknown, key: string): CardRecord;
export declare function applyCardEdits(
  catalog: unknown,
  key: string,
  edits: Record<string, string | string[]>,
): unknown;
export declare const CATALOG_FOR_GROUP: Record<string, string>;
export declare function catalogKeyForEntry(key: string): string | null;
