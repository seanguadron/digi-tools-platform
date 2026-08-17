"use client";

import { useEffect, useRef, useState } from "react";

const VIEWPORT = 420;
const OUTPUT = 1024;
const MAX_ZOOM = 6;

type Frame = { zoom: number; offsetX: number; offsetY: number };

// Zoom-and-pan cropping: the image sits behind a fixed square window, so the
// result is square by construction and there are no handles to nudge off-axis.
// zoom 1 means "cover the window exactly"; the offsets are clamped so the
// window can never show past an edge.
function clampFrame(frame: Frame, width: number, height: number): Frame {
  const base = Math.max(VIEWPORT / width, VIEWPORT / height);
  const scale = base * frame.zoom;
  const shownWidth = width * scale;
  const shownHeight = height * scale;

  return {
    zoom: frame.zoom,
    offsetX: Math.min(0, Math.max(VIEWPORT - shownWidth, frame.offsetX)),
    offsetY: Math.min(0, Math.max(VIEWPORT - shownHeight, frame.offsetY)),
  };
}

export function CardArtCropper({
  src,
  fileName,
  busy,
  onCancel,
  onSave,
}: {
  src: string;
  fileName: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<Frame>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const dragRef = useRef<{ x: number; y: number; frame: Frame } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => {
      if (cancelled) {
        return;
      }
      setImage(next);
      const base = Math.max(VIEWPORT / next.naturalWidth, VIEWPORT / next.naturalHeight);
      setFrame({
        zoom: 1,
        offsetX: (VIEWPORT - next.naturalWidth * base) / 2,
        offsetY: (VIEWPORT - next.naturalHeight * base) / 2,
      });
    };
    next.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  function nudgeZoom(delta: number, anchorX = VIEWPORT / 2, anchorY = VIEWPORT / 2) {
    if (!image) {
      return;
    }
    setFrame((current) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, current.zoom * delta));
      const ratio = zoom / current.zoom;
      // Keep whatever sits under the anchor point pinned while zooming.
      return clampFrame(
        {
          zoom,
          offsetX: anchorX - (anchorX - current.offsetX) * ratio,
          offsetY: anchorY - (anchorY - current.offsetY) * ratio,
        },
        image.naturalWidth,
        image.naturalHeight,
      );
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!image) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    nudgeZoom(
      event.deltaY < 0 ? 1.12 : 1 / 1.12,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!image) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, frame };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !image) {
      return;
    }
    setFrame(
      clampFrame(
        {
          zoom: drag.frame.zoom,
          offsetX: drag.frame.offsetX + (event.clientX - drag.x),
          offsetY: drag.frame.offsetY + (event.clientY - drag.y),
        },
        image.naturalWidth,
        image.naturalHeight,
      ),
    );
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  }

  function handleSave() {
    if (!image) {
      return;
    }
    const base = Math.max(VIEWPORT / image.naturalWidth, VIEWPORT / image.naturalHeight);
    const scale = base * frame.zoom;
    // The window in source-image coordinates.
    const sourceX = -frame.offsetX / scale;
    const sourceY = -frame.offsetY / scale;
    const sourceSize = VIEWPORT / scale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT,
      OUTPUT,
    );
    onSave(canvas.toDataURL("image/png"));
  }

  const displayWidth = image
    ? image.naturalWidth *
      Math.max(VIEWPORT / image.naturalWidth, VIEWPORT / image.naturalHeight) *
      frame.zoom
    : 0;

  return (
    <div className="card-art-cropper">
      <div className="card-art-cropper-head">
        <strong>Crop {fileName}</strong>
        <small>Scroll to zoom, drag to position. The original is kept.</small>
      </div>

      <div
        className="card-art-crop-window"
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ width: VIEWPORT, height: VIEWPORT }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={src}
            draggable={false}
            style={{
              width: displayWidth,
              transform: `translate3d(${frame.offsetX}px, ${frame.offsetY}px, 0)`,
            }}
          />
        ) : (
          <span className="card-art-crop-loading">Loading…</span>
        )}
      </div>

      <div className="card-art-crop-actions">
        <div className="card-art-zoom">
          <button type="button" onClick={() => nudgeZoom(1 / 1.2)} aria-label="Zoom out">
            −
          </button>
          <span>{Math.round(frame.zoom * 100)}%</span>
          <button type="button" onClick={() => nudgeZoom(1.2)} aria-label="Zoom in">
            +
          </button>
        </div>
        <div className="card-art-crop-buttons">
          <button className="button button-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleSave}
            disabled={!image || busy}
          >
            Save crop
          </button>
        </div>
      </div>
    </div>
  );
}
