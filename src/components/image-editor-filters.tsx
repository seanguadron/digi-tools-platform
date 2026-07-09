"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyAdjustments,
  NEUTRAL_ADJUSTMENTS,
  type Adjustments,
} from "@/lib/image-editor/filters";

const PREVIEW_W = 260;
const PREVIEW_H = 170;

interface FiltersDialogProps {
  open: boolean;
  sourceBitmap: HTMLCanvasElement | null;
  onClose: () => void;
  onApply: (adjustments: Adjustments) => void;
}

export function ImageEditorFilters({
  open,
  sourceBitmap,
  onClose,
  onApply,
}: FiltersDialogProps) {
  const [adj, setAdj] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // Reset controls each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAdj(NEUTRAL_ADJUSTMENTS);
    }
  }

  // A small downscaled copy of the source to preview against cheaply.
  const previewSource = useMemo(() => {
    if (!open || !sourceBitmap || typeof document === "undefined") {
      return null;
    }
    const scale = Math.min(
      PREVIEW_W / sourceBitmap.width,
      PREVIEW_H / sourceBitmap.height,
      1,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceBitmap.width * scale));
    canvas.height = Math.max(1, Math.round(sourceBitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(sourceBitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, [open, sourceBitmap]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !previewSource) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const adjusted = applyAdjustments(previewSource, adj);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      adjusted,
      (canvas.width - adjusted.width) / 2,
      (canvas.height - adjusted.height) / 2,
    );
  }, [adj, previewSource]);

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

  return createPortal(
    <>
      <button
        type="button"
        className="image-editor-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="image-editor-dialog image-editor-filters-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Adjustments"
      >
        <h2 className="image-editor-dialog-title">Adjust</h2>

        <canvas
          ref={previewRef}
          width={PREVIEW_W}
          height={PREVIEW_H}
          className="image-editor-filters-preview"
        />

        <label className="image-editor-slider">
          <span>
            Brightness <strong>{adj.brightness}</strong>
          </span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adj.brightness}
            autoFocus
            onChange={(event) =>
              setAdj((a) => ({ ...a, brightness: Number(event.target.value) }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Contrast <strong>{adj.contrast}</strong>
          </span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adj.contrast}
            onChange={(event) =>
              setAdj((a) => ({ ...a, contrast: Number(event.target.value) }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Hue <strong>{adj.hue}°</strong>
          </span>
          <input
            type="range"
            min={-180}
            max={180}
            value={adj.hue}
            onChange={(event) =>
              setAdj((a) => ({ ...a, hue: Number(event.target.value) }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Saturation <strong>{adj.saturation}</strong>
          </span>
          <input
            type="range"
            min={-100}
            max={100}
            value={adj.saturation}
            onChange={(event) =>
              setAdj((a) => ({ ...a, saturation: Number(event.target.value) }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Blur <strong>{adj.blur}px</strong>
          </span>
          <input
            type="range"
            min={0}
            max={20}
            value={adj.blur}
            onChange={(event) =>
              setAdj((a) => ({ ...a, blur: Number(event.target.value) }))
            }
          />
        </label>
        <div className="image-editor-toggle-row">
          <label className="image-editor-check">
            <input
              type="checkbox"
              checked={adj.grayscale}
              onChange={(event) =>
                setAdj((a) => ({ ...a, grayscale: event.target.checked }))
              }
            />
            Grayscale
          </label>
          <label className="image-editor-check">
            <input
              type="checkbox"
              checked={adj.invert}
              onChange={(event) =>
                setAdj((a) => ({ ...a, invert: event.target.checked }))
              }
            />
            Invert
          </label>
        </div>

        <div className="image-editor-dialog-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onApply(adj)}
          >
            Apply
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
