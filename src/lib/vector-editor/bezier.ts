// Pure cubic-bezier path math. Deliberately self-contained — no imports at
// all — so the node test runner can load it directly (scripts/*.test.mjs
// cannot resolve `@/` value imports). The editor's PathAnchor type in
// types.ts is this module's Anchor, re-exported type-only.
//
// Anchors store handles as OFFSETS from the anchor point (never absolute):
// translating a path moves only the points, and mirroring a handle is a
// negation. A null handle means "no handle on this side" — a segment whose
// facing handles are both null renders as a straight line.

export interface Vec {
  x: number;
  y: number;
}

export type AnchorKind = "corner" | "smooth" | "broken" | "auto";

export interface Anchor {
  point: Vec;
  handleIn: Vec | null; // offset from point
  handleOut: Vec | null; // offset from point
  type: AnchorKind;
}

export interface CubicSegment {
  p0: Vec;
  c1: Vec;
  c2: Vec;
  p1: Vec;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function length(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

export function segmentIsLine(segment: CubicSegment): boolean {
  return (
    segment.c1.x === segment.p0.x &&
    segment.c1.y === segment.p0.y &&
    segment.c2.x === segment.p1.x &&
    segment.c2.y === segment.p1.y
  );
}

// The cubic segments a run of anchors describes. A null handle contributes
// its anchor point as the control point, which degenerates cleanly to a line.
export function pathSegments(
  anchors: readonly Anchor[],
  closed: boolean,
): CubicSegment[] {
  if (anchors.length < 2) return [];
  const count = closed ? anchors.length : anchors.length - 1;
  const segments: CubicSegment[] = [];
  for (let i = 0; i < count; i += 1) {
    const from = anchors[i];
    const to = anchors[(i + 1) % anchors.length];
    segments.push({
      p0: from.point,
      c1: from.handleOut ? add(from.point, from.handleOut) : from.point,
      c2: to.handleIn ? add(to.point, to.handleIn) : to.point,
      p1: to.point,
    });
  }
  return segments;
}

export function cubicPointAt(segment: CubicSegment, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x:
      a * segment.p0.x + b * segment.c1.x + c * segment.c2.x + d * segment.p1.x,
    y:
      a * segment.p0.y + b * segment.c1.y + c * segment.c2.y + d * segment.p1.y,
  };
}

// Interior extrema of one cubic axis: roots of the derivative in (0, 1).
function derivativeRoots(p0: number, c1: number, c2: number, p1: number): number[] {
  const a = 3 * (-p0 + 3 * c1 - 3 * c2 + p1);
  const b = 6 * (p0 - 2 * c1 + c2);
  const c = 3 * (c1 - p0);
  const roots: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      roots.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
    }
  }
  return roots.filter((t) => t > 0 && t < 1);
}

