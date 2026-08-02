"use client";

import { useState } from "react";
import { EditorDialog } from "@/components/editor-dialog";
import {
  clampPpi,
  DOC_UNITS,
  fromPx,
  MAX_DOC_PPI,
  MIN_DOC_PPI,
  roundForUnit,
  toPx,
  type DocUnit,
} from "@/lib/units";

// Document setup: artboard size in any unit, resolution, background.
// Pixels stay the master unit; in/cm/mm are a view through the PPI.

const MAX_ARTBOARD = 20000; // matches project-io's MAX_DIMENSION

export interface DocSetupValue {
  width: number; // px
  height: number; // px
  ppi: number;
  unit: DocUnit;
  background: string | null;
}

export function VectorDocSetupDialog({
  open,
  value,
  onClose,
  onApply,
}: {
  open: boolean;
  value: DocSetupValue;
  onClose: () => void;
  onApply: (next: DocSetupValue) => void;
}) {
  const [pw, setPw] = useState(value.width);
  const [ph, setPh] = useState(value.height);
  const [ppi, setPpi] = useState(value.ppi);
  const [unit, setUnit] = useState<DocUnit>(value.unit);
  const [background, setBackground] = useState(value.background ?? "#ffffff");
  const [transparent, setTransparent] = useState(value.background === null);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPw(value.width);
      setPh(value.height);
      setPpi(value.ppi);
      setUnit(value.unit);
      setBackground(value.background ?? "#ffffff");
      setTransparent(value.background === null);
    }
  }

  const valid =
    pw >= 1 && ph >= 1 && pw <= MAX_ARTBOARD && ph <= MAX_ARTBOARD;

  function display(px: number): number {
    return unit === "px" ? Math.round(px) : roundForUnit(fromPx(px, unit, ppi), unit);
  }

  function toPixels(valueInUnit: number): number {
    return Math.max(1, Math.round(toPx(valueInUnit, unit, ppi)));
  }

  return (
    <EditorDialog open={open} label="Document setup" onClose={onClose}>
      <h2 className="editor-dialog-title">Document setup</h2>

      <div className="editor-dialog-size">
        <label>
          <span>Width</span>
          <input
            type="number"
            min={0}
            step={unit === "px" ? 1 : 0.01}
            value={display(pw)}
            onChange={(event) => setPw(toPixels(Number(event.target.value)))}
          />
        </label>
        <span className="editor-dialog-times">×</span>
        <label>
          <span>Height</span>
          <input
            type="number"
            min={0}
            step={unit === "px" ? 1 : 0.01}
            value={display(ph)}
            onChange={(event) => setPh(toPixels(Number(event.target.value)))}
          />
        </label>
        <label>
          <span>Unit</span>
          <select
            className="editor-dialog-select"
            value={unit}
            onChange={(event) => setUnit(event.target.value as DocUnit)}
          >
            {DOC_UNITS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="editor-dialog-size">
        <label>
          <span>Resolution</span>
          <input
            type="number"
            min={MIN_DOC_PPI}
            max={MAX_DOC_PPI}
            value={ppi}
            onChange={(event) => setPpi(clampPpi(Number(event.target.value)))}
          />
        </label>
        <span className="editor-dialog-unit">PPI</span>
      </div>

      <p className="editor-dialog-hint">
        {Math.round(pw)} × {Math.round(ph)} px ·{" "}
        {roundForUnit(fromPx(pw, "in", ppi), "in")} ×{" "}
        {roundForUnit(fromPx(ph, "in", ppi), "in")} in @ {ppi}ppi
      </p>

      <div className="editor-dialog-row">
        <label className="editor-dialog-check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(event) => setTransparent(event.target.checked)}
          />
          Transparent background
        </label>
        {!transparent ? (
          <input
            type="color"
            className="editor-dialog-swatch"
            aria-label="Background color"
            value={background}
            onChange={(event) => setBackground(event.target.value)}
          />
        ) : null}
      </div>

      {!valid ? (
        <p className="editor-dialog-hint">
          Size must be 1–{MAX_ARTBOARD.toLocaleString()}px per side.
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
            if (!valid) return;
            onApply({
              width: Math.round(pw),
              height: Math.round(ph),
              ppi,
              unit,
              background: transparent ? null : background,
            });
          }}
        >
          Apply
        </button>
      </div>
    </EditorDialog>
  );
}
