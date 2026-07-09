"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";

interface ImageSizeDialogProps {
  open: boolean;
  width: number;
  height: number;
  onClose: () => void;
  onApply: (width: number, height: number) => void;
}

export function ImageEditorImageSizeDialog({
  open,
  width,
  height,
  onClose,
  onApply,
}: ImageSizeDialogProps) {
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [lock, setLock] = useState(true);
  const [wasOpen, setWasOpen] = useState(false);
  const ratio = width / height;

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setW(width);
      setH(height);
      setLock(true);
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

  const changeWidth = (value: number) => {
    setW(value);
    if (lock && ratio > 0) {
      setH(Math.max(1, Math.round(value / ratio)));
    }
  };
  const changeHeight = (value: number) => {
    setH(value);
    if (lock && ratio > 0) {
      setW(Math.max(1, Math.round(value * ratio)));
    }
  };

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
        aria-label="Image size"
      >
        <h2 className="image-editor-dialog-title">Image size</h2>

        <div className="image-editor-dialog-size">
          <label>
            <span>Width</span>
            <input
              type="number"
              min={1}
              max={MAX_DOC_DIMENSION}
              value={w}
              autoFocus
              onChange={(event) => changeWidth(Math.round(Number(event.target.value)))}
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
              onChange={(event) => changeHeight(Math.round(Number(event.target.value)))}
            />
          </label>
        </div>

        <label className="image-editor-check">
          <input
            type="checkbox"
            checked={lock}
            onChange={(event) => setLock(event.target.checked)}
          />
          Keep aspect ratio
        </label>

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
                onApply(w, h);
              }
            }}
          >
            Resample
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
