// Browser-only text measurement for TextObject bounds. The pure geometry
// module cannot touch the DOM, so measured extents are STAMPED onto the
// object (width/height fields) whenever its content or font changes;
// objectBounds just reads them.

import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  fontCss,
  sanitizeText,
  TEXT_LINE_HEIGHT,
  textLines,
} from "@/lib/vector-editor/text";
import type { TextObject, VectorObject } from "@/lib/vector-editor/types";

let scratch: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D | null {
  if (scratch) return scratch;
  if (typeof document === "undefined") return null;
  scratch = document.createElement("canvas").getContext("2d");
  return scratch;
}

// Measured extents for the object's current text + font. Falls back to a
// character-count estimate when no canvas is available (SSR safety; the
// client re-measures on the next edit).
export function measureText(
  object: Pick<
    TextObject,
    "text" | "fontFamily" | "fontSize" | "bold" | "italic"
  >,
): { width: number; height: number } {
  const lines = textLines(object.text);
  const height = Math.max(
    object.fontSize,
    lines.length * object.fontSize * TEXT_LINE_HEIGHT,
  );
  const ctx = context();
  if (!ctx) {
    const longest = Math.max(...lines.map((line) => line.length), 1);
    return { width: longest * object.fontSize * 0.6, height };
  }
  ctx.font = `${object.italic ? "italic " : ""}${object.bold ? "700 " : "400 "}${object.fontSize}px ${fontCss(object.fontFamily)}`;
  const width = Math.max(
    1,
    ...lines.map((line) => ctx.measureText(line || " ").width),
  );
  return { width, height };
}

// A text object with sanitized content and freshly measured extents. Every
// mutator (create, overlay commit, panel edit) funnels through here, so the
// length cap and control-character strip hold on EVERY write, not just load.
export function withMeasuredText(object: TextObject): TextObject {
  const text = sanitizeText(object.text);
  const { width, height } = measureText({ ...object, text });
  return { ...object, text, width, height };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// A freshly typed text block, dark fill like the line tool's default stroke.
export function createTextObject(
  x: number,
  y: number,
  text: string,
  existing: VectorObject[],
): TextObject {
  const count = existing.filter((object) => object.kind === "text").length + 1;
  return withMeasuredText({
    id: newId(),
    kind: "text",
    name: `Text ${count}`,
    fill: { color: "#0f172a", opacity: 1 },
    stroke: null,
    opacity: 1,
    rotation: 0,
    locked: false,
    hidden: false,
    x,
    y,
    text: sanitizeText(text),
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    bold: false,
    italic: false,
    width: 1,
    height: 1,
  });
}
