"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { useCanvasViewport } from "@/hooks/use-canvas-viewport";
import {
  commitLayerBitmap,
  cropDoc,
  setSelection,
} from "@/lib/image-editor/document";
import {
  activeLayer,
  cloneBitmap,
  composite,
  createBitmap,
  docToScreen,
  fillGradient,
  floodFill,
  get2d,
  normalizeRect,
  paintLine,
  paintShape,
  paintStamp,
  rasterizeText,
  samplePixel,
} from "@/lib/image-editor/raster";
import type { ShapeKind } from "@/lib/image-editor/raster";
import {
  applySelectionClip,
  clearInSelection,
  ellipseSelection,
  extractSelection,
  magicWandSelection,
  polySelection,
  rectSelection,
  translateSelection,
} from "@/lib/image-editor/selection";
import type {
  BrushSettings,
  GradientSettings,
  ShapeSettings,
  TextSettings,
  ToolId,
} from "@/lib/image-editor/tools";
import { getTool } from "@/lib/image-editor/tools";
import type { ImageDoc, Point } from "@/lib/image-editor/types";

type ViewportApi = ReturnType<typeof useCanvasViewport>;

type SelectDrag =
  | { kind: "rect"; start: Point; current: Point }
  | { kind: "lasso"; points: Point[] };

interface MoveDrag {
  base: HTMLCanvasElement;
  float: HTMLCanvasElement;
  start: Point;
  offset: Point;
}

interface TransformState {
  bitmap: HTMLCanvasElement; // snapshot of the layer at transform start
  tx: number;
  ty: number;
  scale: number;
  rotation: number; // radians
  drag:
    | {
        mode: "move" | "scale" | "rotate";
        start: Point;
        base: { tx: number; ty: number; scale: number; rotation: number };
      }
    | null;
}

// Render a layer bitmap under a transform, clipped to the canvas.
function composeTransform(
  t: TransformState,
  width: number,
  height: number,
): HTMLCanvasElement {
  const out = createBitmap(width, height);
  const ctx = get2d(out);
  const cx = width / 2;
  const cy = height / 2;
  ctx.translate(cx + t.tx, cy + t.ty);
  ctx.rotate(t.rotation);
  ctx.scale(t.scale, t.scale);
  ctx.drawImage(t.bitmap, -cx, -cy);
  return out;
}

// The four transformed corners of the layer box, in document space.
function transformCorners(t: TransformState, width: number, height: number): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => {
    const vx = x - cx;
    const vy = y - cy;
    return {
      x: cx + t.tx + (vx * cos - vy * sin) * t.scale,
      y: cy + t.ty + (vx * sin + vy * cos) * t.scale,
    };
  });
}

const SHAPE_KIND: Partial<Record<ToolId, ShapeKind>> = {
  "shape-rect": "rect",
  "shape-ellipse": "ellipse",
  "shape-line": "line",
};

interface ImageEditorCanvasProps {
  doc: ImageDoc;
  viewport: ViewportApi;
  tool: ToolId;
  brush: BrushSettings;
  shape: ShapeSettings;
  text: TextSettings;
  gradient: GradientSettings;
  color: string;
  bgColor: string;
  tolerance: number;
  onCommitDoc: (mutate: (doc: ImageDoc) => ImageDoc, tag?: string) => void;
  onPickColor: (hex: string) => void;
  onDropFiles: (files: FileList) => void;
}

const CHECKER_CELL = 8;

// Shift-constrain helpers.
function constrainSquare(start: Point, point: Point): Point {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + (dx < 0 ? -size : size),
    y: start.y + (dy < 0 ? -size : size),
  };
}
function constrain45(start: Point, point: Point): Point {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const len = Math.hypot(dx, dy);
  return { x: start.x + Math.cos(angle) * len, y: start.y + Math.sin(angle) * len };
}
function constrainAxis(start: Point, point: Point): Point {
  return Math.abs(point.x - start.x) >= Math.abs(point.y - start.y)
    ? { x: point.x, y: start.y }
    : { x: start.x, y: point.y };
}
function constrainForShape(
  start: Point,
  point: Point,
  toolId: ToolId,
  shift: boolean,
): Point {
  if (!shift) {
    return point;
  }
  if (toolId === "shape-line") {
    return constrain45(start, point);
  }
  if (toolId === "shape-rect" || toolId === "shape-ellipse") {
    return constrainSquare(start, point);
  }
  return point;
}

