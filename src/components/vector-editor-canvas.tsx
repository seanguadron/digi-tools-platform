"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { objectBounds } from "@/lib/vector-editor/geometry";
import {
  createShape,
  isDegenerate,
  resizeShape,
} from "@/lib/vector-editor/document";
import {
  RESIZE_HANDLES,
  resizeObject,
  rotateObject,
  translateObject,
  type ResizeHandle,
} from "@/lib/vector-editor/transform";
import type {
  Point,
  VectorDocument,
  VectorObject,
} from "@/lib/vector-editor/types";
import type { VectorToolId } from "@/lib/vector-editor/tools";

const HANDLE_PX = 9; // on-screen handle size, kept constant via 1 / scale
const ROTATE_OFFSET_PX = 26; // gap from the top edge to the rotate handle
const MINIMAP_WIDTH = 168;

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A pointer gesture in progress.
type Action =
  | { type: "draw"; start: Point }
  | { type: "move"; object: VectorObject; start: Point }
  | { type: "resize"; object: VectorObject; handle: ResizeHandle }
  | { type: "rotate"; object: VectorObject }
  | { type: "pan"; startX: number; startY: number; startView: ViewBox };

function clientToUser(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const user = point.matrixTransform(ctm.inverse());
  return { x: user.x, y: user.y };
}

function ShapeElement({
  object,
  interactive = true,
}: {
  object: VectorObject;
  interactive?: boolean;
}) {
  if (object.hidden) return null;

  const box = objectBounds(object);
  const transform =
    object.rotation !== 0
      ? `rotate(${object.rotation} ${box.cx} ${box.cy})`
      : undefined;

  const common = {
    ...(interactive ? { "data-object-id": object.id } : { pointerEvents: "none" as const }),
    transform,
    opacity: object.opacity,
    fill: object.fill ? object.fill.color : "none",
    fillOpacity: object.fill ? object.fill.opacity : undefined,
    stroke: object.stroke ? object.stroke.color : "none",
    strokeWidth: object.stroke ? object.stroke.width : undefined,
    strokeOpacity: object.stroke ? object.stroke.opacity : undefined,
  };

  switch (object.kind) {
    case "rect":
      return (
        <rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          rx={object.radius || undefined}
          {...common}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={object.cx}
          cy={object.cy}
          rx={object.rx}
          ry={object.ry}
          {...common}
        />
      );
    case "line":
      return (
        <line
          x1={object.x1}
          y1={object.y1}
          x2={object.x2}
          y2={object.y2}
          {...common}
        />
      );
    case "polygon":
      return (
        <polygon
          points={object.points.map((p) => `${p.x},${p.y}`).join(" ")}
          {...common}
        />
      );
  }
}

function handlePosition(handle: ResizeHandle, b: ReturnType<typeof objectBounds>) {
  const left = b.x;
  const right = b.x + b.width;
  const top = b.y;
  const bottom = b.y + b.height;
  const x = handle.includes("w") ? left : handle.includes("e") ? right : b.cx;
  const y = handle.includes("n") ? top : handle.includes("s") ? bottom : b.cy;
  return { x, y };
}

function SelectionOverlay({
  object,
  scale,
}: {
  object: VectorObject;
  scale: number;
}) {
  const b = objectBounds(object);
  const size = HANDLE_PX / scale;
  const half = size / 2;
  const rotateGap = ROTATE_OFFSET_PX / scale;
  const transform =
    object.rotation !== 0
      ? `rotate(${object.rotation} ${b.cx} ${b.cy})`
      : undefined;

  return (
    <g className="ve-selection" transform={transform}>
      <rect className="ve-sel-frame" x={b.x} y={b.y} width={b.width} height={b.height} />
      <line className="ve-sel-rot-line" x1={b.cx} y1={b.y} x2={b.cx} y2={b.y - rotateGap} />
      <circle
        className="ve-sel-handle ve-sel-rotate"
        data-handle="rotate"
        cx={b.cx}
        cy={b.y - rotateGap}
        r={half}
      />
      {RESIZE_HANDLES.map((handle) => {
        const p = handlePosition(handle, b);
        return (
          <rect
            key={handle}
            className="ve-sel-handle"
            data-handle={handle}
            x={p.x - half}
            y={p.y - half}
            width={size}
            height={size}
          />
        );
      })}
    </g>
  );
}

