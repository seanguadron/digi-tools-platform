// The editor's tool taxonomy — mirrors src/lib/architect/blocks.ts: a string
// union is the source of truth, TOOL_CATALOG is the ordered UI-facing list, and
// getTool() is the id->definition lookup with a safe fallback. Icons live in the
// toolbar component; this file is data only.

export type ToolId =
  | "move"
  | "brush"
  | "eraser"
  | "clone"
  | "smudge"
  | "fill"
  | "gradient"
  | "eyedropper"
  | "select-rect"
  | "select-ellipse"
  | "select-lasso"
  | "magic-wand"
  | "shape-rect"
  | "shape-ellipse"
  | "shape-line"
  | "text"
  | "transform"
  | "crop"
  | "hand";

export type ToolGroup = "nav" | "paint" | "select" | "vector" | "edit";

export interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string; // single key, shown in the tooltip and bound globally
  hint: string;
  group: ToolGroup;
  cursor: string; // CSS cursor while the tool is active over the canvas
}

export const TOOL_CATALOG: readonly ToolDef[] = [
  {
    id: "move",
    label: "Move",
    shortcut: "V",
    hint: "Move the active layer (or a floating selection).",
    group: "nav",
    cursor: "move",
  },
  {
    id: "brush",
    label: "Brush",
    shortcut: "B",
    hint: "Paint with the foreground color.",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "eraser",
    label: "Eraser",
    shortcut: "E",
    hint: "Erase to transparency on the active layer.",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "clone",
    label: "Clone stamp",
    shortcut: "S",
    hint: "Alt-click to set a source, then paint to copy from it.",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "smudge",
    label: "Smudge",
    shortcut: "U",
    hint: "Push and blend pixels along the stroke.",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "fill",
    label: "Fill",
    shortcut: "K",
    hint: "Flood-fill a contiguous area with the foreground color.",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "gradient",
    label: "Gradient",
    shortcut: "G",
    hint: "Drag to draw a gradient (foreground to background).",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "eyedropper",
    label: "Eyedropper",
    shortcut: "I",
    hint: "Pick a color from the canvas.",
    group: "paint",
    cursor: "crosshair",
  },
  {
    id: "select-rect",
    label: "Rectangle select",
    shortcut: "M",
    hint: "Select a rectangular region.",
    group: "select",
    cursor: "crosshair",
  },
  {
    id: "select-ellipse",
    label: "Ellipse select",
    shortcut: "J",
    hint: "Select an elliptical region.",
    group: "select",
    cursor: "crosshair",
  },
  {
    id: "select-lasso",
    label: "Lasso select",
    shortcut: "L",
    hint: "Draw a freehand selection.",
    group: "select",
    cursor: "crosshair",
  },
  {
    id: "magic-wand",
    label: "Magic wand",
    shortcut: "W",
    hint: "Select a contiguous area of similar color.",
    group: "select",
    cursor: "crosshair",
  },
  {
    id: "shape-rect",
    label: "Rectangle",
    shortcut: "R",
    hint: "Draw a rectangle.",
    group: "vector",
    cursor: "crosshair",
  },
  {
    id: "shape-ellipse",
    label: "Ellipse",
    shortcut: "O",
    hint: "Draw an ellipse.",
    group: "vector",
    cursor: "crosshair",
  },
  {
    id: "shape-line",
    label: "Line",
    shortcut: "N",
    hint: "Draw a straight line.",
    group: "vector",
    cursor: "crosshair",
  },
  {
    id: "text",
    label: "Text",
    shortcut: "T",
    hint: "Add a text layer.",
    group: "vector",
    cursor: "text",
  },
  {
    id: "transform",
    label: "Transform",
    shortcut: "Q",
    hint: "Move, scale, or rotate the active layer.",
    group: "edit",
    cursor: "move",
  },
  {
    id: "crop",
    label: "Crop",
    shortcut: "C",
    hint: "Crop the canvas to a region.",
    group: "edit",
    cursor: "crosshair",
  },
  {
    id: "hand",
    label: "Pan",
    shortcut: "H",
    hint: "Drag to pan the canvas.",
    group: "nav",
    cursor: "grab",
  },
];

// Live brush/eraser settings held by the orchestrator and passed to the canvas.
export interface BrushSettings {
  size: number; // diameter in doc px
  hardness: number; // 0..1
  flow: number; // 0..1 per-stamp alpha
  tip: string; // brush-tip / stencil id (see brush-tips.ts)
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 24,
  hardness: 0.85,
  flow: 1,
  tip: "round",
};

// Settings for the vector shape tools (rect/ellipse/line).
export interface ShapeSettings {
  strokeWidth: number;
  fill: boolean;
  stroke: boolean;
}

export const DEFAULT_SHAPE: ShapeSettings = {
  strokeWidth: 4,
  fill: true,
  stroke: false,
};

// Settings for the text tool.
export interface TextSettings {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export const DEFAULT_TEXT: TextSettings = {
  // A concrete family stack — canvas ctx.font can't resolve CSS variables.
  fontFamily: '"Open Sans", system-ui, sans-serif',
  fontSize: 48,
  bold: false,
  italic: false,
};

// Settings for the gradient tool.
export interface GradientSettings {
  type: "linear" | "radial";
  mode: "fg-bg" | "fg-transparent";
}

export const DEFAULT_GRADIENT: GradientSettings = {
  type: "linear",
  mode: "fg-bg",
};

const TOOL_BY_ID = new Map(TOOL_CATALOG.map((tool) => [tool.id, tool]));

export function getTool(id: ToolId): ToolDef {
  return TOOL_BY_ID.get(id) ?? TOOL_CATALOG[0];
}

export function toolForShortcut(key: string): ToolId | null {
  const upper = key.toUpperCase();
  const match = TOOL_CATALOG.find((tool) => tool.shortcut === upper);
  return match ? match.id : null;
}
