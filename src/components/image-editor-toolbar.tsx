"use client";

import type { ReactNode } from "react";
import { FgBgSwatch } from "@/components/image-editor-properties";
import type { ToolDef, ToolId } from "@/lib/image-editor/tools";
import { TOOL_CATALOG } from "@/lib/image-editor/tools";

// Compact 20×20 line icons, stroke = currentColor so they inherit theme tokens.
const ICONS: Record<ToolId, ReactNode> = {
  move: (
    <path d="M10 3v14M3 10h14M10 3 7 6m3-3 3 3M10 17l-3-3m3 3 3-3M3 10l3-3m-3 3 3 3m11-3-3-3m3 3-3 3" />
  ),
  brush: (
    <path d="M4 16c0-2 1-3 3-3l7-7 3 3-7 7c0 2-1 3-3 3-2 0-3-1-3-3Z" />
  ),
  eraser: (
    <path d="M6 15 4 13a2 2 0 0 1 0-3l6-6a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-5 5H6Zm3 0 6-6" />
  ),
  clone: (
    <path d="M6 17h8v-3H6zM8 14V6a2 2 0 0 1 4 0v8M7 6h6" />
  ),
  smudge: (
    <path d="M4 14c3-1 4-5 7-5 2 0 3 1.4 3 3s-1.6 3-3.5 3M15 6l2 2-2 2" />
  ),
  fill: (
    <path d="M8 3 5 6l5 5 5-5-4-4M5 6l-2 2 5 5 2-2M16 13c1 1.5 1 3 0 3s-1-1.5 0-3Z" />
  ),
  gradient: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="1" />
      <path d="M3 15 17 5" />
    </>
  ),
  eyedropper: (
    <path d="m13 3 4 4-2 2-1-1-6 6-1 3-3 1 1-3 6-6-1-1 2-2ZM11 7l2 2" />
  ),
  "select-rect": (
    <path
      d="M3 3h3M9 3h2M14 3h3v3M17 9v2M17 14v3h-3M11 17H9M6 17H3v-3M3 11V9M3 6V3"
      strokeDasharray="0"
    />
  ),
  "select-ellipse": <ellipse cx="10" cy="10" rx="7" ry="5" strokeDasharray="2 2" />,
  "select-lasso": (
    <path d="M4 12c0-5 4-8 7-8s6 2 6 6-3 5-6 5-4 1-4 3 1 2 2 2" />
  ),
  "magic-wand": (
    <>
      <path d="M4 16 12 8" />
      <path d="M14 3l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" />
    </>
  ),
  "shape-rect": <rect x="3" y="5" width="14" height="10" rx="1" />,
  "shape-ellipse": <ellipse cx="10" cy="10" rx="7" ry="5" />,
  "shape-line": <path d="M4 16 16 4" />,
  text: <path d="M4 5h12M10 5v11M7 16h6" />,
  transform: (
    <path d="M5 5h10v10H5zM5 5 3 3m12 2 2-2M5 15l-2 2m12-2 2 2" />
  ),
  crop: <path d="M6 2v12h12M2 6h12v12" />,
  hand: (
    <path d="M7 11V6a1.2 1.2 0 0 1 2.4 0m0 0V5a1.2 1.2 0 0 1 2.4 0v1m0 0a1.2 1.2 0 0 1 2.4 0v4c0 3-2 6-5 6s-4-1-5-3l-2-3c-.5-1 .8-2 1.6-1l1.2 1.4" />
  ),
};

function ToolButton({
  tool,
  active,
  onSelect,
}: {
  tool: ToolDef;
  active: boolean;
  onSelect: (id: ToolId) => void;
}) {
  return (
    <button
      type="button"
      className={active ? "image-editor-tool is-active" : "image-editor-tool"}
      onClick={() => onSelect(tool.id)}
      title={`${tool.label} (${tool.shortcut})`}
      aria-label={`${tool.label} (${tool.shortcut})`}
      aria-pressed={active}
    >
      <svg
        viewBox="0 0 20 20"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[tool.id]}
      </svg>
    </button>
  );
}

interface ToolbarProps {
  tool: ToolId;
  onToolChange: (id: ToolId) => void;
  fgColor: string;
  bgColor: string;
  activeSwatch: "fg" | "bg";
  onSelectSwatch: (swatch: "fg" | "bg") => void;
  onSwapColors: () => void;
  onResetColors: () => void;
}

// The left tool strip: a narrow vertical rail of tool icons plus the overlapping
// FG/BG swatch at the bottom (Photoshop layout). Tool options moved to the
// Properties tab of the right dock.
export function ImageEditorToolbar({
  tool,
  onToolChange,
  fgColor,
  bgColor,
  activeSwatch,
  onSelectSwatch,
  onSwapColors,
  onResetColors,
}: ToolbarProps) {
  return (
    <aside className="image-editor-toolbar" aria-label="Tools">
      <div className="image-editor-tool-grid" role="toolbar" aria-label="Tools">
        {TOOL_CATALOG.map((toolDef) => (
          <ToolButton
            key={toolDef.id}
            tool={toolDef}
            active={tool === toolDef.id}
            onSelect={onToolChange}
          />
        ))}
      </div>

      <FgBgSwatch
        fgColor={fgColor}
        bgColor={bgColor}
        activeSwatch={activeSwatch}
        onSelectSwatch={onSelectSwatch}
        onSwapColors={onSwapColors}
        onResetColors={onResetColors}
        compact
      />
    </aside>
  );
}
