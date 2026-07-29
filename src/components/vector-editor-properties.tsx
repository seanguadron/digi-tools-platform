"use client";

import type { ChangeEvent } from "react";
import { objectBounds } from "@/lib/vector-editor/geometry";
import {
  fitObjectToBounds,
  translateObject,
} from "@/lib/vector-editor/transform";
import type { AnchorSelection } from "@/components/vector-editor-canvas";
import {
  FONT_FAMILIES,
  MAX_FONT_SIZE,
  MAX_TEXT_LENGTH,
  MIN_FONT_SIZE,
} from "@/lib/vector-editor/text";
import type {
  AnchorType,
  VectorDocument,
  VectorObject,
} from "@/lib/vector-editor/types";

const DEFAULT_FILL = { color: "#64748b", opacity: 1 };
const DEFAULT_STROKE = { color: "#0f172a", width: 2, opacity: 1 };

// The convert control — Sean's "chevron": switch selected anchors between
// the four point types.
const ANCHOR_TYPES: Array<{ id: AnchorType; label: string; hint: string }> = [
  { id: "corner", label: "Corner", hint: "No handles; segments meet straight" },
  { id: "smooth", label: "Smooth", hint: "Handles locked in one line" },
  { id: "broken", label: "Broken", hint: "Two independent handles" },
  { id: "auto", label: "Auto", hint: "Handles follow the neighbors" },
];

function toPercent(value: number): number {
  return Math.round(value * 100);
}

function NumberField({
  label,
  value,
  onCommit,
  min,
  step = 1,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="ve-field">
      <span className="ve-field-label">{label}</span>
      <input
        type="number"
        className="ve-input"
        value={Math.round(value * 100) / 100}
        min={min}
        step={step}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = Number.parseFloat(event.target.value);
          if (!Number.isNaN(next)) onCommit(next);
        }}
      />
    </label>
  );
}

