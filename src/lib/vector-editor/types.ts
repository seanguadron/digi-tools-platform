// The vector document is a native SVG scene graph: an ordered list of objects
// where array order IS z-order (index 0 = bottom, last = top). Each object stays
// SEMANTIC — a rect keeps x/y/width/height, an ellipse keeps cx/cy/rx/ry — so
// exporting is the live document with zero conversion (the whole point of the
// native-SVG choice). Rotation is a single field (degrees clockwise about the
// object's bbox center), applied as an SVG transform at render time; move and
// resize edit the geometry directly rather than accumulating a matrix, which
// keeps the model readable and the export clean.

import type { Anchor, AnchorKind } from "./bezier";
import { DEFAULT_DOC_PPI, type DocUnit } from "@/lib/units";

export type VectorObjectId = string;

// The four drag-to-draw shape kinds. Paths are a fifth OBJECT kind but not a
// drag shape — the pen builds them anchor by anchor.
export type VectorShapeKind = "rect" | "ellipse" | "line" | "polygon";

export type VectorObjectKind = VectorShapeKind | "path" | "text";

export interface Point {
  x: number;
  y: number;
}

// A path anchor IS the bezier module's Anchor: a point, two optional handle
// OFFSETS, and its type (corner | smooth | broken | auto).
export type PathAnchor = Anchor;
export type AnchorType = AnchorKind;

export interface Paint {
  color: string; // any CSS color string
  opacity: number; // 0..1
}

export interface Stroke extends Paint {
  width: number; // user units
}

interface VectorObjectBase {
  id: VectorObjectId;
  kind: VectorObjectKind;
  name: string;
  fill: Paint | null; // null = no fill
  stroke: Stroke | null; // null = no stroke
  opacity: number; // whole-object opacity, 0..1
  rotation: number; // degrees clockwise, about the bbox center
  locked: boolean;
  hidden: boolean;
}

export interface RectObject extends VectorObjectBase {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number; // corner radius, user units
}

export interface EllipseObject extends VectorObjectBase {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LineObject extends VectorObjectBase {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PolygonObject extends VectorObjectBase {
  kind: "polygon";
  points: Point[];
}

export interface PathObject extends VectorObjectBase {
  kind: "path";
  anchors: PathAnchor[];
  closed: boolean;
}

// Point text. x/y is the TOP-LEFT of the text block (baselines derive from
// TEXT_ASCENT/TEXT_LINE_HEIGHT in text.ts); width/height are the measured
// extents, stamped by text-measure.ts whenever content or font changes, so
// pure geometry never needs the DOM.
export interface TextObject extends VectorObjectBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontFamily: string; // a catalog NAME from text.ts, never a free string
  fontSize: number; // user units
  bold: boolean;
  italic: boolean;
  width: number;
  height: number;
}

export type VectorObject =
  | RectObject
  | EllipseObject
  | LineObject
  | PolygonObject
  | PathObject
  | TextObject;

export interface VectorDocument {
  width: number; // artboard size, px (the master unit)
  height: number;
  background: string | null; // artboard fill; null = transparent
  // Physical-unit view: the unit panels/status/exports display in, and the
  // PPI that maps px to it (src/lib/units).
  unit: DocUnit;
  ppi: number;
  objects: VectorObject[];
}

export const DEFAULT_ARTBOARD = { width: 960, height: 600 } as const;

export function createEmptyDocument(
  width: number = DEFAULT_ARTBOARD.width,
  height: number = DEFAULT_ARTBOARD.height,
): VectorDocument {
  return {
    width,
    height,
    background: "#ffffff",
    unit: "px",
    ppi: DEFAULT_DOC_PPI,
    objects: [],
  };
}
