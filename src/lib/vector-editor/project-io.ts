// localStorage persistence for the vector document. Every read is a trust
// boundary (docs/ARCHITECTURE.md §6, STANDARDS §2.3): the stored JSON is
// validated field by field before use, never bare-cast, and a corrupt object
// is dropped rather than allowed to crash the editor.

import type {
  Paint,
  Point,
  Stroke,
  VectorDocument,
  VectorObject,
} from "@/lib/vector-editor/types";

const DOC_KEY = "digitools.vector-editor.doc-v1";
const SAVED_AT_KEY = "digitools.vector-editor.saved-at-v1";
const SIZE_BUDGET = 4_000_000; // bytes; SVG docs are tiny, this only guards runaway data

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// Validated sizes are kept finite and sane. A tampered width/height feeds the
// PNG canvas allocation directly, so clamp rather than trust the stored number.
const MAX_DIMENSION = 20000;
function clampSize(value: number, min = 0): number {
  return Math.min(MAX_DIMENSION, Math.max(min, value));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

// Accept only the color syntaxes the pickers actually produce, so a tampered
// store can't smuggle an exotic value into the document (and thence into the
// string-built SVG export).
const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$|^rgba?\([0-9.,%\s]+\)$|^[a-zA-Z]{1,32}$/;

function safeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SAFE_COLOR.test(trimmed) ? trimmed : null;
}

function validatePaint(value: unknown): Paint | null {
  const object = record(value);
  const color = object ? safeColor(object.color) : null;
  if (!object || !color) return null;
  return {
    color,
    opacity: isNumber(object.opacity) ? clamp01(object.opacity) : 1,
  };
}

function validateStroke(value: unknown): Stroke | null {
  const paint = validatePaint(value);
  const object = record(value);
  if (!paint || !object || !isNumber(object.width)) return null;
  return { ...paint, width: Math.max(0, object.width) };
}

function validatePoint(value: unknown): Point | null {
  const object = record(value);
  if (!object || !isNumber(object.x) || !isNumber(object.y)) return null;
  return { x: object.x, y: object.y };
}

function validateObject(value: unknown): VectorObject | null {
  const object = record(value);
  if (!object || typeof object.id !== "string") return null;
  const { kind } = object;
  if (kind !== "rect" && kind !== "ellipse" && kind !== "line" && kind !== "polygon") {
    return null;
  }

  const base = {
    id: object.id,
    name: typeof object.name === "string" ? object.name : "Object",
    opacity: isNumber(object.opacity) ? clamp01(object.opacity) : 1,
    rotation: isNumber(object.rotation) ? object.rotation : 0,
    locked: object.locked === true,
    hidden: object.hidden === true,
    fill: validatePaint(object.fill),
    stroke: validateStroke(object.stroke),
  };

  switch (kind) {
    case "rect":
      if (
        !isNumber(object.x) ||
        !isNumber(object.y) ||
        !isNumber(object.width) ||
        !isNumber(object.height)
      ) {
        return null;
      }
      return {
        ...base,
        kind,
        x: object.x,
        y: object.y,
        width: clampSize(object.width),
        height: clampSize(object.height),
        radius: isNumber(object.radius) ? Math.max(0, object.radius) : 0,
      };
    case "ellipse":
      if (
        !isNumber(object.cx) ||
        !isNumber(object.cy) ||
        !isNumber(object.rx) ||
        !isNumber(object.ry)
      ) {
        return null;
      }
      return {
        ...base,
        kind,
        cx: object.cx,
        cy: object.cy,
        rx: clampSize(object.rx),
        ry: clampSize(object.ry),
      };
    case "line":
      if (
        !isNumber(object.x1) ||
        !isNumber(object.y1) ||
        !isNumber(object.x2) ||
        !isNumber(object.y2)
      ) {
        return null;
      }
      return {
        ...base,
        kind,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2,
      };
    case "polygon": {
      if (!Array.isArray(object.points)) return null;
      const points = object.points
        .map(validatePoint)
        .filter((point): point is Point => point !== null);
      if (points.length < 3) return null;
      return { ...base, kind, points };
    }
  }
}

function validateDocument(value: unknown): VectorDocument | null {
  const object = record(value);
  if (!object || !isNumber(object.width) || !isNumber(object.height)) return null;
  if (!Array.isArray(object.objects)) return null;
  const objects = object.objects
    .map(validateObject)
    .filter((item): item is VectorObject => item !== null);
  const background =
    object.background === null ? null : (safeColor(object.background) ?? "#ffffff");
  return {
    width: clampSize(object.width, 1),
    height: clampSize(object.height, 1),
    background,
    objects,
  };
}

export function saveProject(
  document: VectorDocument,
  savedAt: Date,
): "saved" | "large" {
  const json = JSON.stringify(document);
  if (json.length > SIZE_BUDGET) return "large";
  localStorage.setItem(DOC_KEY, json);
  localStorage.setItem(SAVED_AT_KEY, savedAt.toISOString());
  return "saved";
}

export function loadProject(): {
  doc: VectorDocument;
  savedAt: Date | null;
} | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DOC_KEY);
  } catch {
    return null;
  }
  if (!raw || raw.length > SIZE_BUDGET) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const doc = validateDocument(parsed);
  if (!doc) return null;

  let savedAt: Date | null = null;
  try {
    const stored = localStorage.getItem(SAVED_AT_KEY);
    if (stored) {
      const date = new Date(stored);
      if (!Number.isNaN(date.getTime())) savedAt = date;
    }
  } catch {
    savedAt = null;
  }

  return { doc, savedAt };
}