function Minimap({
  doc,
  view,
  onRecenter,
}: {
  doc: VectorDocument;
  view: ViewBox;
  onRecenter: (point: Point) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const height = (MINIMAP_WIDTH * doc.height) / doc.width;

  function toDoc(event: ReactPointerEvent<SVGSVGElement>): Point {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0 };
    return clientToUser(svg, event.clientX, event.clientY);
  }

  return (
    <svg
      ref={ref}
      className="vector-editor-minimap"
      width={MINIMAP_WIDTH}
      height={height}
      viewBox={`0 0 ${doc.width} ${doc.height}`}
      aria-hidden="true"
      onPointerDown={(event) => {
        draggingRef.current = true;
        try {
          ref.current?.setPointerCapture(event.pointerId);
        } catch {
          /* best effort */
        }
        onRecenter(toDoc(event));
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) onRecenter(toDoc(event));
      }}
      onPointerUp={(event) => {
        draggingRef.current = false;
        try {
          if (ref.current?.hasPointerCapture(event.pointerId)) {
            ref.current.releasePointerCapture(event.pointerId);
          }
        } catch {
          /* best effort */
        }
      }}
    >
      <rect
        className="vector-editor-minimap-artboard"
        x={0}
        y={0}
        width={doc.width}
        height={doc.height}
        fill={doc.background ?? "transparent"}
      />
      {doc.objects.map((object) => (
        <ShapeElement key={object.id} object={object} interactive={false} />
      ))}
      <rect
        className="vector-editor-minimap-view"
        x={view.x}
        y={view.y}
        width={view.w}
        height={view.h}
      />
    </svg>
  );
}

