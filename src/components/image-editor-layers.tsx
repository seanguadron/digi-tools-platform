"use client";

import { useEffect, useRef, useState } from "react";
import { BLEND_MODES } from "@/lib/image-editor/types";
import type { BlendMode, ImageDoc, Layer } from "@/lib/image-editor/types";

const THUMB_W = 46;
const THUMB_H = 36;

function LayerThumb({ layer }: { layer: Layer }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, THUMB_W, THUMB_H);
    const scale = Math.min(THUMB_W / layer.bitmap.width, THUMB_H / layer.bitmap.height);
    const w = layer.bitmap.width * scale;
    const h = layer.bitmap.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.bitmap, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);
  }, [layer.bitmap]);
  return (
    <canvas
      ref={ref}
      width={THUMB_W}
      height={THUMB_H}
      className="image-editor-layer-thumb"
      aria-hidden="true"
    />
  );
}

interface LayersPanelProps {
  doc: ImageDoc;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onMergeDown: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onOpacity: (id: string, opacity: number) => void;
  onBlendMode: (id: string, mode: BlendMode) => void;
  onToggleLock: (id: string) => void;
  onToggleClip: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorderDelta: (id: string, delta: number) => void;
  onReorderTo: (id: string, toIndex: number) => void;
}

export function ImageEditorLayers({
  doc,
  onSelectLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onMergeDown,
  onToggleVisible,
  onOpacity,
  onBlendMode,
  onToggleLock,
  onToggleClip,
  onRename,
  onReorderDelta,
  onReorderTo,
}: LayersPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const active = doc.layers.find((layer) => layer.id === doc.activeLayerId);
  // Display top-of-stack first (array index 0 is the bottom layer).
  const ordered = [...doc.layers].reverse();

  return (
    <aside className="image-editor-layers" aria-label="Layers">
      <div className="image-editor-layers-head">
        <span className="image-editor-panel-label">Layers</span>
        <div className="image-editor-layers-actions">
          <button type="button" className="image-editor-icon-btn" title="New layer" aria-label="New layer" onClick={onAddLayer}>
            +
          </button>
          <button
            type="button"
            className="image-editor-icon-btn"
            title="Duplicate layer"
            aria-label="Duplicate layer"
            onClick={() => active && onDuplicateLayer(active.id)}
            disabled={!active}
          >
            ⧉
          </button>
          <button
            type="button"
            className="image-editor-icon-btn"
            title="Merge down"
            aria-label="Merge layer down"
            onClick={() => active && onMergeDown(active.id)}
            disabled={!active || doc.layers.length < 2}
          >
            ⤓
          </button>
          <button
            type="button"
            className="image-editor-icon-btn is-danger"
            title="Delete layer"
            aria-label="Delete layer"
            onClick={() => active && onDeleteLayer(active.id)}
            disabled={!active || doc.layers.length < 2}
          >
            ✕
          </button>
        </div>
      </div>

      {active ? (
        <div className="image-editor-layer-controls">
          <label className="image-editor-select">
            <span className="image-editor-field-caption">Blend mode</span>
            <select
              value={active.blendMode}
              onChange={(event) =>
                onBlendMode(active.id, event.target.value as BlendMode)
              }
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="image-editor-slider is-inline">
            <span>
              Opacity <strong>{Math.round(active.opacity * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(active.opacity * 100)}
              onChange={(event) =>
                onOpacity(active.id, Number(event.target.value) / 100)
              }
            />
          </label>
          <div className="image-editor-toggle-row">
            <label className="image-editor-check">
              <input
                type="checkbox"
                checked={active.locked}
                onChange={() => onToggleLock(active.id)}
              />
              Lock
            </label>
            <label className="image-editor-check">
              <input
                type="checkbox"
                checked={active.clipped}
                onChange={() => onToggleClip(active.id)}
              />
              Clip
            </label>
          </div>
        </div>
      ) : null}

      <ul className="image-editor-layer-list">
        {ordered.map((layer) => {
          const arrayIndex = doc.layers.indexOf(layer);
          const isActive = layer.id === doc.activeLayerId;
          return (
            <li
              key={layer.id}
              className={
                isActive
                  ? "image-editor-layer-row is-active"
                  : dragId === layer.id
                    ? "image-editor-layer-row is-dragging"
                    : "image-editor-layer-row"
              }
              draggable={editingId !== layer.id}
              onDragStart={(event) => {
                setDragId(layer.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (dragId && dragId !== layer.id) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId && dragId !== layer.id) {
                  onReorderTo(dragId, arrayIndex);
                }
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
            >
              <button
                type="button"
                className="image-editor-layer-eye"
                title={layer.visible ? "Hide layer" : "Show layer"}
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
                aria-pressed={layer.visible}
                onClick={() => onToggleVisible(layer.id)}
              >
                {layer.visible ? "◉" : "○"}
              </button>
              <button
                type="button"
                className="image-editor-layer-main"
                onClick={() => onSelectLayer(layer.id)}
                onDoubleClick={() => setEditingId(layer.id)}
              >
                <LayerThumb layer={layer} />
                {editingId === layer.id ? (
                  <input
                    className="image-editor-layer-name-input"
                    defaultValue={layer.name}
                    autoFocus
                    onClick={(event) => event.stopPropagation()}
                    onBlur={(event) => {
                      onRename(layer.id, event.target.value.trim() || layer.name);
                      setEditingId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="image-editor-layer-name">{layer.name}</span>
                )}
                {layer.locked || layer.clipped ? (
                  <span className="image-editor-layer-badges">
                    {layer.locked ? (
                      <span
                        className="image-editor-layer-badge"
                        title="Transparency locked"
                        aria-label="Transparency locked"
                      >
                        L
                      </span>
                    ) : null}
                    {layer.clipped ? (
                      <span
                        className="image-editor-layer-badge"
                        title="Clipping mask"
                        aria-label="Clipping mask"
                      >
                        C
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
              <span className="image-editor-layer-reorder">
                <button
                  type="button"
                  className="image-editor-icon-btn"
                  title="Move up"
                  aria-label="Move layer up"
                  disabled={arrayIndex === doc.layers.length - 1}
                  onClick={() => onReorderDelta(layer.id, 1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="image-editor-icon-btn"
                  title="Move down"
                  aria-label="Move layer down"
                  disabled={arrayIndex === 0}
                  onClick={() => onReorderDelta(layer.id, -1)}
                >
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
