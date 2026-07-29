"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";

// Canvas size: grow or trim the working area around an anchor, without
// touching the pixels themselves (unlike Image size, which resamples).
// New area is transparent.

interface CanvasSizeDialogProps {
  open: boolean;
  width: number;
  height: number;
  onClose: () => void;
  onApply: (
    width: number,
    height: number,
    offsetX: number,
    offsetY: number,
  ) => void;
}

const ANCHOR_LABELS = [
  "Top left",
  "Top",
  "Top right",
  "Left",
  "Center",
  "Right",
  "Bottom left",
  "Bottom",
  "Bottom right",
];

export function ImageEditorCanvasSizeDialog({
  open,
  width,
  height,
  onClose,
  onApply,
}: CanvasSizeDialogProps) {
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [anchor, setAnchor] = useState(4); // center
  const [wasOpen, setWasOpen] = useState(false);
  // 3-column grid: Up/Down step by rows.
  const anchorGroup = useRovingRadioGroup(9, anchor, setAnchor, 3);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setW(width);
      setH(height);
      setAnchor(4);
    }
  }

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
    w >= 1 &&
    h >= 1 &&
    w <= MAX_DOC_DIMENSION &&
    h <= MAX_DOC_DIMENSION &&
    w * h <= MAX_DOC_PIXELS;

  function apply() {
    if (!valid) return;
    const ax = (anchor % 3) / 2; // 0 | 0.5 | 1
    const ay = Math.floor(anchor / 3) / 2;
    const offsetX = Math.round((w - width) * ax);
    const offsetY = Math.round((h - height) * ay);
    onApply(w, h, offsetX, offsetY);
  }

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
        aria-label="Canvas size"
      >
        <h2 className="image-editor-dialog-title">Canvas size</h2>
        <p className="image-editor-hint">
          Current canvas: {width} × {height}px. Pixels stay put; new area is
          transparent.
        </p>

        <div className="image-editor-dialog-size">
          <label>
            <span>Width</span>
            <input
              type="number"
              min={1}
              max={MAX_DOC_DIMENSION}
              value={w}
              autoFocus
              onChange={(event) => setW(Math.round(Number(event.target.value)))}
            />
          </label>
          <span className="image-editor-dialog-times">×</span>
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
        </div>

        <div className="image-editor-anchor-block">
          <span className="image-editor-panel-label">Anchor</span>
          <div
            className="image-editor-anchor-grid"
            role="radiogroup"
            aria-label="Anchor position"
          >
            {ANCHOR_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={anchor === index}
                aria-label={label}
                title={label}
                className={
                  anchor === index
                    ? "image-editor-anchor-cell is-active"
                    : "image-editor-anchor-cell"
                }
                onClick={() => setAnchor(index)}
                {...anchorGroup.itemProps(index)}
              />
            ))}
          </div>
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
            onClick={apply}
          >
            Resize canvas
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
