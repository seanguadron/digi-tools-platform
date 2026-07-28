"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";
import {
  clampPpi,
  fromPx,
  MAX_DOC_PPI,
  MIN_DOC_PPI,
  roundForUnit,
  toPx,
  type DocUnit,
} from "@/lib/units";

// Image size: the resample dialog, Photoshop-style. With "Resample" on, the
// pixel dimensions change (in px, physical units, or percent) and the content
// rescales. With it off, the pixels are frozen and only the resolution (PPI)
// changes — i.e. how large the same pixels print.

export type ResampleQuality = "smooth" | "pixelated";

interface ImageSizeDialogProps {
  open: boolean;
  width: number;
  height: number;
  ppi: number;
  onClose: () => void;
  onApply: (
    width: number,
    height: number,
    ppi: number,
    resample: boolean,
    quality: ResampleQuality,
  ) => void;
}

type DialogUnit = DocUnit | "percent";

export function ImageEditorImageSizeDialog({
  open,
  width,
  height,
  ppi,
  onClose,
  onApply,
}: ImageSizeDialogProps) {
  const [pw, setPw] = useState(width);
  const [ph, setPh] = useState(height);
  const [docPpi, setDocPpi] = useState(ppi);
  const [unit, setUnit] = useState<DialogUnit>("px");
  const [lock, setLock] = useState(true);
  const [resample, setResample] = useState(true);
  const [quality, setQuality] = useState<ResampleQuality>("smooth");
  const [wasOpen, setWasOpen] = useState(false);
  const ratio = width / height;

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPw(width);
      setPh(height);
      setDocPpi(ppi);
      setUnit("px");
      setLock(true);
      setResample(true);
      setQuality("smooth");
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
    pw >= 1 &&
    ph >= 1 &&
    pw <= MAX_DOC_DIMENSION &&
    ph <= MAX_DOC_DIMENSION &&
    pw * ph <= MAX_DOC_PIXELS;

  function displayValue(px: number, axis: "w" | "h"): number {
    if (unit === "px") return px;
    if (unit === "percent") {
      return Math.round((px / (axis === "w" ? width : height)) * 1000) / 10;
    }
    return roundForUnit(fromPx(px, unit, docPpi), unit);
  }

  function toPixels(value: number, axis: "w" | "h"): number {
    if (unit === "px") return Math.round(value);
    if (unit === "percent") {
      return Math.round(((axis === "w" ? width : height) * value) / 100);
    }
    return Math.round(toPx(value, unit, docPpi));
  }

  const changeWidth = (value: number) => {
    const next = Math.max(1, toPixels(value, "w"));
    setPw(next);
    if (lock && ratio > 0) {
      setPh(Math.max(1, Math.round(next / ratio)));
    }
  };
  const changeHeight = (value: number) => {
    const next = Math.max(1, toPixels(value, "h"));
    setPh(next);
    if (lock && ratio > 0) {
      setPw(Math.max(1, Math.round(next * ratio)));
    }
  };
  const changePpi = (value: number) => {
    const next = clampPpi(value);
    if (resample && (unit === "in" || unit === "cm" || unit === "mm")) {
      // Keep the displayed physical size: new PPI means new pixel counts.
      const physW = fromPx(pw, unit, docPpi);
      const physH = fromPx(ph, unit, docPpi);
      setPw(Math.max(1, Math.round(toPx(physW, unit, next))));
      setPh(Math.max(1, Math.round(toPx(physH, unit, next))));
    }
    setDocPpi(next);
  };

  const printedW = roundForUnit(fromPx(pw, "in", docPpi), "in");
  const printedH = roundForUnit(fromPx(ph, "in", docPpi), "in");

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
              min={0}
              step={unit === "px" ? 1 : 0.01}
              value={displayValue(pw, "w")}
              disabled={!resample}
              autoFocus
              onChange={(event) => changeWidth(Number(event.target.value))}
            />
          </label>
          <span className="image-editor-dialog-times">×</span>
          <label>
            <span>Height</span>
            <input
              type="number"
              min={0}
              step={unit === "px" ? 1 : 0.01}
              value={displayValue(ph, "h")}
              disabled={!resample}
              onChange={(event) => changeHeight(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Unit</span>
            <select
              className="image-editor-unit-select"
              value={unit}
              onChange={(event) => setUnit(event.target.value as DialogUnit)}
            >
              <option value="px">px</option>
              <option value="in">in</option>
              <option value="cm">cm</option>
              <option value="mm">mm</option>
              <option value="percent">%</option>
            </select>
          </label>
        </div>

        <div className="image-editor-dialog-size">
          <label>
            <span>Resolution</span>
            <input
              type="number"
              min={MIN_DOC_PPI}
              max={MAX_DOC_PPI}
              value={docPpi}
              onChange={(event) => changePpi(Number(event.target.value))}
            />
          </label>
          <span className="image-editor-dialog-unit">PPI</span>
        </div>

        <p className="image-editor-hint">
          {pw} × {ph}px — prints at {printedW} × {printedH} in.
        </p>

        <label className="image-editor-check">
          <input
            type="checkbox"
            checked={resample}
            onChange={(event) => setResample(event.target.checked)}
          />
          Resample (change pixel dimensions)
        </label>

        {resample ? (
          <>
            <label className="image-editor-check">
              <input
                type="checkbox"
                checked={lock}
                onChange={(event) => setLock(event.target.checked)}
              />
              Keep aspect ratio
            </label>
            <label className="image-editor-field-row">
              <span>Interpolation</span>
              <select
                className="image-editor-unit-select"
                value={quality}
                onChange={(event) =>
                  setQuality(event.target.value as ResampleQuality)
                }
              >
                <option value="smooth">Smooth (photos)</option>
                <option value="pixelated">Crisp (pixel art)</option>
              </select>
            </label>
          </>
        ) : (
          <p className="image-editor-hint">
            Pixels stay frozen — only the print resolution changes.
          </p>
        )}

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
                onApply(pw, ph, docPpi, resample, quality);
              }
            }}
          >
            {resample ? "Resample" : "Set resolution"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
