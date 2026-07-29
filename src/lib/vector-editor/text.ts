// The text-object catalog: the font families the editor offers, with their
// CSS stacks. The document stores only the NAME; rendering and export look
// up the stack, and the project-io validator rejects names outside this
// list — so no free-form font string ever reaches a style or an exported
// attribute. Pure module (no browser APIs).

export interface FontFamilyDef {
  name: string; // stored on the object, shown in the picker
  css: string; // the rendered/exported font-family stack
}

export const FONT_FAMILIES: FontFamilyDef[] = [
  { name: "Arial", css: "Arial, Helvetica, sans-serif" },
  { name: "Georgia", css: "Georgia, 'Times New Roman', serif" },
  { name: "Times New Roman", css: "'Times New Roman', Times, serif" },
  { name: "Courier New", css: "'Courier New', Courier, monospace" },
  { name: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { name: "Trebuchet MS", css: "'Trebuchet MS', Tahoma, sans-serif" },
  { name: "Impact", css: "Impact, 'Arial Black', sans-serif" },
  { name: "System", css: "system-ui, sans-serif" },
];

export const DEFAULT_FONT_FAMILY = "Arial";
export const DEFAULT_FONT_SIZE = 48; // user units
export const MIN_FONT_SIZE = 1;
export const MAX_FONT_SIZE = 2000;
export const MAX_TEXT_LENGTH = 5000;

export function isFontFamilyName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    FONT_FAMILIES.some((family) => family.name === value)
  );
}

export function fontCss(name: string): string {
  return (
    FONT_FAMILIES.find((family) => family.name === name)?.css ??
    FONT_FAMILIES[0].css
  );
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

// THE enforcement point for text content — every path that writes a text
// value (create, live edit, load) runs through this, so the length cap and
// the XML-invalid-control-character strip can't be skipped by one caller.
// Newlines and tabs survive; \r\n normalizes to \n.
export function sanitizeText(value: string): string {
  return value
    .slice(0, MAX_TEXT_LENGTH)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

// Line layout shared by rendering, export, and measurement: split on \n,
// baselines stacked at 1.2em, first baseline sitting 0.8em below the
// object's y (its TOP). Render and export use the same formulas, so the
// exported artifact matches the editor exactly.
export const TEXT_LINE_HEIGHT = 1.2;
export const TEXT_ASCENT = 0.8;

export function textLines(text: string): string[] {
  const lines = text.split("\n");
  return lines.length > 0 ? lines : [""];
}
