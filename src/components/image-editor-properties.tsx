"use client";

import { useEffect, useRef } from "react";
import { ImageEditorColorPicker } from "@/components/image-editor-color-picker";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import {
  BUILTIN_TIPS,
  resolveStampTip,
  type CustomTip,
} from "@/lib/image-editor/brush-tips";
import { paintStamp } from "@/lib/image-editor/raster";
import type {
  BrushSettings,
  GradientSettings,
  ShapeSettings,
  TextSettings,
  ToolId,
} from "@/lib/image-editor/tools";
import type { Rect } from "@/lib/image-editor/types";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";

// Crop aspect presets: label + width/height ratio (null = unconstrained).
const CROP_ASPECTS: Array<{ label: string; value: number | null }> = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
];

// A small live preview of a brush tip, drawn with the real paintStamp so the
// swatch matches how the tip actually stamps.
function StencilPreview({
  tipId,
  customTips,
}: {
  tipId: string;
  customTips: CustomTip[];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = getComputedStyle(canvas).color || "#fff";
    paintStamp(ctx, canvas.width / 2, canvas.height / 2, {
      size: canvas.width * 0.82,
      color,
      hardness: 0.7,
      flow: 1,
      erase: false,
      tip: resolveStampTip(tipId, customTips),
    });
  }, [tipId, customTips]);
  return (
    <canvas
      ref={ref}
      width={30}
      height={30}
      className="image-editor-stencil-preview"
      aria-hidden="true"
    />
  );
}

// The overlapping foreground/background swatch (Photoshop's iconic control):
// front square = foreground, offset back square = background, a swap arc and a
// black/white default. Shared by the Properties tab (full) and the tool strip
// (compact). Selecting a square makes it the active swatch the picker edits.
export function FgBgSwatch({
  fgColor,
  bgColor,
  activeSwatch,
  onSelectSwatch,
  onSwapColors,
  onResetColors,
  compact = false,
}: {
  fgColor: string;
  bgColor: string;
  activeSwatch: "fg" | "bg";
  onSelectSwatch: (swatch: "fg" | "bg") => void;
  onSwapColors: () => void;
  onResetColors: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "ie-fgbg is-compact" : "ie-fgbg"}>
      <button
        type="button"
        className="ie-fgbg-square ie-fgbg-back"
        style={{ background: bgColor }}
        title="Background color"
        aria-label="Background color"
        aria-pressed={activeSwatch === "bg"}
        onClick={() => onSelectSwatch("bg")}
      />
      <button
        type="button"
        className="ie-fgbg-square ie-fgbg-front"
        style={{ background: fgColor }}
        title="Foreground color"
        aria-label="Foreground color"
        aria-pressed={activeSwatch === "fg"}
        onClick={() => onSelectSwatch("fg")}
      />
      <button
        type="button"
        className="ie-fgbg-swap"
        title="Swap colors (X)"
        aria-label="Swap foreground and background"
        onClick={onSwapColors}
      >
        ⇄
      </button>
      <button
        type="button"
        className="ie-fgbg-reset"
        title="Reset to black / white (D)"
        aria-label="Reset colors to black and white"
        onClick={onResetColors}
      >
        ◪
      </button>
    </div>
  );
}

interface PropertiesProps {
  tool: ToolId;
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
  tip: string;
  customTips: CustomTip[];
  onTipChange: (id: string) => void;
  onImportTip: () => void;
  shape: ShapeSettings;
  onShapeChange: (patch: Partial<ShapeSettings>) => void;
  text: TextSettings;
  onTextChange: (patch: Partial<TextSettings>) => void;
  gradient: GradientSettings;
  onGradientChange: (patch: Partial<GradientSettings>) => void;
  tolerance: number;
  onToleranceChange: (value: number) => void;
  cropRect: Rect | null;
  cropAspect: number | null;
  onCropRect: (rect: Rect | null) => void;
  onCropAspect: (aspect: number | null) => void;
  onCropApply: () => void;
  onCropSeed: () => void;
}