export function cubicBounds(segment: CubicSegment): RectBounds {
  const ts = [0, 1]
    .concat(derivativeRoots(segment.p0.x, segment.c1.x, segment.c2.x, segment.p1.x))
    .concat(derivativeRoots(segment.p0.y, segment.c1.y, segment.c2.y, segment.p1.y));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of ts) {
    const p = cubicPointAt(segment, t);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// True curve bounds (not the control hull). A single anchor degenerates to a
// point-sized box so callers never divide by a missing rect.
export function pathBounds(
  anchors: readonly Anchor[],
  closed: boolean,
): RectBounds {
  if (anchors.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  if (anchors.length === 1) {
    return { x: anchors[0].point.x, y: anchors[0].point.y, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const segment of pathSegments(anchors, closed)) {
    const box = cubicBounds(segment);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Finite-guarded: validated anchors are finite, but sums of two large finite
// coordinates can overflow, and "Infinity"/"NaN" must never reach a d string.
function fmt(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

// SVG path data. Straight runs emit L; anything with a live handle emits C.
// A straight closing segment is left to Z; a curved close keeps its C.
export function pathToD(anchors: readonly Anchor[], closed: boolean): string {
  if (anchors.length === 0) return "";
  const start = anchors[0].point;
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  const segments = pathSegments(anchors, closed);
  segments.forEach((segment, index) => {
    const closingLine =
      closed && index === segments.length - 1 && segmentIsLine(segment);
    if (closingLine) return;
    d += segmentIsLine(segment)
      ? ` L ${fmt(segment.p1.x)} ${fmt(segment.p1.y)}`
      : ` C ${fmt(segment.c1.x)} ${fmt(segment.c1.y)} ${fmt(segment.c2.x)} ${fmt(segment.c2.y)} ${fmt(segment.p1.x)} ${fmt(segment.p1.y)}`;
  });
  if (closed) d += " Z";
  return d;
}

// Nearest point on one segment by coarse sampling plus local ternary
// refinement — robust for hit-testing without exact root-finding.
export function nearestOnSegment(
  segment: CubicSegment,
  target: Vec,
): { t: number; distSq: number; point: Vec } {
  const SAMPLES = 25;
  let bestT = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const p = cubicPointAt(segment, t);
    const distSq = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }
  let lo = Math.max(0, bestT - 1 / SAMPLES);
  let hi = Math.min(1, bestT + 1 / SAMPLES);
  for (let i = 0; i < 24; i += 1) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const q1 = cubicPointAt(segment, m1);
    const q2 = cubicPointAt(segment, m2);
    const d1 = (q1.x - target.x) ** 2 + (q1.y - target.y) ** 2;
    const d2 = (q2.x - target.x) ** 2 + (q2.y - target.y) ** 2;
    if (d1 < d2) hi = m2;
    else lo = m1;
  }
  const t = (lo + hi) / 2;
  const point = cubicPointAt(segment, t);
  return {
    t,
    distSq: (point.x - target.x) ** 2 + (point.y - target.y) ** 2,
    point,
  };
}

export function nearestOnPath(
  anchors: readonly Anchor[],
  closed: boolean,
  target: Vec,
): { segmentIndex: number; t: number; distSq: number; point: Vec } | null {
  const segments = pathSegments(anchors, closed);
  let best: {
    segmentIndex: number;
    t: number;
    distSq: number;
    point: Vec;
  } | null = null;
  segments.forEach((segment, index) => {
    const hit = nearestOnSegment(segment, target);
    if (!best || hit.distSq < best.distSq) {
      best = { segmentIndex: index, ...hit };
    }
  });
  return best;
}

// De Casteljau split at t — the two halves reproduce the original curve.
export function splitSegment(
  segment: CubicSegment,
  t: number,
): [CubicSegment, CubicSegment] {
  const p01 = lerp(segment.p0, segment.c1, t);
  const p12 = lerp(segment.c1, segment.c2, t);
  const p23 = lerp(segment.c2, segment.p1, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const p0123 = lerp(p012, p123, t);
  return [
    { p0: segment.p0, c1: p01, c2: p012, p1: p0123 },
    { p0: p0123, c1: p123, c2: p23, p1: segment.p1 },
  ];
}

// Catmull-Rom-derived handles: an interior anchor's handles run parallel to
// the chord between its neighbors; an endpoint leans a third of the way
// toward its only neighbor.
export function autoHandles(
  prev: Vec | null,
  current: Vec,
  next: Vec | null,
): { handleIn: Vec | null; handleOut: Vec | null } {
  if (prev && next) {
    const v = { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
    return { handleIn: { x: -v.x, y: -v.y }, handleOut: v };
  }
  if (next) {
    return {
      handleIn: null,
      handleOut: { x: (next.x - current.x) / 4, y: (next.y - current.y) / 4 },
    };
  }
  if (prev) {
    return {
      handleIn: { x: (prev.x - current.x) / 4, y: (prev.y - current.y) / 4 },
      handleOut: null,
    };
  }
  return { handleIn: null, handleOut: null };
}

function neighborPoints(
  anchors: readonly Anchor[],
  index: number,
  closed: boolean,
): { prev: Vec | null; next: Vec | null } {
  const count = anchors.length;
  const prev =
    index > 0
      ? anchors[index - 1].point
      : closed && count > 2
        ? anchors[count - 1].point
        : null;
  const next =
    index < count - 1
      ? anchors[index + 1].point
      : closed && count > 2
        ? anchors[0].point
        : null;
  return { prev, next };
}

// Re-derive handles for every auto anchor (they follow their neighbors).
export function recomputeAutoHandles(
  anchors: readonly Anchor[],
  closed: boolean,
): Anchor[] {
  return anchors.map((anchor, index) => {
    if (anchor.type !== "auto") return anchor;
    const { prev, next } = neighborPoints(anchors, index, closed);
    const handles = autoHandles(prev, anchor.point, next);
    return { ...anchor, ...handles };
  });
}

// Convert one anchor to a new type, adjusting handles to match its meaning.
export function applyAnchorType(
  anchors: readonly Anchor[],
  index: number,
  type: AnchorKind,
  closed: boolean,
): Anchor[] {
  const anchor = anchors[index];
  if (!anchor) return [...anchors];
  const next = [...anchors];
  const { prev, next: nextPoint } = neighborPoints(anchors, index, closed);

  if (type === "corner") {
    next[index] = { ...anchor, type, handleIn: null, handleOut: null };
  } else if (type === "auto") {
    const handles = autoHandles(prev, anchor.point, nextPoint);
    next[index] = { ...anchor, type, ...handles };
  } else if (type === "smooth") {
    let { handleIn, handleOut } = anchor;
    if (!handleIn && !handleOut) {
      const handles = autoHandles(prev, anchor.point, nextPoint);
      handleIn = handles.handleIn;
      handleOut = handles.handleOut;
    }
    // Collinearize: keep the out direction, preserve each side's length.
    if (handleOut && handleIn) {
      const len = length(handleIn);
      const outLen = length(handleOut);
      if (outLen > 1e-9) {
        handleIn = {
          x: (-handleOut.x / outLen) * len,
          y: (-handleOut.y / outLen) * len,
        };
      }
    }
    next[index] = { ...anchor, type, handleIn, handleOut };
  } else {
    // broken: keep whatever handles exist so there is something to grab.
    let { handleIn, handleOut } = anchor;
    if (!handleIn && !handleOut) {
      const handles = autoHandles(prev, anchor.point, nextPoint);
      handleIn = handles.handleIn;
      handleOut = handles.handleOut;
    }
    next[index] = { ...anchor, type, handleIn, handleOut };
  }
  return next;
}

// Move one handle to an absolute (local-space) position. Smooth keeps the
// opposite handle collinear at its own length; `breakPair` (Alt-drag)
// detaches the pair into a broken anchor.
export function moveHandle(
  anchors: readonly Anchor[],
  index: number,
  which: "in" | "out",
  position: Vec,
  breakPair: boolean,
): Anchor[] {
  const anchor = anchors[index];
  if (!anchor) return [...anchors];
  const offset = {
    x: position.x - anchor.point.x,
    y: position.y - anchor.point.y,
  };
  const next = [...anchors];
  let type: AnchorKind = anchor.type;
  if (breakPair) type = "broken";
  else if (type === "auto" || type === "corner") type = "smooth";

  const updated: Anchor = { ...anchor, type };
  if (which === "in") updated.handleIn = offset;
  else updated.handleOut = offset;

  if (type === "smooth") {
    const oppositeKey = which === "in" ? "handleOut" : "handleIn";
    const opposite = anchor[oppositeKey];
    const len = opposite ? length(opposite) : length(offset);
    const offLen = length(offset);
    if (offLen > 1e-9) {
      updated[oppositeKey] = {
        x: (-offset.x / offLen) * len,
        y: (-offset.y / offLen) * len,
      };
    }
  }
  next[index] = updated;
  return next;
}

// Insert an anchor mid-segment without changing the drawn curve.
export function insertAnchor(
  anchors: readonly Anchor[],
  closed: boolean,
  segmentIndex: number,
  t: number,
): Anchor[] {
  const segments = pathSegments(anchors, closed);
  const segment = segments[segmentIndex];
  if (!segment) return [...anchors];
  const fromIndex = segmentIndex;
  const toIndex = (segmentIndex + 1) % anchors.length;
  const next = [...anchors];

  if (segmentIsLine(segment)) {
    next.splice(fromIndex + 1, 0, {
      point: lerp(segment.p0, segment.p1, t),
      handleIn: null,
      handleOut: null,
      type: "corner",
    });
    return next;
  }

  const [left, right] = splitSegment(segment, t);
  const from = anchors[fromIndex];
  const to = anchors[toIndex];
  next[fromIndex] = {
    ...from,
    handleOut: { x: left.c1.x - left.p0.x, y: left.c1.y - left.p0.y },
  };
  next[toIndex === 0 ? 0 : toIndex] = {
    ...to,
    handleIn: { x: right.c2.x - right.p1.x, y: right.c2.y - right.p1.y },
  };
  const inserted: Anchor = {
    point: left.p1,
    handleIn: { x: left.c2.x - left.p1.x, y: left.c2.y - left.p1.y },
    handleOut: { x: right.c1.x - right.p0.x, y: right.c1.y - right.p0.y },
    type: "smooth",
  };
  next.splice(fromIndex + 1, 0, inserted);
  return next;
}

export function removeAnchors(
  anchors: readonly Anchor[],
  indices: readonly number[],
): Anchor[] {
  const drop = new Set(indices);
  return anchors.filter((_, index) => !drop.has(index));
}

export function translateAnchors(
  anchors: readonly Anchor[],
  dx: number,
  dy: number,
): Anchor[] {
  return anchors.map((anchor) => ({
    ...anchor,
    point: { x: anchor.point.x + dx, y: anchor.point.y + dy },
  }));
}

// Remap anchors so their bounds become `to` — handle offsets scale with the
// axes so curves keep their shape.
export function fitAnchors(
  anchors: readonly Anchor[],
  from: RectBounds,
  to: RectBounds,
): Anchor[] {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  const mapPoint = (p: Vec): Vec => ({
    x: to.x + (p.x - from.x) * sx,
    y: to.y + (p.y - from.y) * sy,
  });
  const mapOffset = (v: Vec | null): Vec | null =>
    v ? { x: v.x * sx, y: v.y * sy } : null;
  return anchors.map((anchor) => ({
    ...anchor,
    point: mapPoint(anchor.point),
    handleIn: mapOffset(anchor.handleIn),
    handleOut: mapOffset(anchor.handleOut),
  }));
}
