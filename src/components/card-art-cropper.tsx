"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const VIEWPORT = 420;
const OUTPUT = 1024;
const MAX_ZOOM = 6;
const NUDGE = 12;

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
  const [showGuides, setShowGuides] = useState(true);
  const dragRef = useRef<{ x: number; y: number; frame: Frame } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // A modal dialog owes the keyboard three things: Escape closes it, Tab stays
  // inside it, and focus goes back where it came from on the way out.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onCancel]);

  const pan = useCallback(
    (dx: number, dy: number) => {
      if (!image) {
        return;
      }
      setFrame((current) =>
        clampFrame(
          {
            zoom: current.zoom,
            offsetX: current.offsetX + dx,
            offsetY: current.offsetY + dy,
          },
          image.naturalWidth,
          image.naturalHeight,
        ),
      );
    },
    [image],
  );

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
    <div className="card-art-crop-layer">
      <div
        className="card-art-cropper"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
      <div className="card-art-cropper-head">
        <strong id={titleId}>Crop {fileName}</strong>
        <small>
          Scroll to zoom, drag to position, arrow keys to nudge. The original
          is kept.
        </small>
      </div>

      <div
        className="card-art-crop-window"
        ref={viewportRef}
        role="application"
        aria-label={`Crop window for ${fileName}. Arrow keys move the image.`}
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [NUDGE, 0],
            ArrowRight: [-NUDGE, 0],
            ArrowUp: [0, NUDGE],
            ArrowDown: [0, -NUDGE],
          };
          const move = moves[event.key];
          if (move) {
            event.preventDefault();
            pan(move[0], move[1]);
          }
        }}
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
        {showGuides ? (
          <span className="card-art-crop-guides" aria-hidden="true" />
        ) : null}
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
          <label className="card-art-guide-toggle">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(event) => setShowGuides(event.target.checked)}
            />
            <span>Thirds</span>
          </label>
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
    </div>
  );
}
