"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  insertAnchor,
  moveHandle,
  nearestOnPath,
  pathToD,
} from "@/lib/vector-editor/bezier";
import { objectBounds } from "@/lib/vector-editor/geometry";
import {
  createShape,
  isDegenerate,
  resizeShape,
} from "@/lib/vector-editor/document";
import { withAnchors } from "@/lib/vector-editor/paths";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  fontCss,
  MAX_TEXT_LENGTH,
  TEXT_ASCENT,
  TEXT_LINE_HEIGHT,
  textLines,
} from "@/lib/vector-editor/text";
import {
  RESIZE_HANDLES,
  resizeObject,
  rotateObject,
  rotatePoint,
  toLocalPoint,
  translateObject,
  type ResizeHandle,
} from "@/lib/vector-editor/transform";
import type {
  PathAnchor,
  PathObject,
  Point,
  VectorDocument,
  VectorObject,
} from "@/lib/vector-editor/types";
import { isDragShapeTool, type VectorToolId } from "@/lib/vector-editor/tools";

const HANDLE_PX = 9; // on-screen handle size, kept constant via 1 / scale
const ROTATE_OFFSET_PX = 26; // gap from the top edge to the rotate handle
const MINIMAP_WIDTH = 168;
const ANCHOR_PX = 8; // anchor dot size on screen
const KNOB_PX = 7; // bezier handle knob diameter on screen
const CLOSE_PX = 10; // pen: click this close to the first anchor to close
const SEGMENT_HIT_PX = 8; // direct: double-click this close to insert
const PEN_DRAG_PX = 3; // pen: drag past this to pull out handles

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The rotation frame frozen at drag start, so pointer math stays in the
// path's unrotated local space for the whole gesture.
interface RotFrame {
  cx: number;
  cy: number;
  rotation: number;
}

export interface AnchorSelection {
  objectId: string;
  indices: number[];
}

// An in-progress text entry/edit: id null while creating a new object.
// Font fields exist purely so the overlay renders WYSIWYG; the orchestrator
// owns what actually lands on the object.
export interface TextEditState {
  id: string | null;
  x: number;
  y: number;
  value: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
}

export interface TextCommit {
  id: string | null;
  x: number;
  y: number;
  value: string;
}

// A pointer gesture in progress.
type Action =
  | { type: "draw"; start: Point }
  | { type: "move"; objects: VectorObject[]; start: Point }
  | { type: "resize"; object: VectorObject; handle: ResizeHandle }
  | { type: "rotate"; object: VectorObject }
  | { type: "pan"; startX: number; startY: number; startView: ViewBox }
  | { type: "marquee"; start: Point; additive: boolean }
  | {
      type: "anchor-move";
      object: PathObject;
      indices: number[];
      start: Point;
      frame: RotFrame;
    }
  | {
      type: "handle-move";
      object: PathObject;
      index: number;
      which: "in" | "out";
      breakPair: boolean;
      frame: RotFrame;
    }
  | { type: "pen-place"; index: number; start: Point };

// Overlay palette selection: the artboard background is user-editable now,
// so the overlay chrome flips to a light-on-dark palette when the artboard
// is dark. Any safeColor form normalizes through a scratch canvas.
let colorScratch: CanvasRenderingContext2D | null = null;

