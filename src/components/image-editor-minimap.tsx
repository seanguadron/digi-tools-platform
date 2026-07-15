"use client";

import { useCallback, useEffect, useRef } from "react";
import type { useCanvasViewport } from "@/hooks/use-canvas-viewport";
import { composite, createBitmap, get2d } from "@/lib/image-editor/raster";
import type { ImageDoc } from "@/lib/image-editor/types";

type ViewportApi = ReturnType<typeof useCanvasViewport>;

const MAX_W = 168;
const MAX_H = 128;

// A lower-right document preview matching the Architect wizard's minimap idiom
// (React Flow's MiniMap can't render a raster canvas, so this is a small custom
// equivalent over the same useCanvasViewport transform). Shows a thumbnail of the
// flattened document plus the current viewport rectangle; drag to recenter.
export function ImageEditorMinimap({
  doc,
  viewport,
}: {
  doc: ImageDoc;
  viewport: ViewportApi;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);

  const scale = Math.min(MAX_W / doc.width, MAX_H / doc.height, 1);
  const thumbW = Math.max(1, Math.round(doc.width * scale));
  const thumbH = Math.max(1, Math.round(doc.height * scale));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const styles = getComputedStyle(canvas);
    ctx.clearRect(0, 0, thumbW, thumbH);
    ctx.fillStyle = styles.getPropertyValue("--muted").trim() || "#222";
    ctx.fillRect(0, 0, thumbW, thumbH);
    if (thumbRef.current) {
      ctx.drawImage(thumbRef.current, 0, 0);
    }
    // Viewport rectangle: the document region currently visible in the stage.
    const { view, size } = viewport;
    if (size.width > 1 && size.height > 1 && view.scale > 0) {
      const vx = (-view.offsetX / view.scale) * scale;
      const vy = (-view.offsetY / view.scale) * scale;
      const vw = (size.width / view.scale) * scale;
      const vh = (size.height / view.scale) * scale;
      ctx.strokeStyle = styles.getPropertyValue("--brand-cyan").trim() || "#0cf";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.max(0.5, vx + 0.5),
        Math.max(0.5, vy + 0.5),
        Math.min(thumbW - 1, vw),
        Math.min(thumbH - 1, vh),
      );
    }
  }, [viewport, scale, thumbW, thumbH]);

  // Rebuild the cached composite thumbnail when the document pixels change.
  useEffect(() => {
    const flat = composite(doc);
    const thumb = createBitmap(thumbW, thumbH);
    const tctx = get2d(thumb);
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(flat, 0, 0, thumbW, thumbH);
    thumbRef.current = thumb;
    draw();
  }, [doc, thumbW, thumbH, draw]);

  // Redraw the overlay whenever the viewport transform or stage size changes.
  useEffect(() => {
    draw();
  }, [draw, viewport.view, viewport.size]);

  const recenter = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const docX = ((clientX - rect.left) / rect.width) * doc.width;
      const docY = ((clientY - rect.top) / rect.height) * doc.height;
      const { view, size } = viewport;
      viewport.setView({
        scale: view.scale,
        offsetX: size.width / 2 - docX * view.scale,
        offsetY: size.height / 2 - docY * view.scale,
      });
    },
    [doc.width, doc.height, viewport],
  );

  return (
    <div className="image-editor-minimap" aria-hidden="true">
      <canvas
        ref={canvasRef}
        width={thumbW}
        height={thumbH}
        className="image-editor-minimap-canvas"
        style={{ aspectRatio: `${thumbW} / ${thumbH}` }}
        onPointerDown={(event) => {
          event.stopPropagation();
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          recenter(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) {
            return;
          }
          event.stopPropagation();
          recenter(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      />
    </div>
  );
}
