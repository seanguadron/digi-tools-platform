// Path-object helpers: creating paths from the pen, converting the four
// shape kinds into editable paths, and applying anchor-level edits. The
// bezier math itself lives in bezier.ts (alias-free, unit-tested); this
// module binds it to the document model.

import {
  recomputeAutoHandles,
  type Anchor,
} from "@/lib/vector-editor/bezier";
import { regularPolygonPoints } from "@/lib/vector-editor/geometry";
import type {
  PathObject,
  Stroke,
  TextObject,
  VectorObject,
} from "@/lib/vector-editor/types";

// Matches document.ts's line default: pen paths start stroke-only.
const DEFAULT_PATH_STROKE: Stroke = { color: "#0f172a", width: 2, opacity: 1 };

// Circle-from-cubics constant: handle length as a fraction of the radius.
const KAPPA = 0.5522847498307936;

function corner(x: number, y: number): Anchor {
  return { point: { x, y }, handleIn: null, handleOut: null, type: "corner" };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function pathName(existing: VectorObject[]): string {
  const count = existing.filter((object) => object.kind === "path").length + 1;
  return `Path ${count}`;
}

// A finished pen drawing becomes a first-class object.
export function createPathObject(
  anchors: Anchor[],
  closed: boolean,
  existing: VectorObject[],
): PathObject {
  return {
    id: newId(),
    kind: "path",
    name: pathName(existing),
    fill: null,
    stroke: { ...DEFAULT_PATH_STROKE },
    opacity: 1,
    rotation: 0,
    locked: false,
    hidden: false,
    anchors: recomputeAutoHandles(anchors, closed),
    closed,
  };
}

// Text-to-outlines needs real glyph geometry — out of scope, so text is not
// convertible (roadmap "Later").
export function isConvertibleToPath(
  object: VectorObject,
): object is Exclude<VectorObject, PathObject | TextObject> {
  return object.kind !== "path" && object.kind !== "text";
}

// Convert any shape into an equivalent path — same id, name, style, and
// rotation, so selection and history stay coherent. The outline is exact
// for straight-edged shapes and the standard kappa approximation for
// rounded ones. Paths and text pass through unchanged.
export function convertToPath(object: VectorObject): VectorObject {
  if (object.kind === "path" || object.kind === "text") return object;

  const base = {
    id: object.id,
    kind: "path" as const,
    name: object.name,
    fill: object.fill,
    stroke: object.stroke,
    opacity: object.opacity,
    rotation: object.rotation,
    locked: object.locked,
    hidden: object.hidden,
  };

  switch (object.kind) {
    case "rect": {
      const { x, y, width, height } = object;
      const radius = Math.min(object.radius, width / 2, height / 2);
      if (radius <= 0) {
        return {
          ...base,
          anchors: [
            corner(x, y),
            corner(x + width, y),
            corner(x + width, y + height),
            corner(x, y + height),
          ],
          closed: true,
        };
      }
      // Eight anchors: two per corner arc, kappa handles curving the corner.
      const k = radius * KAPPA;
      const right = x + width;
      const bottom = y + height;
      const arc = (
        px: number,
        py: number,
        handleIn: { x: number; y: number } | null,
        handleOut: { x: number; y: number } | null,
      ): Anchor => ({
        point: { x: px, y: py },
        handleIn,
        handleOut,
        type: "broken",
      });
      return {
        ...base,
        anchors: [
          arc(x + radius, y, { x: -k, y: 0 }, null),
          arc(right - radius, y, null, { x: k, y: 0 }),
          arc(right, y + radius, { x: 0, y: -k }, null),
          arc(right, bottom - radius, null, { x: 0, y: k }),
          arc(right - radius, bottom, { x: k, y: 0 }, null),
          arc(x + radius, bottom, null, { x: -k, y: 0 }),
          arc(x, bottom - radius, { x: 0, y: k }, null),
          arc(x, y + radius, null, { x: 0, y: -k }),
        ],
        closed: true,
      };
    }
    case "ellipse": {
      const { cx, cy, rx, ry } = object;
      const kx = rx * KAPPA;
      const ky = ry * KAPPA;
      const smooth = (
        px: number,
        py: number,
        hx: number,
        hy: number,
      ): Anchor => ({
        point: { x: px, y: py },
        handleIn: { x: -hx, y: -hy },
        handleOut: { x: hx, y: hy },
        type: "smooth",
      });
      return {
        ...base,
        anchors: [
          smooth(cx, cy - ry, kx, 0),
          smooth(cx + rx, cy, 0, ky),
          smooth(cx, cy + ry, -kx, 0),
          smooth(cx - rx, cy, 0, -ky),
        ],
        closed: true,
      };
    }
    case "line":
      return {
        ...base,
        anchors: [corner(object.x1, object.y1), corner(object.x2, object.y2)],
        closed: false,
      };
    case "polygon": {
      const points =
        object.points.length >= 3
          ? object.points
          : regularPolygonPoints(0, 0, 40, 40, 3);
      return {
        ...base,
        anchors: points.map((point) => corner(point.x, point.y)),
        closed: true,
      };
    }
  }
}

// Replace a path's anchors (already edited by a bezier.ts operation),
// keeping auto anchors consistent with their new neighbors.
export function withAnchors(
  object: PathObject,
  anchors: Anchor[],
  closed: boolean = object.closed,
): PathObject {
  return { ...object, anchors: recomputeAutoHandles(anchors, closed), closed };
}

// Minimum viable path: an open path needs 2 anchors, a closed one 3.
export function minAnchorCount(closed: boolean): number {
  return closed ? 3 : 2;
}
