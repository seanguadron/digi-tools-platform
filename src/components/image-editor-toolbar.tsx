"use client";

import type { ReactNode } from "react";
import { ImageEditorColorPicker } from "@/components/image-editor-color-picker";
import type {
  BrushSettings,
  GradientSettings,
  ShapeSettings,
  TextSettings,
  ToolDef,
  ToolId,
} from "@/lib/image-editor/tools";
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
  recentColors: string[];
  onColorChange: (hex: string) => void;
  onSelectSwatch: (swatch: "fg" | "bg") => void;
  onSwapColors: () => void;
  onResetColors: () => void;
  brush: BrushSettings;
  onBrushChange: (patch: Partial<BrushSettings>) => void;
  shape: ShapeSettings;
  onShapeChange: (patch: Partial<ShapeSettings>) => void;
  text: TextSettings;
  onTextChange: (patch: Partial<TextSettings>) => void;
  gradient: GradientSettings;
  onGradientChange: (patch: Partial<GradientSettings>) => void;
  tolerance: number;
  onToleranceChange: (value: number) => void;
}

export function ImageEditorToolbar({
  tool,
  onToolChange,
  fgColor,
  bgColor,
  activeSwatch,
  recentColors,
  onColorChange,
  onSelectSwatch,
  onSwapColors,
  onResetColors,
  brush,
  onBrushChange,
  shape,
  onShapeChange,
  text,
  onTextChange,
  gradient,
  onGradientChange,
  tolerance,
  onToleranceChange,
}: ToolbarProps) {
  const paintTool = tool === "brush" || tool === "eraser";
  const shapeTool =
    tool === "shape-rect" || tool === "shape-ellipse" || tool === "shape-line";

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

      <div className="image-editor-panel-block">
        <span className="image-editor-panel-label">Color</span>
        <div className="image-editor-swatch-pair">
          <button
            type="button"
            className={
              activeSwatch === "fg"
                ? "image-editor-fgbg is-active"
                : "image-editor-fgbg"
            }
            style={{ background: fgColor }}
            title="Foreground color"
            aria-label="Foreground color"
            aria-pressed={activeSwatch === "fg"}
            onClick={() => onSelectSwatch("fg")}
          />
          <button
            type="button"
            className={
              activeSwatch === "bg"
                ? "image-editor-fgbg is-active"
                : "image-editor-fgbg"
            }
            style={{ background: bgColor }}
            title="Background color"
            aria-label="Background color"
            aria-pressed={activeSwatch === "bg"}
            onClick={() => onSelectSwatch("bg")}
          />
          <div className="image-editor-fgbg-controls">
            <button
              type="button"
              className="image-editor-icon-btn"
              title="Swap colors (X)"
              aria-label="Swap foreground and background"
              onClick={onSwapColors}
            >
              ⇄
            </button>
            <button
              type="button"
              className="image-editor-icon-btn"
              title="Reset to black / white (D)"
              aria-label="Reset colors to black and white"
              onClick={onResetColors}
            >
              ◑
            </button>
          </div>
        </div>
        <ImageEditorColorPicker
          color={activeSwatch === "fg" ? fgColor : bgColor}
          onChange={onColorChange}
          recentColors={recentColors}
        />
      </div>

      {tool === "gradient" ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">Gradient</span>
          <div className="image-editor-seg" role="group" aria-label="Gradient type">
            <button
              type="button"
              className={gradient.type === "linear" ? "is-active" : ""}
              aria-pressed={gradient.type === "linear"}
              onClick={() => onGradientChange({ type: "linear" })}
            >
              Linear
            </button>
            <button
              type="button"
              className={gradient.type === "radial" ? "is-active" : ""}
              aria-pressed={gradient.type === "radial"}
              onClick={() => onGradientChange({ type: "radial" })}
            >
              Radial
            </button>
          </div>
          <div className="image-editor-seg" role="group" aria-label="Gradient colors">
            <button
              type="button"
              className={gradient.mode === "fg-bg" ? "is-active" : ""}
              aria-pressed={gradient.mode === "fg-bg"}
              onClick={() => onGradientChange({ mode: "fg-bg" })}
            >
              FG → BG
            </button>
            <button
              type="button"
              className={gradient.mode === "fg-transparent" ? "is-active" : ""}
              aria-pressed={gradient.mode === "fg-transparent"}
              onClick={() => onGradientChange({ mode: "fg-transparent" })}
            >
              FG → clear
            </button>
          </div>
        </div>
      ) : null}

      {paintTool ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">
            {tool === "eraser" ? "Eraser" : "Brush"}
          </span>
          <label className="image-editor-slider">
            <span>
              Size <strong>{Math.round(brush.size)}px</strong>
            </span>
            <input
              type="range"
              min={1}
              max={400}
              value={brush.size}
              onChange={(event) =>
                onBrushChange({ size: Number(event.target.value) })
              }
            />
          </label>
          <label className="image-editor-slider">
            <span>
              Hardness <strong>{Math.round(brush.hardness * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(brush.hardness * 100)}
              onChange={(event) =>
                onBrushChange({ hardness: Number(event.target.value) / 100 })
              }
            />
          </label>
          <label className="image-editor-slider">
            <span>
              Flow <strong>{Math.round(brush.flow * 100)}%</strong>
            </span>
            <input
              type="range"
              min={1}
              max={100}
              value={Math.round(brush.flow * 100)}
              onChange={(event) =>
                onBrushChange({ flow: Number(event.target.value) / 100 })
              }
            />
          </label>
        </div>
      ) : null}

      {tool === "fill" || tool === "magic-wand" ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">
            {tool === "magic-wand" ? "Magic wand" : "Fill"}
          </span>
          <label className="image-editor-slider">
            <span>
              Tolerance <strong>{tolerance}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={128}
              value={tolerance}
              onChange={(event) => onToleranceChange(Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}

      {shapeTool ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">Shape</span>
          {tool !== "shape-line" ? (
            <div className="image-editor-toggle-row">
              <label className="image-editor-check">
                <input
                  type="checkbox"
                  checked={shape.fill}
                  onChange={(event) => onShapeChange({ fill: event.target.checked })}
                />
                Fill
              </label>
              <label className="image-editor-check">
                <input
                  type="checkbox"
                  checked={shape.stroke}
                  onChange={(event) =>
                    onShapeChange({ stroke: event.target.checked })
                  }
                />
                Stroke
              </label>
            </div>
          ) : null}
          <label className="image-editor-slider">
            <span>
              {tool === "shape-line" ? "Width" : "Stroke width"}{" "}
              <strong>{shape.strokeWidth}px</strong>
            </span>
            <input
              type="range"
              min={1}
              max={80}
              value={shape.strokeWidth}
              onChange={(event) =>
                onShapeChange({ strokeWidth: Number(event.target.value) })
              }
            />
          </label>
        </div>
      ) : null}

      {tool === "text" ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">Text</span>
          <label className="image-editor-slider">
            <span>
              Size <strong>{text.fontSize}px</strong>
            </span>
            <input
              type="range"
              min={8}
              max={200}
              value={text.fontSize}
              onChange={(event) =>
                onTextChange({ fontSize: Number(event.target.value) })
              }
            />
          </label>
          <div className="image-editor-toggle-row">
            <label className="image-editor-check">
              <input
                type="checkbox"
                checked={text.bold}
                onChange={(event) => onTextChange({ bold: event.target.checked })}
              />
              Bold
            </label>
            <label className="image-editor-check">
              <input
                type="checkbox"
                checked={text.italic}
                onChange={(event) =>
                  onTextChange({ italic: event.target.checked })
                }
              />
              Italic
            </label>
          </div>
          <p className="image-editor-hint">
            Click the canvas, type, then press Enter.
          </p>
        </div>
      ) : null}

      {tool === "transform" ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">Transform</span>
          <p className="image-editor-hint">
            Drag inside to move, corners to scale, the top handle to rotate.
            Press Enter to apply, Esc to cancel.
          </p>
        </div>
      ) : null}

      {tool === "crop" ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">Crop</span>
          <p className="image-editor-hint">
            Drag a region on the canvas; release to crop to it.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
