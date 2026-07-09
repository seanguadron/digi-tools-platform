"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  MAX_DOC_DIMENSION,
  MAX_DOC_PIXELS,
} from "@/lib/image-editor/types";

const PRESETS: { label: string; width: number; height: number }[] = [
  { label: "Default 1280 × 800", width: 1280, height: 800 },
  { label: "HD 1920 × 1080", width: 1920, height: 1080 },
  { label: "Square 1080 × 1080", width: 1080, height: 1080 },
  { label: "Portrait 1080 × 1350", width: 1080, height: 1350 },
  { label: "Small 800 × 600", width: 800, height: 600 },
];

interface NewDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (width: number, height: number) => void;
}

export function ImageEditorNewDialog({ open, onClose, onCreate }: NewDialogProps) {
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const valid =
    width >= 1 &&
    height >= 1 &&
    width <= MAX_DOC_DIMENSION &&
    height <= MAX_DOC_DIMENSION &&
    width * height <= MAX_DOC_PIXELS;

  return createPortal(
    <>
      <button
        type="button"
        className="image-editor-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="image-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New canvas"
      >
        <h2 className="image-editor-dialog-title">New canvas</h2>

        <div className="image-editor-dialog-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={
                width === preset.width && height === preset.height
                  ? "image-editor-preset is-active"
                  : "image-editor-preset"
              }
              onClick={() => {
                setWidth(preset.width);
                setHeight(preset.height);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="image-editor-dialog-size">
          <label>
            <span>Width</span>
            <input
              type="number"
              min={1}
              max={MAX_DOC_DIMENSION}
              value={width}
              autoFocus
              onChange={(event) => setWidth(Math.round(Number(event.target.value)))}
            />
          </label>
          <span className="image-editor-dialog-times">×</span>
          <label>
            <span>Height</span>
            <input
              type="number"
              min={1}
              max={MAX_DOC_DIMENSION}
              value={height}
              onChange={(event) => setHeight(Math.round(Number(event.target.value)))}
            />
          </label>
        </div>

        {!valid ? (
          <p className="image-editor-hint">
            Size must be 1–{MAX_DOC_DIMENSION.toLocaleString()}px per side and
            under {Math.round(MAX_DOC_PIXELS / 1_000_000)}M pixels total.
          </p>
        ) : null}

        <div className="image-editor-dialog-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!valid}
            onClick={() => {
              if (valid) {
                onCreate(width, height);
              }
            }}
          >
            Create
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
