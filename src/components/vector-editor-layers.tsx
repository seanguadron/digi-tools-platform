"use client";

import type { VectorObject, VectorShapeKind } from "@/lib/vector-editor/types";

const KIND_GLYPH: Record<VectorShapeKind, string> = {
  rect: "▭",
  ellipse: "◯",
  line: "╱",
  polygon: "⬠",
};

export function VectorLayers({
  objects,
  selectedId,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onMove,
  onDelete,
}: {
  objects: VectorObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onMove: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}) {
  // Top of the stack (last in z-order) reads first, like every layers panel.
  const rows = [...objects].reverse();

  return (
    <div className="vector-editor-dock-body vector-editor-layers">
      {rows.length === 0 ? (
        <p className="vector-editor-dock-empty">
          No objects yet — draw a shape to get started.
        </p>
      ) : (
        <ul className="ve-layer-list">
          {rows.map((object) => (
            <li
              key={object.id}
              className={
                object.id === selectedId
                  ? "ve-layer-row is-selected"
                  : "ve-layer-row"
              }
            >
              <button
                type="button"
                className="ve-layer-icon"
                aria-label={object.hidden ? "Show object" : "Hide object"}
                aria-pressed={object.hidden}
                title={object.hidden ? "Show" : "Hide"}
                onClick={() => onToggleHidden(object.id)}
              >
                <span aria-hidden="true">{object.hidden ? "◌" : "◉"}</span>
              </button>
              <button
                type="button"
                className="ve-layer-name"
                onClick={() => onSelect(object.id)}
              >
                <span className="ve-layer-glyph" aria-hidden="true">
                  {KIND_GLYPH[object.kind]}
                </span>
                <span className="ve-layer-label">{object.name}</span>
              </button>
              <button
                type="button"
                className="ve-layer-icon"
                aria-label={object.locked ? "Unlock object" : "Lock object"}
                aria-pressed={object.locked}
                title={object.locked ? "Unlock" : "Lock"}
                onClick={() => onToggleLocked(object.id)}
              >
                <span aria-hidden="true">{object.locked ? "■" : "□"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ve-layer-actions">
        <button
          type="button"
          className="button button-secondary button-small"
          disabled={!selectedId}
          onClick={() => selectedId && onMove(selectedId, 1)}
        >
          Raise
        </button>
        <button
          type="button"
          className="button button-secondary button-small"
          disabled={!selectedId}
          onClick={() => selectedId && onMove(selectedId, -1)}
        >
          Lower
        </button>
        <button
          type="button"
          className="button button-secondary button-small"
          disabled={!selectedId}
          onClick={() => selectedId && onDelete(selectedId)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
