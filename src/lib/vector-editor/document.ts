// The document service: pure, immutable operations over a VectorDocument.
// Components call these and set the returned document; nothing here reaches for
// React or the DOM. Shapes are built from two drag points (start + current), so
// the same functions drive both the initial draw and live resizing.

import { objectBounds, regularPolygonPoints } from "@/lib/vector-editor/geometry";
import type {
  Paint,
  Point,
  Stroke,
  VectorDocument,
  VectorObject,
  VectorObjectId,
  VectorShapeKind,
} from "@/lib/vector-editor/types";

// Document colors are artwork data, not UI theme — a shape stays this color in
// both light and dark. A mid slate reads on the white artboard; lines default
// to a near-black stroke since they have no fill.
const DEFAULT_FILL: Paint = { color: "#64748b", opacity: 1 };
const DEFAULT_STROKE: Stroke = { color: "#0f172a", width: 2, opacity: 1 };

const POLYGON_SIDES = 5;

const SHAPE_LABEL: Record<VectorShapeKind, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  polygon: "Polygon",
};

function newId(): VectorObjectId {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function nameFor(kind: VectorShapeKind, existing: VectorObject[]): string {
  const count = existing.filter((object) => object.kind === kind).length + 1;
  return `${SHAPE_LABEL[kind]} ${count}`;
}

// Rebuild an object's geometry from two points, preserving id, name, and style.
// Used every pointermove while drawing, and (Phase 3) while resizing.
export function resizeShape(
  object: VectorObject,
  start: Point,
  current: Point,
): VectorObject {
  const cx = (start.x + current.x) / 2;
  const cy = (start.y + current.y) / 2;
  const halfW = Math.abs(current.x - start.x) / 2;
  const halfH = Math.abs(current.y - start.y) / 2;

  switch (object.kind) {
    case "rect":
      return {
        ...object,
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      };
    case "ellipse":
      return { ...object, cx, cy, rx: halfW, ry: halfH };
    case "line":
      return {
        ...object,
        x1: start.x,
        y1: start.y,
        x2: current.x,
        y2: current.y,
      };
    case "polygon":
      return {
        ...object,
        points: regularPolygonPoints(
          cx,
          cy,
          halfW,
          halfH,
          object.points.length || POLYGON_SIDES,
        ),
      };
    // Paths are built by the pen, never by a two-point drag.
    case "path":
      return object;
  }
}

export function createShape(
  kind: VectorShapeKind,
  start: Point,
  current: Point,
  existing: VectorObject[],
): VectorObject {
  const base = {
    id: newId(),
    name: nameFor(kind, existing),
    opacity: 1,
    rotation: 0,
    locked: false,
    hidden: false,
  } as const;

  switch (kind) {
    case "rect":
      return resizeShape(
        {
          ...base,
          kind,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          radius: 0,
          fill: { ...DEFAULT_FILL },
          stroke: null,
        },
        start,
        current,
      );
    case "ellipse":
      return resizeShape(
        {
          ...base,
          kind,
          cx: 0,
          cy: 0,
          rx: 0,
          ry: 0,
          fill: { ...DEFAULT_FILL },
          stroke: null,
        },
        start,
        current,
      );
    case "line":
      return resizeShape(
        {
          ...base,
          kind,
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          fill: null,
          stroke: { ...DEFAULT_STROKE },
        },
        start,
        current,
      );
    case "polygon":
      return resizeShape(
        {
          ...base,
          kind,
          points: regularPolygonPoints(0, 0, 0, 0, POLYGON_SIDES),
          fill: { ...DEFAULT_FILL },
          stroke: null,
        },
        start,
        current,
      );
  }
}

// A shape barely larger than a click — discard it rather than litter the
// document with zero-size objects.
export function isDegenerate(object: VectorObject): boolean {
  if (object.kind === "line") {
    return Math.hypot(object.x2 - object.x1, object.y2 - object.y1) < 1.5;
  }
  if (object.kind === "path" && object.anchors.length < 2) {
    return true;
  }
  const box = objectBounds(object);
  return box.width < 1.5 && box.height < 1.5;
}

export function addObject(
  document: VectorDocument,
  object: VectorObject,
): VectorDocument {
  return { ...document, objects: [...document.objects, object] };
}

export function removeObject(
  document: VectorDocument,
  id: VectorObjectId,
): VectorDocument {
  return {
    ...document,
    objects: document.objects.filter((object) => object.id !== id),
  };
}

export function updateObject(
  document: VectorDocument,
  id: VectorObjectId,
  update: (object: VectorObject) => VectorObject,
): VectorDocument {
  return {
    ...document,
    objects: document.objects.map((object) =>
      object.id === id ? update(object) : object,
    ),
  };
}

// Fields every object shares — safe to patch across the union without touching
// a shape's geometry.
export type ObjectPatch = Partial<
  Pick<
    VectorObject,
    "name" | "fill" | "stroke" | "opacity" | "rotation" | "locked" | "hidden"
  >
>;

export function patchObject(
  document: VectorDocument,
  id: VectorObjectId,
  patch: ObjectPatch,
): VectorDocument {
  return updateObject(
    document,
    id,
    (object) => ({ ...object, ...patch }) as VectorObject,
  );
}

// Move an object `delta` positions in z-order (array order; last = top).
export function moveObject(
  document: VectorDocument,
  id: VectorObjectId,
  delta: number,
): VectorDocument {
  const index = document.objects.findIndex((object) => object.id === id);
  if (index === -1) return document;
  const target = Math.max(
    0,
    Math.min(document.objects.length - 1, index + delta),
  );
  if (target === index) return document;
  const objects = [...document.objects];
  const [moved] = objects.splice(index, 1);
  objects.splice(target, 0, moved);
  return { ...document, objects };
}