export function VectorCanvas({
  doc,
  tool,
  selectedId,
  onDraw,
  onSelect,
  onTransform,
  onTransformEnd,
  onZoom,
}: {
  doc: VectorDocument;
  tool: VectorToolId;
  selectedId: string | null;
  onDraw: (object: VectorObject) => void;
  onSelect: (id: string | null) => void;
  onTransform: (object: VectorObject) => void;
  onTransformEnd: () => void;
  onZoom: (scale: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const actionRef = useRef<Action | null>(null);
  const draftRef = useRef<VectorObject | null>(null);
  const spaceRef = useRef(false);
  const [draft, setDraft] = useState<VectorObject | null>(null);
  const [scale, setScale] = useState(1);
  const [view, setView] = useState<ViewBox>(() => ({
    x: 0,
    y: 0,
    w: doc.width,
    h: doc.height,
  }));

  const drawing = tool !== "select";
  const selectedObject =
    doc.objects.find((object) => object.id === selectedId) ?? null;

  // Report the current user→screen scale (for the zoom readout) and keep the
  // selection handles a constant on-screen size. Re-measured on view change and
  // on resize.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (ctm && ctm.a) {
      setScale(ctm.a);
      onZoom(ctm.a);
    }
  }, [view, onZoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const ctm = svg.getScreenCTM();
      if (ctm && ctm.a) {
        setScale(ctm.a);
        onZoom(ctm.a);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [onZoom]);

  // Space toggles temporary pan mode (hold + drag).
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spaceRef.current = true;
        const active = document.activeElement as HTMLElement | null;
        if (!active || (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA")) {
          event.preventDefault();
        }
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Wheel zoom toward the cursor. A native, non-passive listener so
  // preventDefault actually blocks page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const focus = clientToUser(svg, event.clientX, event.clientY);
      zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, focus);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // zoomAt reads live state via setView's updater, so the listener needn't
    // re-bind on every view change — only when the artboard size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width]);

  function zoomAt(factor: number, focus: Point) {
    setView((current) => {
      const minW = doc.width / 20;
      const maxW = doc.width * 8;
      const w = Math.min(maxW, Math.max(minW, current.w / factor));
      const ratio = w / current.w;
      const h = current.h * ratio;
      return {
        x: focus.x - (focus.x - current.x) * ratio,
        y: focus.y - (focus.y - current.y) * ratio,
        w,
        h,
      };
    });
  }

  function zoomByButton(factor: number) {
    zoomAt(factor, { x: view.x + view.w / 2, y: view.y + view.h / 2 });
  }

  function fitView() {
    setView({ x: 0, y: 0, w: doc.width, h: doc.height });
  }

  function recenter(point: Point) {
    setView((current) => ({
      ...current,
      x: point.x - current.w / 2,
      y: point.y - current.h / 2,
    }));
  }

  function setLiveDraft(next: VectorObject | null) {
    draftRef.current = next;
    setDraft(next);
  }

  function capture(event: ReactPointerEvent<SVGSVGElement>) {
    try {
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* best effort */
    }
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;

    // Pan: middle button, or Space + left drag. Works in any tool.
    if (event.button === 1 || (spaceRef.current && event.button === 0)) {
      actionRef.current = {
        type: "pan",
        startX: event.clientX,
        startY: event.clientY,
        startView: view,
      };
      capture(event);
      event.preventDefault();
      return;
    }

    if (event.button !== 0) return;
    const point = clientToUser(svg, event.clientX, event.clientY);

    if (tool !== "select") {
      actionRef.current = { type: "draw", start: point };
      setLiveDraft(createShape(tool, point, point, doc.objects));
      capture(event);
      event.preventDefault();
      return;
    }

    const target = event.target as Element;
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
    if (handle && selectedObject) {
      actionRef.current =
        handle === "rotate"
          ? { type: "rotate", object: selectedObject }
          : { type: "resize", object: selectedObject, handle: handle as ResizeHandle };
      capture(event);
      event.preventDefault();
      return;
    }

    const objectId = target
      .closest("[data-object-id]")
      ?.getAttribute("data-object-id");
    if (objectId) {
      const hit = doc.objects.find((object) => object.id === objectId);
      if (hit && !hit.locked) {
        if (objectId !== selectedId) onSelect(objectId);
        actionRef.current = { type: "move", object: hit, start: point };
        capture(event);
        event.preventDefault();
        return;
      }
    }

    onSelect(null);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const action = actionRef.current;
    const svg = svgRef.current;
    if (!action || !svg) return;

    if (action.type === "pan") {
      const dx = (event.clientX - action.startX) / scale;
      const dy = (event.clientY - action.startY) / scale;
      setView({
        ...action.startView,
        x: action.startView.x - dx,
        y: action.startView.y - dy,
      });
      return;
    }

    const point = clientToUser(svg, event.clientX, event.clientY);
    switch (action.type) {
      case "draw":
        if (draftRef.current) {
          setLiveDraft(resizeShape(draftRef.current, action.start, point));
        }
        break;
      case "move":
        onTransform(
          translateObject(
            action.object,
            point.x - action.start.x,
            point.y - action.start.y,
          ),
        );
        break;
      case "resize":
        onTransform(resizeObject(action.object, action.handle, point));
        break;
      case "rotate":
        onTransform(rotateObject(action.object, point, event.shiftKey));
        break;
    }
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const action = actionRef.current;
    actionRef.current = null;
    try {
      if (svgRef.current?.hasPointerCapture(event.pointerId)) {
        svgRef.current.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* best effort */
    }
    if (action?.type === "draw") {
      const finished = draftRef.current;
      setLiveDraft(null);
      if (finished && !isDegenerate(finished)) onDraw(finished);
    } else if (action && action.type !== "pan") {
      onTransformEnd();
    }
  }

  const zoomPct = Math.round(scale * 100);

  return (
    <div className="vector-editor-stage">
      <svg
        ref={svgRef}
        className={
          drawing ? "vector-editor-surface is-drawing" : "vector-editor-surface"
        }
        width="100%"
        height="100%"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="Vector artboard"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <rect
          className="vector-editor-artboard-bg"
          x={0}
          y={0}
          width={doc.width}
          height={doc.height}
          fill={doc.background ?? "transparent"}
        />
        {doc.objects.map((object) => (
          <ShapeElement key={object.id} object={object} />
        ))}
        {draft ? <ShapeElement object={draft} /> : null}
        {!drawing && selectedObject && !selectedObject.hidden ? (
          <SelectionOverlay object={selectedObject} scale={scale} />
        ) : null}
      </svg>

      <div
        className="vector-editor-zoombar"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={() => zoomByButton(1 / 1.25)} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <span className="vector-editor-zoom-readout">{zoomPct}%</span>
        <button type="button" onClick={() => zoomByButton(1.25)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button type="button" className="is-text" onClick={fitView} title="Fit artboard">
          Fit
        </button>
      </div>

      <Minimap doc={doc} view={view} onRecenter={recenter} />
    </div>
  );
}
