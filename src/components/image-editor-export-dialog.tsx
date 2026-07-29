"use client";

import { useState } from "react";
import { EditorDialog } from "@/components/editor-dialog";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";

// Export: PNG or JPG at a chosen scale / exact pixel size, with a real
// quality control for JPG (previously hardcoded at 0.92). Built on the
// shared EditorDialog primitive (focus trap + restore).

export type ImageExportFormat = "png" | "jpeg";

export interface ImageExportOptions {
  format: ImageExportFormat;
  width: number; // output pixels
  height: number;
  quality: number; // jpeg only, 0..1
}

const SCALE_PRESETS = [0.5, 1, 2];
const MAX_EXPORT_DIMENSION = 12000;

export function ImageEditorExportDialog({
  open,
  width,
  height,
  fileBase,
  onClose,
  onExport,
}: {
  open: boolean;
  width: number;
  height: number;
  fileBase: string;
  onClose: () => void;
  onExport: (options: ImageExportOptions) => void;
}) {
  const [format, setFormat] = useState<ImageExportFormat>("png");
  const [scale, setScale] = useState(1);
  const [exactWidth, setExactWidth] = useState<number | null>(null);
  const [quality, setQuality] = useState(0.92);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFormat("png");
      setScale(1);
      setExactWidth(null);
      setQuality(0.92);
    }
  }

  const FORMATS: ImageExportFormat[] = ["png", "jpeg"];
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
  const valid =
    outWidth <= MAX_EXPORT_DIMENSION && outHeight <= MAX_EXPORT_DIMENSION;
  const extension = format === "jpeg" ? "jpg" : "png";

  return (
    <EditorDialog open={open} label="Export image" onClose={onClose}>
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
            {entry === "jpeg" ? "JPG" : "PNG"}
          </button>
        ))}
      </div>

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

      {format === "jpeg" ? (
        <>
          <label className="editor-dialog-field-row">
            <span>Quality {Math.round(quality * 100)}%</span>
            <input
              type="range"
              min={50}
              max={100}
              value={Math.round(quality * 100)}
              onChange={(event) => setQuality(Number(event.target.value) / 100)}
            />
          </label>
          <p className="editor-dialog-hint">
            JPG has no transparency — transparent areas matte onto white.
          </p>
        </>
      ) : null}

      {!valid ? (
        <p className="editor-dialog-hint">
          Exports cap at {MAX_EXPORT_DIMENSION.toLocaleString()}px per side.
        </p>
      ) : null}

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
            onExport({ format, width: outWidth, height: outHeight, quality });
          }}
        >
          Export
        </button>
      </div>
    </EditorDialog>
  );
}
