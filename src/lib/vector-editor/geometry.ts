// Pure geometry for the vector document. No React, no DOM — just math over the
// scene-graph model, so it stays testable and shared between rendering,
// interaction, and (later) selection/transform.

import { pathBounds } from "@/lib/vector-editor/bezier";
import type { Point, VectorObject } from "@/lib/vector-editor/types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number; // center, used as the rotation pivot
  cy: number;
}

function bounds(x: number, y: number, width: number, height: number): Bounds {
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

// The object's axis-aligned bounding box in artboard coordinates, BEFORE its
// own rotation is applied. Its center is the pivot the render transform rotates
// about, and (later) the frame the selection handles hang off.
export function objectBounds(object: VectorObject): Bounds {
  switch (object.kind) {
    case "rect":
      return bounds(object.x, object.y, object.width, object.height);
    case "ellipse":
      return bounds(
        object.cx - object.rx,
        object.cy - object.ry,
        object.rx * 2,
        object.ry * 2,
      );
    case "line":
      return bounds(
        Math.min(object.x1, object.x2),
        Math.min(object.y1, object.y2),
        Math.abs(object.x2 - object.x1),
        Math.abs(object.y2 - object.y1),
      );
    case "polygon": {
      if (object.points.length === 0) return bounds(0, 0, 0, 0);
      const xs = object.points.map((p) => p.x);
      const ys = object.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return bounds(minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY);
    }
    case "path": {
      const box = pathBounds(object.anchors, object.closed);
      return bounds(box.x, box.y, box.width, box.height);
    }
    // Text extents are measured in the component layer and stamped on the
    // object, so pure geometry just reads them.
    case "text":
      return bounds(object.x, object.y, object.width, object.height);
  }
}

// A regular polygon inscribed in the given ellipse (rx/ry), first vertex at the
// top. Drawn from the drag's bounding box, so dragging a wide box yields a wide
// polygon — the same feel as the other shape tools.
export function regularPolygonPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
): Point[] {
  const count = Math.max(3, Math.round(sides));
  const points: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return points;
}
