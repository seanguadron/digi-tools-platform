// Standard data types offered in the inspector's Data field "Type" dropdown.
// The UI adds a "Custom…" escape, so anything not listed here can still be typed
// by hand and described in the field's Description column.
export const STANDARD_DATA_TYPES: readonly string[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "Date",
  "timestamp",
  "enum",
  "ID",
  "UUID",
  "object",
  "array",
  "JSON",
  "Map",
  "Set",
  "binary",
  "null",
  "any",
];
