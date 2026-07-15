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
  // When true, render inline (inside the Adjust dock tab) instead of as a modal:
  // no portal, backdrop, aria-modal, or Escape handler, and always mounted.
  embedded?: boolean;
}

export function ImageEditorFilters({
  open,
  sourceBitmap,
  onClose,
  onApply,
  embedded = false,
}: FiltersDialogProps) {
  const [adj, setAdj] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // Embedded is always "open"; the modal is gated by `open`.
  const isOpen = embedded || open;

  // Modal: reset each time it opens. Embedded: reset when the active layer
  // (its bitmap identity) changes, since a fresh layer starts from neutral.
  const [wasOpen, setWasOpen] = useState(false);
  if (!embedded && open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAdj(NEUTRAL_ADJUSTMENTS);
    }
  }
  const [prevSource, setPrevSource] = useState(sourceBitmap);
  if (embedded && sourceBitmap !== prevSource) {
    setPrevSource(sourceBitmap);
    setAdj(NEUTRAL_ADJUSTMENTS);
  }

  // A small downscaled copy of the source to preview against cheaply.
  const previewSource = useMemo(() => {
    if (!isOpen || !sourceBitmap || typeof document === "undefined") {
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
  }, [isOpen, sourceBitmap]);

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
    if (!open || embedded) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, embedded, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const body = (
    <>
      {!embedded ? <h2 className="image-editor-dialog-title">Adjust</h2> : null}

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
        <p className="image-editor-panel-label image-editor-filters-group">
          Levels
        </p>
        <label className="image-editor-slider">
          <span>
            Levels black <strong>{adj.levelsBlack}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={254}
            value={adj.levelsBlack}
            onChange={(event) =>
              setAdj((a) => ({
                ...a,
                levelsBlack: Math.min(a.levelsWhite - 1, Number(event.target.value)),
              }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Levels white <strong>{adj.levelsWhite}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={255}
            value={adj.levelsWhite}
            onChange={(event) =>
              setAdj((a) => ({
                ...a,
                levelsWhite: Math.max(a.levelsBlack + 1, Number(event.target.value)),
              }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Gamma <strong>{adj.gamma.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0.1}
            max={4}
            step={0.05}
            value={adj.gamma}
            onChange={(event) =>
              setAdj((a) => ({ ...a, gamma: Number(event.target.value) }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Posterize{" "}
            <strong>{adj.posterize <= 1 ? "off" : adj.posterize}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={32}
            value={adj.posterize}
            onChange={(event) =>
              setAdj((a) => ({ ...a, posterize: Number(event.target.value) }))
            }
          />
        </label>
        <label className="image-editor-slider">
          <span>
            Threshold{" "}
            <strong>{adj.threshold === 0 ? "off" : adj.threshold}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={255}
            value={adj.threshold}
            onChange={(event) =>
              setAdj((a) => ({ ...a, threshold: Number(event.target.value) }))
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
        <button
          type="button"
          className="button button-quiet"
          onClick={embedded ? () => setAdj(NEUTRAL_ADJUSTMENTS) : onClose}
        >
          {embedded ? "Reset" : "Cancel"}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={() => onApply(adj)}
          disabled={embedded && !sourceBitmap}
        >
          Apply
        </button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="image-editor-adjust-panel">{body}</div>;
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
        {body}
      </div>
    </>,
    document.body,
  );
}
