// The tool registry the tool strip and keyboard shortcuts both read from, so
// the two can never drift. Shortcuts are harmonized with the image editor
// where the tools overlap: V select, A direct select, P pen, R rect,
// O ellipse, N line (the image editor's line key), G polygon.

export type VectorToolId =
  | "select"
  | "direct"
  | "pen"
  | "rect"
  | "ellipse"
  | "line"
  | "polygon";

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
    id: "direct",
    label: "Direct select",
    glyph: "▷", // ▷ hollow arrow — the white arrow
    hint: "Select and edit anchor points and handles",
    shortcut: "A",
  },
  {
    id: "pen",
    label: "Pen",
    glyph: "✒", // ✒
    hint: "Draw a path point by point; drag for curves",
    shortcut: "P",
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
    shortcut: "N",
  },
  {
    id: "polygon",
    label: "Polygon",
    glyph: "⬠", // ⬠
    hint: "Draw a polygon",
    shortcut: "G",
  },
];

export const VECTOR_TOOL_BY_SHORTCUT: Record<string, VectorToolId> =
  Object.fromEntries(
    VECTOR_TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
  );

// The tools that draw a shape from a two-point drag (the pen is not one —
// it places anchors click by click).
export type VectorDragShapeTool = "rect" | "ellipse" | "line" | "polygon";

export function isDragShapeTool(tool: VectorToolId): tool is VectorDragShapeTool {
  return (
    tool === "rect" || tool === "ellipse" || tool === "line" || tool === "polygon"
  );
}