export function VectorProperties({
  objects,
  doc,
  anchorSelection,
  onUpdate,
  onConvertToPath,
  onConvertAnchors,
  onArtboardResize,
  onOpenDocSetup,
}: {
  objects: VectorObject[];
  doc: VectorDocument;
  anchorSelection: AnchorSelection | null;
  onUpdate: (object: VectorObject) => void;
  onConvertToPath: (id: string) => void;
  onConvertAnchors: (type: AnchorType) => void;
  onArtboardResize: (width: number, height: number) => void;
  onOpenDocSetup: () => void;
}) {
  if (objects.length === 0) {
    return (
      <div className="vector-editor-dock-body">
        <p className="vector-editor-dock-empty">
          Select an object to edit its fill, stroke, and position. Draw with a
          shape tool, or lay a path down point by point with the pen (P) and
          edit its anchors with the white arrow (A).
        </p>
        <div className="vector-editor-dock-section">
          <span className="vector-editor-dock-label">Artboard</span>
          <div className="ve-prop-grid">
            <NumberField
              label="W (px)"
              value={doc.width}
              min={1}
              onCommit={(width) => onArtboardResize(width, doc.height)}
            />
            <NumberField
              label="H (px)"
              value={doc.height}
              min={1}
              onCommit={(height) => onArtboardResize(doc.width, height)}
            />
          </div>
          <button
            type="button"
            className="button button-secondary button-small ve-convert-button"
            onClick={onOpenDocSetup}
          >
            Document setup…
          </button>
          <dl className="vector-editor-doc-meta">
            <div>
              <dt>Units</dt>
              <dd>
                {doc.unit === "px" ? "px" : `${doc.unit} @ ${doc.ppi} PPI`}
              </dd>
            </div>
            <div>
              <dt>Objects</dt>
              <dd>{doc.objects.length}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  if (objects.length > 1) {
    return (
      <div className="vector-editor-dock-body">
        <p className="vector-editor-dock-empty">
          {objects.length} objects selected. Drag to move them together, use
          Delete to remove them, or Object → Convert to path.
        </p>
      </div>
    );
  }

  const object = objects[0];
  const bounds = objectBounds(object);
  // Filtered against the live anchor count — the stored selection can hold
  // stale indices after an undo shrinks the path.
  const anchorIndices =
    object.kind === "path" && anchorSelection?.objectId === object.id
      ? anchorSelection.indices.filter(
          (index) => index < object.anchors.length,
        )
      : [];
  const selectedAnchorTypes = new Set(
    object.kind === "path"
      ? anchorIndices
          .map((index) => object.anchors[index]?.type)
          .filter((type): type is AnchorType => type !== undefined)
      : [],
  );
  const commonAnchorType =
    selectedAnchorTypes.size === 1 ? [...selectedAnchorTypes][0] : null;

  function setBounds(next: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) {
    if (next.x !== undefined) {
      onUpdate(translateObject(object, next.x - bounds.x, 0));
      return;
    }
    if (next.y !== undefined) {
      onUpdate(translateObject(object, 0, next.y - bounds.y));
      return;
    }
    const width = Math.max(1, next.width ?? bounds.width);
    const height = Math.max(1, next.height ?? bounds.height);
    onUpdate(
      fitObjectToBounds(object, {
        x: bounds.x,
        y: bounds.y,
        width,
        height,
        cx: bounds.x + width / 2,
        cy: bounds.y + height / 2,
      }),
    );
  }

  return (
    <div className="vector-editor-dock-body">
      <div className="vector-editor-dock-section">
        <label className="ve-field ve-field-wide">
          <span className="ve-field-label">Name</span>
          <input
            type="text"
            className="ve-input"
            value={object.name}
            onChange={(event) => onUpdate({ ...object, name: event.target.value })}
          />
        </label>
      </div>

      {object.kind === "text" ? (
        <div className="vector-editor-dock-section">
          <span className="vector-editor-dock-label">Type</span>
          <label className="ve-field ve-field-wide">
            <span className="ve-field-label">Text</span>
            <textarea
              className="ve-input ve-text-input"
              rows={3}
              maxLength={MAX_TEXT_LENGTH}
              value={object.text}
              onChange={(event) =>
                onUpdate({ ...object, text: event.target.value })
              }
            />
          </label>
          <label className="ve-field ve-field-wide">
            <span className="ve-field-label">Font</span>
            <select
              className="ve-input"
              value={object.fontFamily}
              onChange={(event) =>
                onUpdate({ ...object, fontFamily: event.target.value })
              }
            >
              {FONT_FAMILIES.map((family) => (
                <option key={family.name} value={family.name}>
                  {family.name}
                </option>
              ))}
            </select>
          </label>
          <div className="ve-prop-row">
            <NumberField
              label="Size"
              value={object.fontSize}
              min={MIN_FONT_SIZE}
              onCommit={(value) =>
                onUpdate({
                  ...object,
                  fontSize: Math.min(
                    MAX_FONT_SIZE,
                    Math.max(MIN_FONT_SIZE, value),
                  ),
                })
              }
            />
            <div className="ve-text-style-toggles">
              <label className="ve-toggle">
                <input
                  type="checkbox"
                  checked={object.bold}
                  onChange={(event) =>
                    onUpdate({ ...object, bold: event.target.checked })
                  }
                />
                <span>Bold</span>
              </label>
              <label className="ve-toggle">
                <input
                  type="checkbox"
                  checked={object.italic}
                  onChange={(event) =>
                    onUpdate({ ...object, italic: event.target.checked })
                  }
                />
                <span>Italic</span>
              </label>
            </div>
          </div>
          <p className="vector-editor-dock-hint">
            Double-click the text on the canvas to edit it in place. Enter
            finishes, Esc cancels, Shift+Enter adds a line.
          </p>
        </div>
      ) : object.kind === "path" ? (
        <div className="vector-editor-dock-section">
          <span className="vector-editor-dock-label">
            {anchorIndices.length > 0
              ? `Anchor point${anchorIndices.length === 1 ? "" : "s"} (${anchorIndices.length})`
              : "Anchor points"}
          </span>
          {anchorIndices.length > 0 ? (
            <div
              className="ve-anchor-types"
              role="group"
              aria-label="Anchor point type"
            >
              {ANCHOR_TYPES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={
                    commonAnchorType === entry.id
                      ? "ve-anchor-type is-active"
                      : "ve-anchor-type"
                  }
                  aria-pressed={commonAnchorType === entry.id}
                  title={entry.hint}
                  onClick={() => onConvertAnchors(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="vector-editor-dock-hint">
              With the white arrow (A), click an anchor to select it — or
              double-click a segment to add one. Alt-drag a handle to break
              the pair.
            </p>
          )}
        </div>
      ) : (
        <div className="vector-editor-dock-section">
          <span className="vector-editor-dock-label">Path</span>
          <button
            type="button"
            className="button button-secondary button-small ve-convert-button"
            onClick={() => onConvertToPath(object.id)}
          >
            Convert to path
          </button>
          <p className="vector-editor-dock-hint">
            Turns the shape into editable anchor points.
          </p>
        </div>
      )}

      <div className="vector-editor-dock-section">
        <div className="ve-prop-head">
          <span className="vector-editor-dock-label">Fill</span>
          <label className="ve-toggle">
            <input
              type="checkbox"
              aria-label={object.fill ? "Turn off fill" : "Turn on fill"}
              checked={object.fill !== null}
              onChange={(event) =>
                onUpdate({
                  ...object,
                  fill: event.target.checked ? { ...DEFAULT_FILL } : null,
                })
              }
            />
            <span>{object.fill ? "On" : "Off"}</span>
          </label>
        </div>
        {object.fill ? (
          <div className="ve-prop-row">
            <input
              type="color"
              className="ve-swatch"
              aria-label="Fill color"
              value={object.fill.color}
              onChange={(event) =>
                onUpdate({
                  ...object,
                  fill: { ...object.fill!, color: event.target.value },
                })
              }
            />
            <NumberField
              label="Opacity %"
              value={toPercent(object.fill.opacity)}
              min={0}
              onCommit={(value) =>
                onUpdate({
                  ...object,
                  fill: {
                    ...object.fill!,
                    opacity: Math.min(1, Math.max(0, value / 100)),
                  },
                })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="vector-editor-dock-section">
        <div className="ve-prop-head">
          <span className="vector-editor-dock-label">Stroke</span>
          <label className="ve-toggle">
            <input
              type="checkbox"
              aria-label={object.stroke ? "Turn off stroke" : "Turn on stroke"}
              checked={object.stroke !== null}
              onChange={(event) =>
                onUpdate({
                  ...object,
                  stroke: event.target.checked ? { ...DEFAULT_STROKE } : null,
                })
              }
            />
            <span>{object.stroke ? "On" : "Off"}</span>
          </label>
        </div>
        {object.stroke ? (
          <>
            <div className="ve-prop-row">
              <input
                type="color"
                className="ve-swatch"
                aria-label="Stroke color"
                value={object.stroke.color}
                onChange={(event) =>
                  onUpdate({
                    ...object,
                    stroke: { ...object.stroke!, color: event.target.value },
                  })
                }
              />
              <NumberField
                label="Width"
                value={object.stroke.width}
                min={0}
                step={0.5}
                onCommit={(value) =>
                  onUpdate({
                    ...object,
                    stroke: { ...object.stroke!, width: Math.max(0, value) },
                  })
                }
              />
            </div>
            <NumberField
              label="Stroke opacity %"
              value={toPercent(object.stroke.opacity)}
              min={0}
              onCommit={(value) =>
                onUpdate({
                  ...object,
                  stroke: {
                    ...object.stroke!,
                    opacity: Math.min(1, Math.max(0, value / 100)),
                  },
                })
              }
            />
          </>
        ) : null}
      </div>

      <div className="vector-editor-dock-section">
        <span className="vector-editor-dock-label">Transform</span>
        <div className="ve-prop-grid">
          <NumberField label="X" value={bounds.x} onCommit={(x) => setBounds({ x })} />
          <NumberField label="Y" value={bounds.y} onCommit={(y) => setBounds({ y })} />
          <NumberField
            label="W"
            value={bounds.width}
            min={1}
            onCommit={(width) => setBounds({ width })}
          />
          <NumberField
            label="H"
            value={bounds.height}
            min={1}
            onCommit={(height) => setBounds({ height })}
          />
          <NumberField
            label="Rotation °"
            value={object.rotation}
            onCommit={(rotation) =>
              onUpdate({ ...object, rotation: ((rotation % 360) + 360) % 360 })
            }
          />
          <NumberField
            label="Opacity %"
            value={toPercent(object.opacity)}
            min={0}
            onCommit={(value) =>
              onUpdate({
                ...object,
                opacity: Math.min(1, Math.max(0, value / 100)),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