function colorLuminance(color: string): number | null {
  if (typeof document === "undefined") return null;
  if (!colorScratch) {
    colorScratch = document.createElement("canvas").getContext("2d");
  }
  if (!colorScratch) return null;
  colorScratch.fillStyle = "#000000";
  colorScratch.fillStyle = color; // invalid values keep the previous one
  const normalized = colorScratch.fillStyle;
  let r = 0;
  let g = 0;
  let b = 0;
  if (normalized.startsWith("#") && normalized.length >= 7) {
    r = parseInt(normalized.slice(1, 3), 16);
    g = parseInt(normalized.slice(3, 5), 16);
    b = parseInt(normalized.slice(5, 7), 16);
  } else {
    const match = normalized.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (!match) return null;
    r = Number(match[1]);
    g = Number(match[2]);
    b = Number(match[3]);
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// A transparent artboard shows the theme's stage behind it, so the app
// theme decides; otherwise the background color's own luminance does.
function isArtboardDark(background: string | null): boolean {
  if (typeof document === "undefined") return false;
  if (background === null) {
    return document.documentElement.getAttribute("data-theme") !== "light";
  }
  const luminance = colorLuminance(background);
  return luminance !== null && luminance < 0.45;
}

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

function frameFor(object: VectorObject): RotFrame {
  const box = objectBounds(object);
  return { cx: box.cx, cy: box.cy, rotation: object.rotation };
}

function toFrameLocal(point: Point, frame: RotFrame): Point {
  if (frame.rotation === 0) return point;
  return toLocalPoint(point, frame.cx, frame.cy, frame.rotation);
}

function boundsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

function normalizedRect(a: Point, b: Point) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function ShapeElement({
  object,
  interactive = true,
  scale = 1,
}: {
  object: VectorObject;
  interactive?: boolean;
  scale?: number;
}) {
  if (object.hidden) return null;

  const box = objectBounds(object);
  const transform =
    object.rotation !== 0
      ? `rotate(${object.rotation} ${box.cx} ${box.cy})`
      : undefined;

  const common = {
    ...(interactive
      ? { "data-object-id": object.id }
      : { pointerEvents: "none" as const }),
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
    case "text": {
      const baseline = object.y + object.fontSize * TEXT_ASCENT;
      const content = (
        <text
          x={object.x}
          y={baseline}
          fontFamily={fontCss(object.fontFamily)}
          fontSize={object.fontSize}
          fontWeight={object.bold ? 700 : 400}
          fontStyle={object.italic ? "italic" : undefined}
          fill={object.fill ? object.fill.color : "none"}
          fillOpacity={object.fill ? object.fill.opacity : undefined}
          stroke={object.stroke ? object.stroke.color : "none"}
          strokeWidth={object.stroke ? object.stroke.width : undefined}
          strokeOpacity={object.stroke ? object.stroke.opacity : undefined}
        >
          {textLines(object.text).map((line, index) => (
            <tspan
              key={index}
              x={object.x}
              y={baseline + index * object.fontSize * TEXT_LINE_HEIGHT}
            >
              {line || " "}
            </tspan>
          ))}
        </text>
      );
      if (!interactive) {
        return (
          <g pointerEvents="none" transform={transform} opacity={object.opacity}>
            {content}
          </g>
        );
      }
      // A transparent bounds rect makes the whole block clickable, not just
      // the glyph strokes.
      return (
        <g data-object-id={object.id} transform={transform} opacity={object.opacity}>
          {content}
          <rect
            x={object.x}
            y={object.y}
            width={object.width}
            height={object.height}
            fill="transparent"
            stroke="none"
          />
        </g>
      );
    }
    case "path": {
      const d = pathToD(object.anchors, object.closed);
      if (!interactive) {
        return <path d={d} {...common} />;
      }
      // A transparent fat-stroke twin makes thin curves forgiving to click —
      // the DOM hit-tests the stroke band so no manual curve math is needed
      // for plain selection.
      const hitWidth = Math.max(
        object.stroke ? object.stroke.width : 0,
        10 / scale,
      );
      return (
        <g data-object-id={object.id} transform={transform} opacity={object.opacity}>
          <path
            d={d}
            fill={object.fill ? object.fill.color : "none"}
            fillOpacity={object.fill ? object.fill.opacity : undefined}
            stroke={object.stroke ? object.stroke.color : "none"}
            strokeWidth={object.stroke ? object.stroke.width : undefined}
            strokeOpacity={object.stroke ? object.stroke.opacity : undefined}
          />
          <path
            d={d}
            fill="none"
            stroke="transparent"
            strokeWidth={hitWidth}
            pointerEvents="stroke"
          />
        </g>
      );
    }
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
  withHandles,
}: {
  object: VectorObject;
  scale: number;
  withHandles: boolean;
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
      {withHandles ? (
        <>
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
        </>
      ) : null}
    </g>
  );
}

// Anchor dots + bezier handles for the direct-selection tool. Rendered inside
// the object's own rotation transform so the dots sit on the drawn shape;
// pointer math converts back through the frozen frame.
function AnchorOverlay({
  object,
  selectedIndices,
  scale,
}: {
  object: PathObject;
  selectedIndices: number[];
  scale: number;
}) {
  const b = objectBounds(object);
  const transform =
    object.rotation !== 0
      ? `rotate(${object.rotation} ${b.cx} ${b.cy})`
      : undefined;
  const size = ANCHOR_PX / scale;
  const half = size / 2;
  const knob = KNOB_PX / scale / 2;
  const selected = new Set(selectedIndices);

  return (
    <g className="ve-anchor-layer" transform={transform}>
      {object.anchors.map((anchor, index) => {
        const isSelected = selected.has(index);
        const { point } = anchor;
        return (
          <g key={index}>
            {isSelected && anchor.handleIn ? (
              <>
                <line
                  className="ve-handle-line"
                  x1={point.x}
                  y1={point.y}
                  x2={point.x + anchor.handleIn.x}
                  y2={point.y + anchor.handleIn.y}
                />
                <circle
                  className="ve-handle-knob"
                  data-anchor-handle="in"
                  data-anchor-index={index}
                  cx={point.x + anchor.handleIn.x}
                  cy={point.y + anchor.handleIn.y}
                  r={knob}
                />
              </>
            ) : null}
            {isSelected && anchor.handleOut ? (
              <>
                <line
                  className="ve-handle-line"
                  x1={point.x}
                  y1={point.y}
                  x2={point.x + anchor.handleOut.x}
                  y2={point.y + anchor.handleOut.y}
                />
                <circle
                  className="ve-handle-knob"
                  data-anchor-handle="out"
                  data-anchor-index={index}
                  cx={point.x + anchor.handleOut.x}
                  cy={point.y + anchor.handleOut.y}
                  r={knob}
                />
              </>
            ) : null}
            {anchor.type === "corner" ? (
              <rect
                className={isSelected ? "ve-anchor is-selected" : "ve-anchor"}
                data-anchor-index={index}
                x={point.x - half}
                y={point.y - half}
                width={size}
                height={size}
              />
            ) : (
              <circle
                className={isSelected ? "ve-anchor is-selected" : "ve-anchor"}
                data-anchor-index={index}
                cx={point.x}
                cy={point.y}
                r={half}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// The in-progress pen drawing: the path so far, a ghost segment to the
// cursor, and the working anchors.
function PenPreview({
  anchors,
  hover,
  scale,
}: {
  anchors: PathAnchor[];
  hover: Point | null;
  scale: number;
}) {
  const size = ANCHOR_PX / scale;
  const half = size / 2;
  const knob = KNOB_PX / scale / 2;
  const last = anchors[anchors.length - 1];
  const ghost =
    hover && anchors.length > 0
      ? pathToD(
          [
            ...anchors.slice(-1),
            { point: hover, handleIn: null, handleOut: null, type: "corner" },
          ],
          false,
        )
      : null;

  return (
    <g className="ve-pen-layer">
      {anchors.length > 1 ? (
        <path className="ve-pen-path" d={pathToD(anchors, false)} />
      ) : null}
      {ghost ? <path className="ve-pen-ghost" d={ghost} /> : null}
      {last?.handleIn ? (
        <>
          <line
            className="ve-handle-line"
            x1={last.point.x}
            y1={last.point.y}
            x2={last.point.x + last.handleIn.x}
            y2={last.point.y + last.handleIn.y}
          />
          <circle
            className="ve-handle-knob"
            cx={last.point.x + last.handleIn.x}
            cy={last.point.y + last.handleIn.y}
            r={knob}
          />
        </>
      ) : null}
      {last?.handleOut ? (
        <>
          <line
            className="ve-handle-line"
            x1={last.point.x}
            y1={last.point.y}
            x2={last.point.x + last.handleOut.x}
            y2={last.point.y + last.handleOut.y}
          />
          <circle
            className="ve-handle-knob"
            cx={last.point.x + last.handleOut.x}
            cy={last.point.y + last.handleOut.y}
            r={knob}
          />
        </>
      ) : null}
      {anchors.map((anchor, index) => (
        <rect
          key={index}
          className={
            index === 0 && anchors.length >= 3
              ? "ve-anchor ve-pen-first"
              : "ve-anchor"
          }
          x={anchor.point.x - half}
          y={anchor.point.y - half}
          width={size}
          height={size}
        />
      ))}
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
  selectedIds,
  anchorSelection,
  onDraw,
  onCreatePath,
  onSelectIds,
  onAnchorSelection,
  onTransform,
  onTransformMany,
  onEditPath,
  onTransformEnd,
  onConvertToPath,
  onCommitText,
  onZoom,
}: {
  doc: VectorDocument;
  tool: VectorToolId;
  selectedIds: string[];
  anchorSelection: AnchorSelection | null;
  onDraw: (object: VectorObject) => void;
  onCreatePath: (anchors: PathAnchor[], closed: boolean) => void;
  onSelectIds: (ids: string[]) => void;
  onAnchorSelection: (selection: AnchorSelection | null) => void;
  onTransform: (object: VectorObject) => void;
  onTransformMany: (objects: VectorObject[]) => void;
  onEditPath: (object: PathObject) => void;
  onTransformEnd: () => void;
  onConvertToPath: (id: string) => void;
  onCommitText: (commit: TextCommit) => void;
  onZoom: (scale: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const actionRef = useRef<Action | null>(null);
  const draftRef = useRef<VectorObject | null>(null);
  const penRef = useRef<PathAnchor[] | null>(null);
  const spaceRef = useRef(false);
  const [draft, setDraft] = useState<VectorObject | null>(null);
  const [penAnchors, setPenAnchors] = useState<PathAnchor[] | null>(null);
  const [penHover, setPenHover] = useState<Point | null>(null);
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null);
  const textEditRef = useRef<HTMLTextAreaElement | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(
    null,
  );
  const [scale, setScale] = useState(1);
  const [view, setView] = useState<ViewBox>(() => ({
    x: 0,
    y: 0,
    w: doc.width,
    h: doc.height,
  }));

  const drawing = isDragShapeTool(tool) || tool === "pen";
  const selectedObjects = doc.objects.filter((object) =>
    selectedIds.includes(object.id),
  );
  const soleSelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const selectedPath =
    soleSelected && soleSelected.kind === "path" ? soleSelected : null;

  function setPen(next: PathAnchor[] | null) {
    penRef.current = next;
    setPenAnchors(next);
    if (next === null) setPenHover(null);
  }

  // Finish (or discard) the in-progress pen path.
  function finishPen(close: boolean) {
    const anchors = penRef.current;
    setPen(null);
    if (!anchors) return;
    if (anchors.length >= (close ? 3 : 2)) {
      onCreatePath(anchors, close);
    }
  }

  function openTextEditor(state: TextEditState) {
    setTextEdit(state);
  }

  function openTextEditorFor(object: VectorObject) {
    if (object.kind !== "text") return;
    openTextEditor({
      id: object.id,
      x: object.x,
      y: object.y,
      value: object.text,
      fontFamily: object.fontFamily,
      fontSize: object.fontSize,
      bold: object.bold,
      italic: object.italic,
      // Fill-off text is invisible on canvas — the overlay shows a ghost
      // ink so typing still reads, without faking a fill that isn't there.
      color: object.fill?.color ?? "rgba(15, 23, 42, 0.4)",
    });
  }

  function openNewTextEditor(point: Point) {
    // The click marks the first baseline; the block's top sits an ascent up.
    openTextEditor({
      id: null,
      x: point.x,
      y: point.y - DEFAULT_FONT_SIZE * TEXT_ASCENT,
      value: "",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_FONT_SIZE,
      bold: false,
      italic: false,
      color: "#0f172a",
    });
  }

  function commitTextEdit() {
    if (!textEdit) return;
    setTextEdit(null);
    onCommitText({
      id: textEdit.id,
      x: textEdit.x,
      y: textEdit.y,
      value: textEdit.value,
    });
    // Land focus back on the artboard, not <body>.
    svgRef.current?.focus();
  }

  function cancelTextEdit() {
    setTextEdit(null);
    svgRef.current?.focus();
  }

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

  // Space toggles temporary pan mode (hold + drag). Buttons and selects keep
  // their native Space activation — swallowing it there would break every
  // toolbar and dock control (the same exemption the Enter shortcut carries).
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName;
        const typing =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "BUTTON" ||
          tag === "SELECT" ||
          active?.isContentEditable === true;
        if (typing) return;
        spaceRef.current = true;
        event.preventDefault();
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

  // While a pen path is in progress, Enter/Escape finish it — captured before
  // the editor-level key handler so Escape doesn't also clear the selection.
  useEffect(() => {
    if (penAnchors === null) return;
    const finish = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finishPen(false);
      }
    };
    window.addEventListener("keydown", finish, { capture: true });
    return () => window.removeEventListener("keydown", finish, { capture: true });
    // finishPen reads penRef, not state, so a stable identity is fine here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penAnchors !== null]);

  // Leaving the pen tool finishes whatever was in progress.
  useEffect(() => {
    if (tool !== "pen" && penRef.current) {
      finishPen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Keyboard entry for the type tool: Enter opens an editor at the artboard
  // center (the pointer path is a click on the canvas).
  useEffect(() => {
    if (tool !== "text" || textEdit) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Buttons and selects keep their native Enter activation — this
      // shortcut only fires from the canvas/body context.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        openNewTextEditor({ x: doc.width / 2, y: doc.height / 2 });
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, textEdit, doc.width, doc.height]);

  // Keep the overlay editor pinned to its doc-space point through pan/zoom;
  // getScreenCTM covers the letterboxing preserveAspectRatio introduces.
  useEffect(() => {
    const svg = svgRef.current;
    const el = textEditRef.current;
    if (!svg || !el || !textEdit) return;
    const stage = el.parentElement;
    if (!stage) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const stageRect = stage.getBoundingClientRect();
    const sx = ctm.a * textEdit.x + ctm.c * textEdit.y + ctm.e - stageRect.left;
    const sy = ctm.b * textEdit.x + ctm.d * textEdit.y + ctm.f - stageRect.top;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.fontSize = `${textEdit.fontSize * (ctm.a || 1)}px`;
    el.focus();
  }, [textEdit, view, scale]);

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

  function handlePenDown(point: Point, event: ReactPointerEvent<SVGSVGElement>) {
    const anchors = penRef.current ?? [];
    // Clicking the first anchor closes the path (needs 3+ anchors).
    if (anchors.length >= 3) {
      const first = anchors[0].point;
      const dist = Math.hypot(point.x - first.x, point.y - first.y);
      if (dist <= CLOSE_PX / scale) {
        finishPen(true);
        return;
      }
    }
    const next: PathAnchor[] = [
      ...anchors,
      { point, handleIn: null, handleOut: null, type: "corner" },
    ];
    setPen(next);
    actionRef.current = { type: "pen-place", index: next.length - 1, start: point };
    capture(event);
  }

  function handleDirectDown(
    point: Point,
    event: ReactPointerEvent<SVGSVGElement>,
  ) {
    const target = event.target as Element;

    // Bounds guard, not just a type guard: safety must not depend on every
    // downstream consumer remembering its own out-of-range check.
    const validIndex = (index: number) =>
      Number.isInteger(index) &&
      index >= 0 &&
      selectedPath !== null &&
      index < selectedPath.anchors.length;

    // 1. A bezier handle knob of the selected path.
    const handleEl = target.closest("[data-anchor-handle]");
    if (handleEl && selectedPath) {
      const which = handleEl.getAttribute("data-anchor-handle") as "in" | "out";
      const index = Number(handleEl.getAttribute("data-anchor-index"));
      if (validIndex(index)) {
        actionRef.current = {
          type: "handle-move",
          object: selectedPath,
          index,
          which,
          breakPair: event.altKey,
          frame: frameFor(selectedPath),
        };
        capture(event);
        event.preventDefault();
        return;
      }
    }

    // 2. An anchor dot of the selected path.
    const anchorEl = target.closest("[data-anchor-index]");
    if (anchorEl && selectedPath) {
      const index = Number(anchorEl.getAttribute("data-anchor-index"));
      if (validIndex(index)) {
        const current =
          anchorSelection && anchorSelection.objectId === selectedPath.id
            ? anchorSelection.indices
            : [];
        let indices: number[];
        if (event.shiftKey) {
          indices = current.includes(index)
            ? current.filter((i) => i !== index)
            : [...current, index];
        } else {
          indices = current.includes(index) ? current : [index];
        }
        onAnchorSelection(
          indices.length > 0
            ? { objectId: selectedPath.id, indices }
            : null,
        );
        if (indices.includes(index)) {
          actionRef.current = {
            type: "anchor-move",
            object: selectedPath,
            indices,
            start: point,
            frame: frameFor(selectedPath),
          };
          capture(event);
        }
        event.preventDefault();
        return;
      }
    }

    // 3. An object body: select it; dragging moves it whole.
    const objectId = target
      .closest("[data-object-id]")
      ?.getAttribute("data-object-id");
    if (objectId) {
      const hit = doc.objects.find((object) => object.id === objectId);
      if (hit && !hit.locked) {
        onSelectIds([objectId]);
        if (!anchorSelection || anchorSelection.objectId !== objectId) {
          onAnchorSelection(null);
        }
        actionRef.current = { type: "move", objects: [hit], start: point };
        capture(event);
        event.preventDefault();
        return;
      }
    }

    // 4. Empty canvas: marquee over anchors (of the selected path) or objects.
    actionRef.current = { type: "marquee", start: point, additive: event.shiftKey };
    setMarquee({ start: point, current: point });
    capture(event);
  }

  function handleSelectDown(
    point: Point,
    event: ReactPointerEvent<SVGSVGElement>,
  ) {
    const target = event.target as Element;

    const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
    if (handle && soleSelected) {
      actionRef.current =
        handle === "rotate"
          ? { type: "rotate", object: soleSelected }
          : {
              type: "resize",
              object: soleSelected,
              handle: handle as ResizeHandle,
            };
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
        let nextIds: string[];
        if (event.shiftKey) {
          nextIds = selectedIds.includes(objectId)
            ? selectedIds.filter((id) => id !== objectId)
            : [...selectedIds, objectId];
          onSelectIds(nextIds);
          // Shift-click adjusts membership without starting a drag.
          return;
        }
        nextIds = selectedIds.includes(objectId) ? selectedIds : [objectId];
        if (nextIds !== selectedIds) onSelectIds(nextIds);
        const objects = doc.objects.filter(
          (object) => nextIds.includes(object.id) && !object.locked,
        );
        actionRef.current = { type: "move", objects, start: point };
        capture(event);
        event.preventDefault();
        return;
      }
    }

    actionRef.current = { type: "marquee", start: point, additive: event.shiftKey };
    setMarquee({ start: point, current: point });
    capture(event);
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

    if (tool === "pen") {
      handlePenDown(point, event);
      event.preventDefault();
      return;
    }

    if (tool === "text") {
      // Clicking an existing text block edits it; empty canvas starts a new
      // one. An open editor commits via its own blur first.
      const objectId = (event.target as Element)
        .closest("[data-object-id]")
        ?.getAttribute("data-object-id");
      const hit = objectId
        ? doc.objects.find((object) => object.id === objectId)
        : undefined;
      if (hit && hit.kind === "text" && !hit.locked) {
        onSelectIds([hit.id]);
        openTextEditorFor(hit);
      } else if (!textEdit) {
        openNewTextEditor(point);
      }
      event.preventDefault();
      return;
    }

    if (isDragShapeTool(tool)) {
      actionRef.current = { type: "draw", start: point };
      setLiveDraft(createShape(tool, point, point, doc.objects));
      capture(event);
      event.preventDefault();
      return;
    }

    if (tool === "direct") {
      handleDirectDown(point, event);
      return;
    }

    handleSelectDown(point, event);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const action = actionRef.current;
    const svg = svgRef.current;
    if (!svg) return;

    if (!action) {
      if (tool === "pen" && penRef.current) {
        setPenHover(clientToUser(svg, event.clientX, event.clientY));
      }
      return;
    }

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
      case "move": {
        const dx = point.x - action.start.x;
        const dy = point.y - action.start.y;
        const moved = action.objects.map((object) =>
          translateObject(object, dx, dy),
        );
        if (moved.length === 1) onTransform(moved[0]);
        else onTransformMany(moved);
        break;
      }
      case "resize":
        onTransform(resizeObject(action.object, action.handle, point));
        break;
      case "rotate":
        onTransform(rotateObject(action.object, point, event.shiftKey));
        break;
      case "marquee":
        setMarquee({ start: action.start, current: point });
        break;
      case "anchor-move": {
        const local = toFrameLocal(point, action.frame);
        const startLocal = toFrameLocal(action.start, action.frame);
        const dx = local.x - startLocal.x;
        const dy = local.y - startLocal.y;
        const selectedSet = new Set(action.indices);
        const moved = action.object.anchors.map((anchor, index) =>
          selectedSet.has(index)
            ? {
                ...anchor,
                point: { x: anchor.point.x + dx, y: anchor.point.y + dy },
              }
            : anchor,
        );
        onEditPath(withAnchors(action.object, moved));
        break;
      }
      case "handle-move": {
        const local = toFrameLocal(point, action.frame);
        onEditPath(
          withAnchors(
            action.object,
            moveHandle(
              action.object.anchors,
              action.index,
              action.which,
              local,
              action.breakPair || event.altKey,
            ),
          ),
        );
        break;
      }
      case "pen-place": {
        const anchors = penRef.current;
        if (!anchors) break;
        const dx = point.x - action.start.x;
        const dy = point.y - action.start.y;
        if (Math.hypot(dx, dy) < PEN_DRAG_PX / scale) break;
        const next = [...anchors];
        next[action.index] = {
          ...next[action.index],
          handleOut: { x: dx, y: dy },
          handleIn: { x: -dx, y: -dy },
          type: "smooth",
        };
        setPen(next);
        break;
      }
    }
  }

  function applyMarquee(action: Extract<Action, { type: "marquee" }>, end: Point) {
    const rect = normalizedRect(action.start, end);
    const isClick = rect.width < 2 / scale && rect.height < 2 / scale;

    // Direct tool with a path selected: marquee picks anchors.
    if (tool === "direct" && selectedPath) {
      if (isClick) {
        onAnchorSelection(null);
        if (!action.additive) onSelectIds([]);
        return;
      }
      const frame = frameFor(selectedPath);
      const inside = selectedPath.anchors
        .map((anchor, index) => ({ anchor, index }))
        .filter(({ anchor }) => {
          const world =
            frame.rotation === 0
              ? anchor.point
              : rotatePoint(anchor.point, frame.cx, frame.cy, frame.rotation);
          return (
            world.x >= rect.x &&
            world.x <= rect.x + rect.width &&
            world.y >= rect.y &&
            world.y <= rect.y + rect.height
          );
        })
        .map(({ index }) => index);
      const current =
        anchorSelection && anchorSelection.objectId === selectedPath.id
          ? anchorSelection.indices
          : [];
      const indices = action.additive
        ? [...new Set([...current, ...inside])]
        : inside;
      onAnchorSelection(
        indices.length > 0
          ? { objectId: selectedPath.id, indices }
          : null,
      );
      return;
    }

    if (isClick) {
      if (!action.additive) {
        onSelectIds([]);
        onAnchorSelection(null);
      }
      return;
    }

    const inside = doc.objects
      .filter(
        (object) =>
          !object.locked &&
          !object.hidden &&
          boundsIntersect(objectBounds(object), rect),
      )
      .map((object) => object.id);
    const next = action.additive
      ? [...new Set([...selectedIds, ...inside])]
      : inside;
    onSelectIds(next);
    if (next.length !== 1) onAnchorSelection(null);
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
    if (!action) return;

    if (action.type === "draw") {
      const finished = draftRef.current;
      setLiveDraft(null);
      if (finished && !isDegenerate(finished)) onDraw(finished);
      return;
    }
    if (action.type === "marquee") {
      setMarquee(null);
      const svg = svgRef.current;
      const end = svg
        ? clientToUser(svg, event.clientX, event.clientY)
        : action.start;
      applyMarquee(action, end);
      return;
    }
    if (action.type === "pen-place") {
      return;
    }
    if (action.type !== "pan") {
      onTransformEnd();
    }
  }

  // Direct tool double-click: convert a shape to a path, or insert an anchor
  // on the nearest segment of the selected path.
  function handleDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (tool === "pen") {
      finishPen(false);
      return;
    }
    // Double-click with the black arrow drops into text editing.
    if (tool === "select") {
      const objectId = (event.target as Element)
        .closest("[data-object-id]")
        ?.getAttribute("data-object-id");
      const hit = objectId
        ? doc.objects.find((object) => object.id === objectId)
        : undefined;
      if (hit && hit.kind === "text" && !hit.locked) {
        onSelectIds([hit.id]);
        openTextEditorFor(hit);
      }
      return;
    }
    if (tool !== "direct") return;
    const svg = svgRef.current;
    if (!svg) return;
    const target = event.target as Element;
    if (target.closest("[data-anchor-index]")) return;

    const objectId = target
      .closest("[data-object-id]")
      ?.getAttribute("data-object-id");
    if (!objectId) return;
    const hit = doc.objects.find((object) => object.id === objectId);
    if (!hit || hit.locked) return;

    if (hit.kind !== "path") {
      onConvertToPath(hit.id);
      return;
    }

    const point = clientToUser(svg, event.clientX, event.clientY);
    const local = toFrameLocal(point, frameFor(hit));
    const nearest = nearestOnPath(hit.anchors, hit.closed, local);
    const threshold = SEGMENT_HIT_PX / scale;
    if (!nearest || nearest.distSq > threshold * threshold) return;
    const anchors = insertAnchor(
      hit.anchors,
      hit.closed,
      nearest.segmentIndex,
      nearest.t,
    );
    onEditPath(withAnchors(hit, anchors));
    onAnchorSelection({ objectId: hit.id, indices: [nearest.segmentIndex + 1] });
    onTransformEnd();
  }

  const zoomPct = Math.round(scale * 100);
  const darkArtboard = useMemo(
    () => isArtboardDark(doc.background),
    [doc.background],
  );
  const marqueeRect = marquee ? normalizedRect(marquee.start, marquee.current) : null;
  const anchorIndices =
    selectedPath && anchorSelection?.objectId === selectedPath.id
      ? anchorSelection.indices
      : [];

  return (
    <div
      className={
        darkArtboard
          ? "vector-editor-stage is-dark-artboard"
          : "vector-editor-stage"
      }
    >
      <svg
        ref={svgRef}
        className={
          tool === "text"
            ? "vector-editor-surface is-texting"
            : drawing
              ? "vector-editor-surface is-drawing"
              : "vector-editor-surface"
        }
        width="100%"
        height="100%"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="Vector artboard"
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <rect
          className="vector-editor-artboard-bg"
          x={0}
          y={0}
          width={doc.width}
          height={doc.height}
          fill={doc.background ?? "transparent"}
        />
        {doc.objects.map((object) =>
          // The object being text-edited hides behind its live overlay.
          textEdit?.id === object.id ? null : (
            <ShapeElement key={object.id} object={object} scale={scale} />
          ),
        )}
        {draft ? <ShapeElement object={draft} scale={scale} /> : null}
        {tool === "select" && selectedObjects.length > 0
          ? selectedObjects
              .filter((object) => !object.hidden)
              .map((object) => (
                <SelectionOverlay
                  key={object.id}
                  object={object}
                  scale={scale}
                  withHandles={selectedObjects.length === 1}
                />
              ))
          : null}
        {tool === "direct" && soleSelected && !soleSelected.hidden ? (
          selectedPath ? (
            <AnchorOverlay
              object={selectedPath}
              selectedIndices={anchorIndices}
              scale={scale}
            />
          ) : (
            <SelectionOverlay
              object={soleSelected}
              scale={scale}
              withHandles={false}
            />
          )
        ) : null}
        {penAnchors ? (
          <PenPreview anchors={penAnchors} hover={penHover} scale={scale} />
        ) : null}
        {marqueeRect ? (
          <rect
            className="ve-marquee"
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
          />
        ) : null}
      </svg>

      {textEdit ? (
        <textarea
          ref={textEditRef}
          className="ve-text-editor"
          style={{
            fontFamily: fontCss(textEdit.fontFamily),
            fontWeight: textEdit.bold ? 700 : 400,
            fontStyle: textEdit.italic ? "italic" : "normal",
            lineHeight: TEXT_LINE_HEIGHT,
            color: textEdit.color,
          }}
          value={textEdit.value}
          maxLength={MAX_TEXT_LENGTH}
          rows={Math.max(1, textEdit.value.split("\n").length)}
          cols={Math.max(4, ...textEdit.value.split("\n").map((l) => l.length + 2))}
          aria-label="Text content"
          onChange={(event) =>
            setTextEdit({ ...textEdit, value: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              commitTextEdit();
            } else if (event.key === "Escape") {
              event.stopPropagation();
              cancelTextEdit();
            }
          }}
          onBlur={commitTextEdit}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : null}

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