function composeMove(
  base: HTMLCanvasElement,
  float: HTMLCanvasElement,
  dx: number,
  dy: number,
): HTMLCanvasElement {
  const out = createBitmap(base.width, base.height);
  const ctx = get2d(out);
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(float, Math.round(dx), Math.round(dy));
  return out;
}

export function ImageEditorCanvas({
  doc,
  viewport,
  tool,
  brush,
  shape,
  text,
  gradient,
  color,
  bgColor,
  tolerance,
  onCommitDoc,
  onPickColor,
  onDropFiles,
}: ImageEditorCanvasProps) {
  const { stageRef, view, zoomAt, panBy, screenToDoc } = viewport;
  const [textEdit, setTextEdit] = useState<{ point: Point; value: string } | null>(
    null,
  );

  const viewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  // The bitmap substituted for the active layer during a live brush stroke or
  // move-drag (null when idle).
  const overrideRef = useRef<HTMLCanvasElement | null>(null);

  // Refs the async draw loop / effects read (they run outside render). Pointer
  // handlers read the live props by closure — stable within a drag (no
  // re-render fires mid-gesture), so they never lag a tool/color switch.
  const docRef = useRef(doc);
  const viewRef = useRef(view);
  const toolRef = useRef(tool);
  useEffect(() => {
    docRef.current = doc;
    viewRef.current = view;
    toolRef.current = tool;
  }, [doc, view, tool]);

  const strokingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const panningRef = useRef<{ x: number; y: number } | null>(null);
  const selectRef = useRef<SelectDrag | null>(null);
  const moveRef = useRef<MoveDrag | null>(null);
  const shapeRef = useRef<{ start: Point; current: Point } | null>(null);
  const gradientRef = useRef<{ start: Point; current: Point } | null>(null);
  const cropRef = useRef<{ start: Point; current: Point } | null>(null);
  const strokeStartRef = useRef<Point | null>(null);
  const transformRef = useRef<TransformState | null>(null);
  const spaceRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const checkerRef = useRef<CanvasPattern | null>(null);
  const dashRef = useRef(0);

  const applyCursor = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    if (panningRef.current || spaceRef.current) {
      stage.style.cursor = panningRef.current ? "grabbing" : "grab";
      return;
    }
    stage.style.cursor = getTool(toolRef.current).cursor;
  }, [stageRef]);

  const capturePointer = useCallback(
    (pointerId: number) => {
      try {
        stageRef.current?.setPointerCapture(pointerId);
      } catch {
        // Some environments reject capture for a synthetic pointer.
      }
    },
    [stageRef],
  );

  const buildChecker = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const stage = stageRef.current;
      const styles = stage ? getComputedStyle(stage) : null;
      const a = styles?.getPropertyValue("--ie-checker-a").trim() || "#cfcfcf";
      const b = styles?.getPropertyValue("--ie-checker-b").trim() || "#ffffff";
      const tile = document.createElement("canvas");
      tile.width = CHECKER_CELL * 2;
      tile.height = CHECKER_CELL * 2;
      const tctx = tile.getContext("2d");
      if (!tctx) {
        return null;
      }
      tctx.fillStyle = b;
      tctx.fillRect(0, 0, tile.width, tile.height);
      tctx.fillStyle = a;
      tctx.fillRect(0, 0, CHECKER_CELL, CHECKER_CELL);
      tctx.fillRect(CHECKER_CELL, CHECKER_CELL, CHECKER_CELL, CHECKER_CELL);
      return ctx.createPattern(tile, "repeat");
    },
    [stageRef],
  );

  const recomposite = useCallback(() => {
    const current = docRef.current;
    const override = overrideRef.current
      ? { layerId: current.activeLayerId, bitmap: overrideRef.current }
      : undefined;
    compositeRef.current = composite(
      current,
      compositeRef.current ?? undefined,
      override,
    );
  }, []);

  const drawOverlay = useCallback((cssW: number, cssH: number, dpr: number) => {
    const overlay = overlayCanvasRef.current;
    const stage = stageRef.current;
    if (!overlay || !stage) {
      return;
    }
    const octx = overlay.getContext("2d");
    if (!octx) {
      return;
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, cssW, cssH);
    const v = viewRef.current;
    const activeDoc = docRef.current;
    const toScreen = (point: Point) => docToScreen(point, v);
    const cyan =
      getComputedStyle(stage).getPropertyValue("--brand-cyan").trim() ||
      "#12c0e6";

    octx.save();
    octx.strokeStyle = cyan;
    octx.lineWidth = 1.25;
    octx.setLineDash([5, 4]);
    octx.lineDashOffset = -dashRef.current;

    const drag = selectRef.current;
    if (drag?.kind === "rect") {
      const a = toScreen(drag.start);
      const b = toScreen(drag.current);
      if (toolRef.current === "select-ellipse") {
        octx.beginPath();
        octx.ellipse(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          Math.abs(a.x - b.x) / 2,
          Math.abs(a.y - b.y) / 2,
          0,
          0,
          Math.PI * 2,
        );
        octx.stroke();
      } else {
        octx.strokeRect(
          Math.min(a.x, b.x),
          Math.min(a.y, b.y),
          Math.abs(a.x - b.x),
          Math.abs(a.y - b.y),
        );
      }
    } else if (drag?.kind === "lasso" && drag.points.length > 0) {
      octx.beginPath();
      const first = toScreen(drag.points[0]);
      octx.moveTo(first.x, first.y);
      for (let i = 1; i < drag.points.length; i += 1) {
        const p = toScreen(drag.points[i]);
        octx.lineTo(p.x, p.y);
      }
      octx.stroke();
    } else if (activeDoc.selection) {
      const shape = activeDoc.selection.shape;
      if (shape.kind === "rect") {
        const a = toScreen({ x: shape.rect.x, y: shape.rect.y });
        octx.strokeRect(
          a.x,
          a.y,
          shape.rect.width * v.scale,
          shape.rect.height * v.scale,
        );
      } else {
        octx.beginPath();
        const first = toScreen(shape.points[0]);
        octx.moveTo(first.x, first.y);
        for (let i = 1; i < shape.points.length; i += 1) {
          const p = toScreen(shape.points[i]);
          octx.lineTo(p.x, p.y);
        }
        octx.closePath();
        octx.stroke();
      }
      if (activeDoc.selection.inverted) {
        const tl = toScreen({ x: 0, y: 0 });
        octx.strokeRect(
          tl.x,
          tl.y,
          activeDoc.width * v.scale,
          activeDoc.height * v.scale,
        );
      }
    }
    octx.restore();

    // Crop preview: darken outside the pending crop rectangle.
    const crop = cropRef.current;
    if (crop) {
      const a = toScreen(crop.start);
      const b = toScreen(crop.current);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(a.x - b.x);
      const h = Math.abs(a.y - b.y);
      octx.save();
      octx.fillStyle = "rgba(10, 14, 22, 0.5)";
      octx.fillRect(0, 0, cssW, cssH);
      octx.clearRect(x, y, w, h);
      octx.strokeStyle = cyan;
      octx.lineWidth = 1.25;
      octx.strokeRect(x, y, w, h);
      octx.restore();
    }

    // Live shape preview (screen space).
    const activeShape = shapeRef.current;
    const kind = SHAPE_KIND[toolRef.current];
    if (activeShape && kind) {
      paintShape(octx, kind, toScreen(activeShape.start), toScreen(activeShape.current), {
        color,
        fill: shape.fill,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth * v.scale,
      });
    }

    // Gradient direction preview.
    const gradientDrag = gradientRef.current;
    if (gradientDrag) {
      const a = toScreen(gradientDrag.start);
      const b = toScreen(gradientDrag.current);
      octx.save();
      octx.strokeStyle = cyan;
      octx.lineWidth = 1.5;
      octx.setLineDash([]);
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(b.x, b.y);
      octx.stroke();
      octx.fillStyle = cyan;
      for (const p of [a, b]) {
        octx.beginPath();
        octx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        octx.fill();
      }
      octx.restore();
    }

    // Transform box + handles.
    const transform = transformRef.current;
    if (transform && toolRef.current === "transform") {
      const corners = transformCorners(
        transform,
        activeDoc.width,
        activeDoc.height,
      ).map(toScreen);
      octx.save();
      octx.strokeStyle = cyan;
      octx.lineWidth = 1.25;
      octx.setLineDash([]);
      octx.beginPath();
      octx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i += 1) {
        octx.lineTo(corners[i].x, corners[i].y);
      }
      octx.closePath();
      octx.stroke();
      octx.fillStyle = cyan;
      for (const c of corners) {
        octx.beginPath();
        octx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        octx.fill();
      }
      const topMid = {
        x: (corners[0].x + corners[1].x) / 2,
        y: (corners[0].y + corners[1].y) / 2,
      };
      const centerScreen = toScreen({
        x: activeDoc.width / 2 + transform.tx,
        y: activeDoc.height / 2 + transform.ty,
      });
      const dx = topMid.x - centerScreen.x;
      const dy = topMid.y - centerScreen.y;
      const len = Math.hypot(dx, dy) || 1;
      const handle = {
        x: topMid.x + (dx / len) * 26,
        y: topMid.y + (dy / len) * 26,
      };
      octx.beginPath();
      octx.moveTo(topMid.x, topMid.y);
      octx.lineTo(handle.x, handle.y);
      octx.stroke();
      octx.beginPath();
      octx.arc(handle.x, handle.y, 5, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    }
  }, [stageRef, color, shape]);

  const draw = useCallback(() => {
    rafRef.current = null;
    const canvas = viewCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const cssW = stage.clientWidth;
    const cssH = stage.clientHeight;
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    for (const c of [canvas, overlay]) {
      if (c && (c.width !== pxW || c.height !== pxH)) {
        c.width = pxW;
        c.height = pxH;
      }
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const activeDoc = docRef.current;
    const v = viewRef.current;
    const left = v.offsetX;
    const top = v.offsetY;
    const w = activeDoc.width * v.scale;
    const h = activeDoc.height * v.scale;

    if (!checkerRef.current) {
      checkerRef.current = buildChecker(ctx);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    if (checkerRef.current) {
      ctx.fillStyle = checkerRef.current;
      ctx.fillRect(left, top, w, h);
    }
    ctx.restore();

    if (compositeRef.current) {
      ctx.imageSmoothingEnabled = v.scale < 1.5;
      ctx.drawImage(compositeRef.current, left, top, w, h);
    }

    const border = getComputedStyle(stage).getPropertyValue("--border").trim();
    ctx.strokeStyle = border || "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

    drawOverlay(cssW, cssH, dpr);
  }, [buildChecker, drawOverlay, stageRef]);

  const requestRender = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(draw);
  }, [draw]);

  const brushOptions = (erase: boolean) => ({
    size: brush.size,
    hardness: brush.hardness,
    flow: brush.flow,
    color,
    erase,
  });

  useEffect(() => {
    recomposite();
    requestRender();
  }, [doc, recomposite, requestRender]);

  useEffect(() => {
    requestRender();
  }, [view, viewport.size, requestRender]);

  useEffect(() => {
    applyCursor();
  }, [tool, applyCursor]);

  // Animate the marching ants while a selection exists (static under
  // prefers-reduced-motion — a still dashed outline still reads as a selection).
  useEffect(() => {
    if (!doc.selection) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      requestRender();
      return;
    }
    let raf = 0;
    const tick = () => {
      dashRef.current = (dashRef.current + 0.6) % 1000;
      requestRender();
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [doc.selection, requestRender]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      checkerRef.current = null;
      requestRender();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [requestRender]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(factor, event.clientX, event.clientY);
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [stageRef, zoomAt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }
      spaceRef.current = true;
      applyCursor();
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }
      spaceRef.current = false;
      applyCursor();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [applyCursor]);

  // Transform: Enter bakes the pending transform, Escape discards it.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (toolRef.current !== "transform") {
        return;
      }
      const t = transformRef.current;
      if (!t) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const current = docRef.current;
        const final = composeTransform(t, current.width, current.height);
        transformRef.current = null;
        overrideRef.current = null;
        onCommitDoc((d) => commitLayerBitmap(d, d.activeLayerId, final));
      } else if (event.key === "Escape") {
        event.preventDefault();
        transformRef.current = null;
        overrideRef.current = null;
        requestRender();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCommitDoc, requestRender]);

  // Discard a pending transform when switching away from the transform tool.
  useEffect(() => {
    if (tool !== "transform" && transformRef.current) {
      transformRef.current = null;
      overrideRef.current = null;
      requestRender();
    }
  }, [tool, requestRender]);

  function updateTransformDrag(t: TransformState, p: Point) {
    if (!t.drag) {
      return;
    }
    const center = {
      x: doc.width / 2 + t.drag.base.tx,
      y: doc.height / 2 + t.drag.base.ty,
    };
    if (t.drag.mode === "move") {
      t.tx = t.drag.base.tx + (p.x - t.drag.start.x);
      t.ty = t.drag.base.ty + (p.y - t.drag.start.y);
    } else if (t.drag.mode === "scale") {
      const d0 =
        Math.hypot(t.drag.start.x - center.x, t.drag.start.y - center.y) || 1;
      const d1 = Math.hypot(p.x - center.x, p.y - center.y);
      t.scale = Math.max(0.05, t.drag.base.scale * (d1 / d0));
    } else {
      const a0 = Math.atan2(t.drag.start.y - center.y, t.drag.start.x - center.x);
      const a1 = Math.atan2(p.y - center.y, p.x - center.x);
      t.rotation = t.drag.base.rotation + (a1 - a0);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const wantsPan = spaceRef.current || tool === "hand" || event.button === 1;
    if (wantsPan) {
      panningRef.current = { x: event.clientX, y: event.clientY };
      capturePointer(event.pointerId);
      applyCursor();
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const point = screenToDoc(event.clientX, event.clientY);

    if (tool === "transform") {
      const layer = activeLayer(doc);
      if (!layer) {
        return;
      }
      if (!transformRef.current) {
        transformRef.current = {
          bitmap: layer.bitmap,
          tx: 0,
          ty: 0,
          scale: 1,
          rotation: 0,
          drag: null,
        };
      }
      const t = transformRef.current;
      const rect = stage.getBoundingClientRect();
      const ps = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const corners = transformCorners(t, doc.width, doc.height).map((p) =>
        docToScreen(p, view),
      );
      const near = (a: Point, b: Point, r: number) =>
        Math.hypot(a.x - b.x, a.y - b.y) <= r;
      const topMid = {
        x: (corners[0].x + corners[1].x) / 2,
        y: (corners[0].y + corners[1].y) / 2,
      };
      const centerScreen = docToScreen(
        { x: doc.width / 2 + t.tx, y: doc.height / 2 + t.ty },
        view,
      );
      const dx = topMid.x - centerScreen.x;
      const dy = topMid.y - centerScreen.y;
      const len = Math.hypot(dx, dy) || 1;
      const rotHandle = {
        x: topMid.x + (dx / len) * 26,
        y: topMid.y + (dy / len) * 26,
      };
      let mode: "move" | "scale" | "rotate" | null = null;
      if (near(ps, rotHandle, 11)) {
        mode = "rotate";
      } else if (corners.some((c) => near(ps, c, 9))) {
        mode = "scale";
      } else {
        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        if (
          ps.x >= Math.min(...xs) &&
          ps.x <= Math.max(...xs) &&
          ps.y >= Math.min(...ys) &&
          ps.y <= Math.max(...ys)
        ) {
          mode = "move";
        }
      }
      if (mode) {
        t.drag = {
          mode,
          start: point,
          base: { tx: t.tx, ty: t.ty, scale: t.scale, rotation: t.rotation },
        };
        capturePointer(event.pointerId);
      }
      overrideRef.current = composeTransform(t, doc.width, doc.height);
      recomposite();
      requestRender();
      return;
    }

    if (tool === "eyedropper") {
      const source = compositeRef.current;
      if (source) {
        const sample = samplePixel(source, point.x, point.y);
        if (sample) {
          onPickColor(sample.hex);
        }
      }
      return;
    }

    if (tool === "magic-wand") {
      const source = compositeRef.current;
      if (source) {
        const built = magicWandSelection(source, point.x, point.y, tolerance);
        onCommitDoc((current) => setSelection(current, built), "select");
      }
      return;
    }

    if (tool === "gradient") {
      gradientRef.current = { start: point, current: point };
      capturePointer(event.pointerId);
      requestRender();
      return;
    }

    if (tool === "select-rect" || tool === "select-ellipse") {
      selectRef.current = { kind: "rect", start: point, current: point };
      capturePointer(event.pointerId);
      requestRender();
      return;
    }

    if (tool === "select-lasso") {
      selectRef.current = { kind: "lasso", points: [point] };
      capturePointer(event.pointerId);
      requestRender();
      return;
    }

    if (tool === "move") {
      const layer = activeLayer(doc);
      if (!layer) {
        return;
      }
      let base: HTMLCanvasElement;
      let float: HTMLCanvasElement;
      if (doc.selection) {
        float = extractSelection(layer.bitmap, doc.selection);
        base = clearInSelection(layer.bitmap, doc.selection);
      } else {
        float = cloneBitmap(layer.bitmap);
        base = createBitmap(doc.width, doc.height);
      }
      moveRef.current = { base, float, start: point, offset: { x: 0, y: 0 } };
      overrideRef.current = composeMove(base, float, 0, 0);
      capturePointer(event.pointerId);
      recomposite();
      requestRender();
      return;
    }

    if (SHAPE_KIND[tool]) {
      shapeRef.current = { start: point, current: point };
      capturePointer(event.pointerId);
      requestRender();
      return;
    }

    if (tool === "text") {
      setTextEdit({ point, value: "" });
      return;
    }

    if (tool === "crop") {
      cropRef.current = { start: point, current: point };
      capturePointer(event.pointerId);
      requestRender();
      return;
    }

    if (tool === "fill") {
      const layer = activeLayer(doc);
      if (!layer) {
        return;
      }
      const working = cloneBitmap(layer.bitmap);
      if (floodFill(working, point.x, point.y, color, tolerance)) {
        onCommitDoc((current) => {
          const target = activeLayer(current);
          if (!target) {
            return current;
          }
          const result = current.selection
            ? applySelectionClip(target.bitmap, working, current.selection)
            : working;
          return commitLayerBitmap(current, current.activeLayerId, result);
        });
      }
      return;
    }

    if (tool === "brush" || tool === "eraser") {
      const layer = activeLayer(doc);
      if (!layer) {
        return;
      }
      const working = cloneBitmap(layer.bitmap);
      const wctx = working.getContext("2d");
      if (!wctx) {
        return;
      }
      overrideRef.current = working;
      paintStamp(wctx, point.x, point.y, brushOptions(tool === "eraser"));
      strokingRef.current = true;
      lastPointRef.current = point;
      strokeStartRef.current = point;
      capturePointer(event.pointerId);
      recomposite();
      requestRender();
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (panningRef.current) {
      const dx = event.clientX - panningRef.current.x;
      const dy = event.clientY - panningRef.current.y;
      panningRef.current = { x: event.clientX, y: event.clientY };
      panBy(dx, dy);
      return;
    }
    const point = screenToDoc(event.clientX, event.clientY);

    const drag = selectRef.current;
    if (drag) {
      if (drag.kind === "rect") {
        drag.current = point;
      } else {
        drag.points.push(point);
      }
      requestRender();
      return;
    }

    const move = moveRef.current;
    if (move) {
      move.offset = { x: point.x - move.start.x, y: point.y - move.start.y };
      overrideRef.current = composeMove(
        move.base,
        move.float,
        move.offset.x,
        move.offset.y,
      );
      recomposite();
      requestRender();
      return;
    }

    if (shapeRef.current) {
      shapeRef.current.current = constrainForShape(
        shapeRef.current.start,
        point,
        tool,
        event.shiftKey,
      );
      requestRender();
      return;
    }

    if (gradientRef.current) {
      gradientRef.current.current = event.shiftKey
        ? constrain45(gradientRef.current.start, point)
        : point;
      requestRender();
      return;
    }

    if (cropRef.current) {
      cropRef.current.current = point;
      requestRender();
      return;
    }

    const transform = transformRef.current;
    if (transform && transform.drag) {
      updateTransformDrag(transform, point);
      overrideRef.current = composeTransform(transform, doc.width, doc.height);
      recomposite();
      requestRender();
      return;
    }

    if (!strokingRef.current || !overrideRef.current || !lastPointRef.current) {
      return;
    }
    const wctx = overrideRef.current.getContext("2d");
    if (!wctx) {
      return;
    }
    const target =
      event.shiftKey && strokeStartRef.current
        ? constrainAxis(strokeStartRef.current, point)
        : point;
    paintLine(wctx, lastPointRef.current, target, brushOptions(tool === "eraser"));
    lastPointRef.current = target;
    recomposite();
    requestRender();
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (stage && stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
    if (panningRef.current) {
      panningRef.current = null;
      applyCursor();
      return;
    }

    const activeTransform = transformRef.current;
    if (activeTransform?.drag) {
      updateTransformDrag(
        activeTransform,
        screenToDoc(event.clientX, event.clientY),
      );
      activeTransform.drag = null;
      overrideRef.current = composeTransform(
        activeTransform,
        doc.width,
        doc.height,
      );
      recomposite();
      requestRender();
      return;
    }

    const drag = selectRef.current;
    if (drag) {
      selectRef.current = null;
      const releasePoint = screenToDoc(event.clientX, event.clientY);
      if (drag.kind === "rect") {
        drag.current = releasePoint;
      } else {
        drag.points.push(releasePoint);
      }
      const built =
        drag.kind === "rect"
          ? tool === "select-ellipse"
            ? ellipseSelection(
                doc.width,
                doc.height,
                normalizeRect(drag.start, drag.current),
              )
            : rectSelection(
                doc.width,
                doc.height,
                normalizeRect(drag.start, drag.current),
              )
          : polySelection(doc.width, doc.height, drag.points);
      onCommitDoc((current) => setSelection(current, built), "select");
      requestRender();
      return;
    }

    const move = moveRef.current;
    if (move) {
      moveRef.current = null;
      const { base, float, offset } = move;
      const final = composeMove(base, float, offset.x, offset.y);
      overrideRef.current = null;
      onCommitDoc((current) => {
        let next = commitLayerBitmap(current, current.activeLayerId, final);
        if (current.selection) {
          next = setSelection(
            next,
            translateSelection(
              current.selection,
              offset.x,
              offset.y,
              current.width,
              current.height,
            ),
          );
        }
        return next;
      });
      return;
    }

    const activeShape = shapeRef.current;
    if (activeShape) {
      shapeRef.current = null;
      const kind = SHAPE_KIND[tool];
      const end = constrainForShape(
        activeShape.start,
        screenToDoc(event.clientX, event.clientY),
        tool,
        event.shiftKey,
      );
      if (kind) {
        onCommitDoc((current) => {
          const layer = activeLayer(current);
          if (!layer) {
            return current;
          }
          const working = cloneBitmap(layer.bitmap);
          const wctx = working.getContext("2d");
          if (!wctx) {
            return current;
          }
          paintShape(wctx, kind, activeShape.start, end, {
            color,
            fill: shape.fill,
            stroke: shape.stroke,
            strokeWidth: shape.strokeWidth,
          });
          const result = current.selection
            ? applySelectionClip(layer.bitmap, working, current.selection)
            : working;
          return commitLayerBitmap(current, current.activeLayerId, result);
        });
      }
      requestRender();
      return;
    }

    const grad = gradientRef.current;
    if (grad) {
      gradientRef.current = null;
      const end = event.shiftKey
        ? constrain45(grad.start, screenToDoc(event.clientX, event.clientY))
        : screenToDoc(event.clientX, event.clientY);
      onCommitDoc((current) => {
        const layer = activeLayer(current);
        if (!layer) {
          return current;
        }
        const working = cloneBitmap(layer.bitmap);
        const wctx = working.getContext("2d");
        if (!wctx) {
          return current;
        }
        fillGradient(wctx, current.width, current.height, grad.start, end, {
          type: gradient.type,
          fg: color,
          bg: bgColor,
          mode: gradient.mode,
        });
        const result = current.selection
          ? applySelectionClip(layer.bitmap, working, current.selection)
          : working;
        return commitLayerBitmap(current, current.activeLayerId, result);
      });
      requestRender();
      return;
    }

    const crop = cropRef.current;
    if (crop) {
      cropRef.current = null;
      const end = screenToDoc(event.clientX, event.clientY);
      const rect = normalizeRect(crop.start, end);
      if (rect.width >= 2 && rect.height >= 2) {
        onCommitDoc((current) => cropDoc(current, rect));
      }
      requestRender();
      return;
    }

    if (strokingRef.current && overrideRef.current) {
      const working = overrideRef.current;
      strokingRef.current = false;
      overrideRef.current = null;
      lastPointRef.current = null;
      onCommitDoc((current) => {
        const target = activeLayer(current);
        if (!target) {
          return current;
        }
        const result = current.selection
          ? applySelectionClip(target.bitmap, working, current.selection)
          : working;
        return commitLayerBitmap(current, current.activeLayerId, result);
      });
    }
  }

  function commitText() {
    const edit = textEdit;
    setTextEdit(null);
    if (!edit || !edit.value.trim()) {
      return;
    }
    onCommitDoc((current) => {
      const layer = activeLayer(current);
      if (!layer) {
        return current;
      }
      const textBitmap = rasterizeText(
        current.width,
        current.height,
        edit.value,
        edit.point,
        {
          color,
          fontSize: text.fontSize,
          fontFamily: text.fontFamily,
          bold: text.bold,
          italic: text.italic,
        },
      );
      const working = cloneBitmap(layer.bitmap);
      working.getContext("2d")?.drawImage(textBitmap, 0, 0);
      return commitLayerBitmap(current, current.activeLayerId, working);
    });
  }

  const textScreen = textEdit ? docToScreen(textEdit.point, view) : null;

  return (
    <div
      className="image-editor-stage"
      ref={stageRef}
      role="application"
      aria-label="Image canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length > 0) {
          event.preventDefault();
          onDropFiles(event.dataTransfer.files);
        }
      }}
    >
      <canvas ref={viewCanvasRef} className="image-editor-view-canvas" />
      <canvas ref={overlayCanvasRef} className="image-editor-overlay-canvas" />
      {textEdit && textScreen ? (
        <input
          className="image-editor-text-input"
          autoFocus
          value={textEdit.value}
          placeholder="Type…"
          spellCheck={false}
          style={{
            left: `${textScreen.x}px`,
            top: `${textScreen.y}px`,
            fontSize: `${Math.max(8, text.fontSize * view.scale)}px`,
            fontFamily: text.fontFamily,
            fontWeight: text.bold ? 700 : 400,
            fontStyle: text.italic ? "italic" : "normal",
            color,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            setTextEdit({ ...textEdit, value: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitText();
            } else if (event.key === "Escape") {
              setTextEdit(null);
            }
          }}
          onBlur={commitText}
        />
      ) : null}
    </div>
  );
}
