"use client";

import type { ChangeEvent } from "react";
import { objectBounds } from "@/lib/vector-editor/geometry";
import {
  fitObjectToBounds,
  translateObject,
} from "@/lib/vector-editor/transform";
import type {
  VectorDocument,
  VectorObject,
} from "@/lib/vector-editor/types";

const DEFAULT_FILL = { color: "#64748b", opacity: 1 };
const DEFAULT_STROKE = { color: "#0f172a", width: 2, opacity: 1 };

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
  object,
  doc,
  onUpdate,
}: {
  object: VectorObject | null;
  doc: VectorDocument;
  onUpdate: (object: VectorObject) => void;
}) {
  if (!object) {
    return (
      <div className="vector-editor-dock-body">
        <p className="vector-editor-dock-empty">
          Select an object to edit its fill, stroke, and position. Pick a shape
          tool and drag on the artboard — or press Enter to drop one at the
          center — to add one.
        </p>
        <div className="vector-editor-dock-section">
          <span className="vector-editor-dock-label">Document</span>
          <dl className="vector-editor-doc-meta">
            <div>
              <dt>Artboard</dt>
              <dd>
                {doc.width} × {doc.height}
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

  const bounds = objectBounds(object);

  function setBounds(next: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) {
    if (!object) return;
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
