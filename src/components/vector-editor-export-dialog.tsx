"use client";

import { useState } from "react";
import { EditorDialog } from "@/components/editor-dialog";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import {
  formatSize,
  MAX_EXPORT_DIMENSION,
  MAX_EXPORT_PIXELS,
} from "@/lib/units";
import type { DocUnit } from "@/lib/units";

// Export: SVG as-is, or a bitmap at a chosen scale / exact pixel size.
// Replaces the silent hardcoded 2x PNG.

export type VectorExportFormat = "svg" | "png" | "jpeg";

export interface VectorExportOptions {
  format: VectorExportFormat;
  scale: number; // bitmap only
  transparent: boolean; // png only — drop the artboard background
  quality: number; // jpeg only, 0..1
}

const SCALE_PRESETS = [1, 2, 3];

export function VectorExportDialog({
  open,
  width,
  height,
  ppi,
  unit,
  hasBackground,
  fileBase,
  onClose,
  onExport,
}: {
  open: boolean;
  width: number;
  height: number;
  ppi: number;
  unit: DocUnit;
  hasBackground: boolean;
  fileBase: string;
  onClose: () => void;
  onExport: (options: VectorExportOptions) => void;
}) {
  const [format, setFormat] = useState<VectorExportFormat>("svg");
  const [scale, setScale] = useState(1);
  const [exactWidth, setExactWidth] = useState<number | null>(null);
  const [transparent, setTransparent] = useState(false);
  const [quality, setQuality] = useState(0.92);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFormat("svg");
      setScale(1);
      setExactWidth(null);
      setTransparent(false);
      setQuality(0.92);
    }
  }

  const FORMATS: VectorExportFormat[] = ["svg", "png", "jpeg"];
  const formatGroup = useRovingRadioGroup(
    FORMATS.length,
    FORMATS.indexOf(format),
    (index) => setFormat(FORMATS[index]),
  );
  const scaleGroup = useRovingRadioGroup(
    SCALE_PRESETS.length,
    exactWidth === null ? SCALE_PRESETS.indexOf(scale) : -1,
    (index) => {
      setScale(SCALE_PRESETS[index]);
      setExactWidth(null);
    },
  );

  const effectiveScale = exactWidth ? exactWidth / width : scale;
  const outWidth = Math.max(1, Math.round(width * effectiveScale));
  const outHeight = Math.max(1, Math.round(height * effectiveScale));
  const bitmap = format !== "svg";
  const valid =
    !bitmap ||
    (outWidth <= MAX_EXPORT_DIMENSION &&
      outHeight <= MAX_EXPORT_DIMENSION &&
      outWidth * outHeight <= MAX_EXPORT_PIXELS);

  const extension = format === "jpeg" ? "jpg" : format;

  return (
    <EditorDialog open={open} label="Export artwork" onClose={onClose}>
      <h2 className="editor-dialog-title">Export</h2>

      <div className="editor-dialog-seg" role="radiogroup" aria-label="Format">
        {FORMATS.map((entry, index) => (
          <button
            key={entry}
            type="button"
            role="radio"
            aria-checked={format === entry}
            className={
              format === entry
                ? "editor-dialog-seg-btn is-active"
                : "editor-dialog-seg-btn"
            }
            onClick={() => setFormat(entry)}
            {...formatGroup.itemProps(index)}
          >
            {entry === "jpeg" ? "JPG" : entry.toUpperCase()}
          </button>
        ))}
      </div>

      {format === "svg" ? (
        <p className="editor-dialog-hint">
          The live scene, exported losslessly — text stays selectable, paths
          stay editable. {formatSize(width, unit, ppi)} ×{" "}
          {formatSize(height, unit, ppi)}.
        </p>
      ) : (
        <>
          <div className="editor-dialog-row">
            <span className="editor-dialog-label">Scale</span>
            <div className="editor-dialog-seg" role="radiogroup" aria-label="Scale">
              {SCALE_PRESETS.map((preset, index) => (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={exactWidth === null && scale === preset}
                  className={
                    exactWidth === null && scale === preset
                      ? "editor-dialog-seg-btn is-active"
                      : "editor-dialog-seg-btn"
                  }
                  onClick={() => {
                    setScale(preset);
                    setExactWidth(null);
                  }}
                  {...scaleGroup.itemProps(index)}
                >
                  {preset}×
                </button>
              ))}
            </div>
          </div>
          <div className="editor-dialog-size">
            <label>
              <span>Width</span>
              <input
                type="number"
                min={1}
                max={MAX_EXPORT_DIMENSION}
                value={outWidth}
                onChange={(event) => {
                  const next = Math.round(Number(event.target.value));
                  if (Number.isFinite(next) && next >= 1) {
                    setExactWidth(next);
                  }
                }}
              />
            </label>
            <span className="editor-dialog-times">×</span>
            <label>
              <span>Height</span>
              <input type="number" value={outHeight} readOnly disabled />
            </label>
            <span className="editor-dialog-unit">px</span>
          </div>
          {format === "png" ? (
            <label className="editor-dialog-check">
              <input
                type="checkbox"
                checked={transparent}
                disabled={!hasBackground}
                onChange={(event) => setTransparent(event.target.checked)}
              />
              Transparent background
              {!hasBackground ? " (already transparent)" : ""}
            </label>
          ) : (
            <label className="editor-dialog-field-row">
              <span>Quality {Math.round(quality * 100)}%</span>
              <input
                type="range"
                min={50}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(event) =>
                  setQuality(Number(event.target.value) / 100)
                }
              />
            </label>
          )}
          {!valid ? (
            <p className="editor-dialog-hint">
              Bitmap exports cap at {MAX_EXPORT_DIMENSION.toLocaleString()}px
              per side and {Math.round(MAX_EXPORT_PIXELS / 1_000_000)}M pixels
              total.
            </p>
          ) : null}
        </>
      )}

      <p className="editor-dialog-hint">
        Saves as {fileBase}.{extension}
      </p>

      <div className="editor-dialog-actions">
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onExport({
              format,
              scale: effectiveScale,
              transparent: format === "png" && transparent,
              quality,
            });
          }}
        >
          Export
        </button>
      </div>
    </EditorDialog>
  );
}
