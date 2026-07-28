// Move / resize / rotate as pure functions over an object. Resize and rotate
// respect the object's own rotation: resizing anchors the opposite handle in
// world space, so a rotated shape doesn't drift as you drag it. All angles are
// degrees clockwise, matching the model's `rotation` field.

import { fitAnchors, translateAnchors } from "@/lib/vector-editor/bezier";
import { objectBounds, type Bounds } from "@/lib/vector-editor/geometry";
import type { Point, VectorObject } from "@/lib/vector-editor/types";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const RESIZE_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

function toBounds(x: number, y: number, w: number, h: number): Bounds {
  return { x, y, width: w, height: h, cx: x + w / 2, cy: y + h / 2 };
}

export function rotatePoint(
  point: Point,
  cx: number,
  cy: number,
  degrees: number,
): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - cx;
  const dy = point.y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// A world point expressed in the object's own unrotated frame.
export function toLocalPoint(
  point: Point,
  cx: number,
  cy: number,
  rotation: number,
): Point {
  return rotatePoint(point, cx, cy, -rotation);
}

export function translateObject(
  object: VectorObject,
  dx: number,
  dy: number,
): VectorObject {
  switch (object.kind) {
    case "rect":
      return { ...object, x: object.x + dx, y: object.y + dy };
    case "ellipse":
      return { ...object, cx: object.cx + dx, cy: object.cy + dy };
    case "line":
      return {
        ...object,
        x1: object.x1 + dx,
        y1: object.y1 + dy,
        x2: object.x2 + dx,
        y2: object.y2 + dy,
      };
    case "polygon":
      return {
        ...object,
        points: object.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    case "path":
      return { ...object, anchors: translateAnchors(object.anchors, dx, dy) };
  }
}

// Remap an object's geometry so its local bounding box becomes `to`.
export function fitObjectToBounds(
  object: VectorObject,
  to: Bounds,
): VectorObject {
  const from = objectBounds(object);
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  const mapX = (x: number) => to.x + (x - from.x) * sx;
  const mapY = (y: number) => to.y + (y - from.y) * sy;

  switch (object.kind) {
    case "rect":
      return {
        ...object,
        x: to.x,
        y: to.y,
        width: to.width,
        height: to.height,
      };
    case "ellipse":
      return {
        ...object,
        cx: to.cx,
        cy: to.cy,
        rx: to.width / 2,
        ry: to.height / 2,
      };
    case "line":
      return {
        ...object,
        x1: mapX(object.x1),
        y1: mapY(object.y1),
        x2: mapX(object.x2),
        y2: mapY(object.y2),
      };
    case "polygon":
      return {
        ...object,
        points: object.points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) })),
      };
    case "path":
      return { ...object, anchors: fitAnchors(object.anchors, from, to) };
  }
}

// The fixed point of a resize: the handle opposite the one being dragged.
function anchorFor(handle: ResizeHandle, bounds: Bounds): Point {
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const x = handle.includes("w") ? right : handle.includes("e") ? left : bounds.cx;
  const y = handle.includes("n") ? bottom : handle.includes("s") ? top : bounds.cy;
  return { x, y };
}

function resizedBounds(
  handle: ResizeHandle,
  start: Bounds,
  local: Point,
): Bounds {
  let left = start.x;
  let right = start.x + start.width;
  let top = start.y;
  let bottom = start.y + start.height;
  if (handle.includes("w")) left = local.x;
  if (handle.includes("e")) right = local.x;
  if (handle.includes("n")) top = local.y;
  if (handle.includes("s")) bottom = local.y;
  return toBounds(
    Math.min(left, right),
    Math.min(top, bottom),
    Math.abs(right - left),
    Math.abs(bottom - top),
  );
}

export function resizeObject(
  object: VectorObject,
  handle: ResizeHandle,
  worldPointer: Point,
): VectorObject {
  const start = objectBounds(object);
  const { rotation } = object;
  const anchorWorld = rotatePoint(
    anchorFor(handle, start),
    start.cx,
    start.cy,
    rotation,
  );
  const local = toLocalPoint(worldPointer, start.cx, start.cy, rotation);
  const next = resizedBounds(handle, start, local);
  const resized = fitObjectToBounds(object, next);
  const anchorAfter = rotatePoint(
    anchorFor(handle, next),
    next.cx,
    next.cy,
    rotation,
  );
  return translateObject(
    resized,
    anchorWorld.x - anchorAfter.x,
    anchorWorld.y - anchorAfter.y,
  );
}

export function rotateObject(
  object: VectorObject,
  worldPointer: Point,
  snap: boolean,
): VectorObject {
  const bounds = objectBounds(object);
  // The rotate handle sits above the object, so a pointer directly above the
  // center reads as 0°.
  let degrees =
    (Math.atan2(worldPointer.y - bounds.cy, worldPointer.x - bounds.cx) * 180) /
      Math.PI +
    90;
  if (snap) degrees = Math.round(degrees / 15) * 15;
  return { ...object, rotation: ((degrees % 360) + 360) % 360 };
}
