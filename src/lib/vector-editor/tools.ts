// The v1 tool set: a pointer/select tool plus the four shape tools. Drawing and
// selection behavior land in later phases; this is the shared registry the tool
// strip and keyboard shortcuts both read from, so the two can never drift.

export type VectorToolId = "select" | "rect" | "ellipse" | "line" | "polygon";

export interface VectorToolDef {
  id: VectorToolId;
  label: string;
  glyph: string; // compact marker glyph for the tool strip
  hint: string;
  shortcut: string; // single, case-insensitive key
}

export const VECTOR_TOOLS: VectorToolDef[] = [
  {
    id: "select",
    label: "Select",
    glyph: "↖", // ↖
    hint: "Select, move, and transform objects",
    shortcut: "V",
  },
  {
    id: "rect",
    label: "Rectangle",
    glyph: "▭", // ▭
    hint: "Draw a rectangle",
    shortcut: "R",
  },
  {
    id: "ellipse",
    label: "Ellipse",
    glyph: "◯", // ◯
    hint: "Draw an ellipse",
    shortcut: "O",
  },
  {
    id: "line",
    label: "Line",
    glyph: "╱", // ╱
    hint: "Draw a straight line",
    shortcut: "L",
  },
  {
    id: "polygon",
    label: "Polygon",
    glyph: "⬠", // ⬠
    hint: "Draw a polygon",
    shortcut: "P",
  },
];

export const VECTOR_TOOL_BY_SHORTCUT: Record<string, VectorToolId> =
  Object.fromEntries(
    VECTOR_TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
  );
