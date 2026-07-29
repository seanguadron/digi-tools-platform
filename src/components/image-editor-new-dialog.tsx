"use client";

import { useState } from "react";
import { EditorDialog } from "@/components/editor-dialog";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";
import {
  clampPpi,
  DEFAULT_DOC_PPI,
  MAX_DOC_PPI,
  MIN_DOC_PPI,
} from "@/lib/units";

// New document: screen and print presets, size + resolution, background.
// Rebuilt on the shared EditorDialog primitive (focus trap + restore).

interface Preset {
  label: string;
  width: number;
  height: number;
  ppi: number;
}

const PRESETS: Preset[] = [
  { label: "Default 1280×800", width: 1280, height: 800, ppi: DEFAULT_DOC_PPI },
  { label: "HD 1920×1080", width: 1920, height: 1080, ppi: DEFAULT_DOC_PPI },
  { label: "Square 1080×1080", width: 1080, height: 1080, ppi: DEFAULT_DOC_PPI },
  { label: "Portrait 1080×1350", width: 1080, height: 1350, ppi: DEFAULT_DOC_PPI },
  { label: "Letter 8.5×11 in @300", width: 2550, height: 3300, ppi: 300 },
  { label: "A4 210×297 mm @300", width: 2480, height: 3508, ppi: 300 },
];

export type NewDocBackground = "transparent" | "white" | "custom";

export function ImageEditorNewDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    width: number,
    height: number,
    ppi: number,
    background: string | null,
  ) => void;
}) {
  const [w, setW] = useState(1280);
  const [h, setH] = useState(800);
  const [ppi, setPpi] = useState(DEFAULT_DOC_PPI);
  const [background, setBackground] = useState<NewDocBackground>("transparent");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setW(1280);
      setH(800);
      setPpi(DEFAULT_DOC_PPI);
      setBackground("transparent");
      setCustomColor("#ffffff");
    }
  }

  const valid =
    w >= 1 &&
    h >= 1 &&
    w <= MAX_DOC_DIMENSION &&
    h <= MAX_DOC_DIMENSION &&
    w * h <= MAX_DOC_PIXELS;

  function backgroundColor(): string | null {
    if (background === "transparent") return null;
    if (background === "white") return "#ffffff";
    return customColor;
  }

  return (
    <EditorDialog open={open} label="New image" onClose={onClose}>
      <h2 className="editor-dialog-title">New image</h2>

      <div className="editor-dialog-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={
              w === preset.width && h === preset.height && ppi === preset.ppi
                ? "editor-dialog-preset is-active"
                : "editor-dialog-preset"
            }
            onClick={() => {
              setW(preset.width);
              setH(preset.height);
              setPpi(preset.ppi);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="editor-dialog-size">
        <label>
          <span>Width</span>
          <input
            type="number"
            min={1}
            max={MAX_DOC_DIMENSION}
            value={w}
            onChange={(event) => setW(Math.round(Number(event.target.value)))}
          />
        </label>
        <span className="editor-dialog-times">×</span>
        <label>
          <span>Height</span>
          <input
            type="number"
            min={1}
            max={MAX_DOC_DIMENSION}
            value={h}
            onChange={(event) => setH(Math.round(Number(event.target.value)))}
          />
        </label>
        <label>
          <span>PPI</span>
          <input
            type="number"
            min={MIN_DOC_PPI}
            max={MAX_DOC_PPI}
            value={ppi}
            onChange={(event) => setPpi(clampPpi(Number(event.target.value)))}
          />
        </label>
      </div>

      <div className="editor-dialog-row">
        <span className="editor-dialog-label">Background</span>
        <div
          className="editor-dialog-seg"
          role="radiogroup"
          aria-label="Background"
        >
          {(
            [
              ["transparent", "None"],
              ["white", "White"],
              ["custom", "Color"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={background === value}
              className={
                background === value
                  ? "editor-dialog-seg-btn is-active"
                  : "editor-dialog-seg-btn"
              }
              onClick={() => setBackground(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {background === "custom" ? (
          <input
            type="color"
            className="editor-dialog-swatch"
            aria-label="Background color"
            value={customColor}
            onChange={(event) => setCustomColor(event.target.value)}
          />
        ) : null}
      </div>

      {!valid ? (
        <p className="editor-dialog-hint">
          Size must be 1–{MAX_DOC_DIMENSION.toLocaleString()}px per side and
          under {Math.round(MAX_DOC_PIXELS / 1_000_000)}M pixels total.
        </p>
      ) : null}

      <div className="editor-dialog-actions">
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={!valid}
          onClick={() => {
            if (valid) {
              onCreate(w, h, ppi, backgroundColor());
            }
          }}
        >
          Create
        </button>
      </div>
    </EditorDialog>
  );
}