// The Properties tab of the right dock: color selection plus the options for the
// active tool (formerly stacked in the left toolbar). One tool's options show at
// a time, matching a pro editor's contextual properties panel.
export function ImageEditorProperties({
  tool,
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
  tip,
  customTips,
  onTipChange,
  onImportTip,
  shape,
  onShapeChange,
  text,
  onTextChange,
  gradient,
  onGradientChange,
  tolerance,
  onToleranceChange,
  cropRect,
  cropAspect,
  onCropRect,
  onCropAspect,
  onCropApply,
  onCropSeed,
}: PropertiesProps) {
  const aspectGroup = useRovingRadioGroup(
    CROP_ASPECTS.length,
    CROP_ASPECTS.findIndex((preset) => preset.value === cropAspect),
    (index) => {
      const preset = CROP_ASPECTS[index];
      if (!preset) return;
      onCropAspect(preset.value);
      if (cropRect && preset.value) {
        onCropRect({
          ...cropRect,
          height: Math.max(1, Math.round(cropRect.width / preset.value)),
        });
      }
    },
  );

  // The same size ceiling every doc-growing dialog enforces — a typed-in
  // crop cannot request an allocation the app would never allow elsewhere.
  const cropValid =
    cropRect !== null &&
    cropRect.width >= 2 &&
    cropRect.height >= 2 &&
    cropRect.width <= MAX_DOC_DIMENSION &&
    cropRect.height <= MAX_DOC_DIMENSION &&
    cropRect.width * cropRect.height <= MAX_DOC_PIXELS;
  const paintTool = tool === "brush" || tool === "eraser";
  const shapeTool =
    tool === "shape-rect" || tool === "shape-ellipse" || tool === "shape-line";

  return (
    <div className="image-editor-properties">
      <div className="image-editor-panel-block is-first">
        <span className="image-editor-panel-label">Color</span>
        <div className="image-editor-color-row">
          <FgBgSwatch
            fgColor={fgColor}
            bgColor={bgColor}
            activeSwatch={activeSwatch}
            onSelectSwatch={onSelectSwatch}
            onSwapColors={onSwapColors}
            onResetColors={onResetColors}
          />
          <span className="image-editor-active-swatch-label">
            {activeSwatch === "fg" ? "Foreground" : "Background"}
          </span>
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
          <div className="image-editor-stencil-group">
            <span className="image-editor-field-caption">Stencil</span>
            <div
              className="image-editor-stencil-grid"
              role="group"
              aria-label="Brush tip"
            >
              {BUILTIN_TIPS.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  className={
                    tip === def.id
                      ? "image-editor-stencil is-active"
                      : "image-editor-stencil"
                  }
                  aria-pressed={tip === def.id}
                  title={def.label}
                  aria-label={def.label}
                  onClick={() => onTipChange(def.id)}
                >
                  <StencilPreview tipId={def.id} customTips={customTips} />
                </button>
              ))}
              {customTips.map((custom) => (
                <button
                  key={custom.id}
                  type="button"
                  className={
                    tip === custom.id
                      ? "image-editor-stencil is-active"
                      : "image-editor-stencil"
                  }
                  aria-pressed={tip === custom.id}
                  title={custom.label}
                  aria-label={custom.label}
                  onClick={() => onTipChange(custom.id)}
                >
                  <StencilPreview tipId={custom.id} customTips={customTips} />
                </button>
              ))}
              <button
                type="button"
                className="image-editor-stencil is-import"
                title="Import a brush tip (PNG)"
                aria-label="Import a brush tip"
                onClick={onImportTip}
              >
                +
              </button>
            </div>
          </div>
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
                onChange={(event) => onTextChange({ italic: event.target.checked })}
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
            Drag inside to move, corners to scale, the top handle to rotate. Press
            Enter to apply, Esc to cancel.
          </p>
        </div>
      ) : null}

      {tool === "crop" ? (
        <div className="image-editor-panel-block">
          <span className="image-editor-panel-label">Crop</span>
          <div
            className="image-editor-aspect-row"
            role="radiogroup"
            aria-label="Aspect ratio"
          >
            {CROP_ASPECTS.map((preset, index) => (
              <button
                key={preset.label}
                type="button"
                role="radio"
                aria-checked={cropAspect === preset.value}
                className={
                  cropAspect === preset.value
                    ? "image-editor-aspect-btn is-active"
                    : "image-editor-aspect-btn"
                }
                onClick={() => {
                  onCropAspect(preset.value);
                  if (cropRect && preset.value) {
                    onCropRect({
                      ...cropRect,
                      height: Math.max(1, Math.round(cropRect.width / preset.value)),
                    });
                  }
                }}
                {...aspectGroup.itemProps(index)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {cropRect ? (
            <>
              <div className="image-editor-crop-grid">
                {(
                  [
                    ["X", "x"],
                    ["Y", "y"],
                    ["W", "width"],
                    ["H", "height"],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="image-editor-crop-field">
                    <span>{label}</span>
                    <input
                      type="number"
                      value={Math.round(cropRect[key])}
                      min={key === "width" || key === "height" ? 1 : undefined}
                      onChange={(event) => {
                        const raw = Number(event.target.value);
                        if (!Number.isFinite(raw)) {
                          return;
                        }
                        const value =
                          key === "width" || key === "height"
                            ? Math.max(1, Math.round(raw))
                            : Math.round(raw);
                        const next = { ...cropRect, [key]: value };
                        if (key === "width" && cropAspect) {
                          next.height = Math.max(1, Math.round(value / cropAspect));
                        }
                        if (key === "height" && cropAspect) {
                          next.width = Math.max(1, Math.round(value * cropAspect));
                        }
                        onCropRect(next);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="image-editor-crop-actions">
                <button
                  type="button"
                  className="button button-quiet button-small"
                  onClick={() => onCropRect(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-primary button-small"
                  disabled={!cropValid}
                  onClick={onCropApply}
                >
                  Apply crop
                </button>
              </div>
              {!cropValid ? (
                <p className="image-editor-hint">
                  Size must be 1–{MAX_DOC_DIMENSION.toLocaleString()}px per
                  side and under {Math.round(MAX_DOC_PIXELS / 1_000_000)}M
                  pixels total.
                </p>
              ) : (
                <p className="image-editor-hint">
                  Enter applies, Esc cancels. A region past the canvas edge
                  grows the canvas with transparent pixels.
                </p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={onCropSeed}
              >
                Set crop region
              </button>
              <p className="image-editor-hint">
                Drag a region on the canvas — or start from this button — then
                adjust it with handles, these fields, or an aspect preset.
                Enter or Apply commits the crop.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
