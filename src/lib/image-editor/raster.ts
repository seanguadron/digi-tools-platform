// Low-level canvas helpers. Every function here touches the DOM/Canvas API, so
// it must only run in the browser (call from effects or event handlers, never at
// module scope or during render).

import type { BlendMode, ImageDoc, Layer, Point, Rect } from "./types";

export function createBitmap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) {
    throw new Error("2D canvas context is unavailable");
  }
  return ctx;
}

// A read-tuned context (getImageData / flood fill / filters read pixels back).
export function get2dReadable(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D canvas context is unavailable");
  }
  return ctx;
}

// A fresh copy of a bitmap — the basis of copy-on-write edits.
export function cloneBitmap(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = createBitmap(source.width, source.height);
  get2d(copy).drawImage(source, 0, 0);
  return copy;
}

// A blank transparent bitmap the size of the document.
export function blankBitmap(width: number, height: number): HTMLCanvasElement {
  return createBitmap(width, height);
}

function blendToComposite(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    default:
      return "source-over";
  }
}

// Composite every visible layer into `target` (created if omitted) at document
// resolution. If `override` is given, that layer's bitmap is swapped for the
// supplied one — used to show a live, uncommitted brush stroke.
export function composite(
  doc: ImageDoc,
  target?: HTMLCanvasElement,
  override?: { layerId: string; bitmap: HTMLCanvasElement },
): HTMLCanvasElement {
  const out = target ?? createBitmap(doc.width, doc.height);
  if (out.width !== doc.width) {
    out.width = doc.width;
  }
  if (out.height !== doc.height) {
    out.height = doc.height;
  }
  const ctx = get2d(out);
  ctx.clearRect(0, 0, out.width, out.height);
  const layers = doc.layers;
  // One scratch canvas reused across all clipping-mask layers this frame,
  // allocated lazily (most docs have none). Cleared before each reuse.
  let scratch: HTMLCanvasElement | null = null;
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    if (!layer.visible || layer.opacity <= 0) {
      continue;
    }
    const bitmapFor = (l: Layer) =>
      override && override.layerId === l.id ? override.bitmap : l.bitmap;
    let bitmap = bitmapFor(layer);
    // Clipping mask: clip this layer to the alpha of the layer below it.
    if (layer.clipped && i > 0) {
      if (!scratch) {
        scratch = createBitmap(out.width, out.height);
      }
      const cctx = get2d(scratch);
      cctx.globalCompositeOperation = "source-over";
      cctx.clearRect(0, 0, scratch.width, scratch.height);
      cctx.drawImage(bitmap, 0, 0);
      cctx.globalCompositeOperation = "destination-in";
      cctx.drawImage(bitmapFor(layers[i - 1]), 0, 0);
      cctx.globalCompositeOperation = "source-over";
      bitmap = scratch;
    }
    ctx.globalAlpha = clamp01(layer.opacity);
    ctx.globalCompositeOperation = blendToComposite(layer.blendMode);
    ctx.drawImage(bitmap, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return out;
}

// Mask `bitmap` to the alpha of `alphaSource` (used by transparency lock).
export function clipToAlpha(
  bitmap: HTMLCanvasElement,
  alphaSource: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = createBitmap(bitmap.width, bitmap.height);
  const ctx = get2d(out);
  ctx.drawImage(bitmap, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(alphaSource, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return out;
}

export function getLayer(doc: ImageDoc, id: string): Layer | undefined {
  return doc.layers.find((layer) => layer.id === id);
}

export function activeLayer(doc: ImageDoc): Layer | undefined {
  return getLayer(doc, doc.activeLayerId);
}

// ---- Brush / eraser ------------------------------------------------------

export interface BrushOptions {
  size: number; // diameter in doc px
  color: string; // CSS color
  hardness: number; // 0..1 (1 = crisp edge, 0 = very soft)
  flow: number; // 0..1 per-stamp alpha
  erase: boolean;
}

// A single soft round stamp centered at (x, y). A radial gradient gives the
// hardness falloff; eraser mode punches transparency via destination-out.
export function paintStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: BrushOptions,
) {
  const radius = Math.max(0.5, opts.size / 2);
  ctx.save();
  ctx.globalCompositeOperation = opts.erase ? "destination-out" : "source-over";
  ctx.globalAlpha = clamp01(opts.flow);
  const hard = clamp01(opts.hardness);
  if (hard >= 0.999) {
    ctx.fillStyle = opts.erase ? "#000" : opts.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const gradient = ctx.createRadialGradient(x, y, radius * hard, x, y, radius);
    const core = opts.erase ? "#000" : opts.color;
    gradient.addColorStop(0, withAlpha(core, 1));
    gradient.addColorStop(1, withAlpha(core, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Interpolate stamps along a segment so fast pointer moves stay continuous.
export function paintLine(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  opts: BrushOptions,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const spacing = Math.max(0.5, opts.size * 0.15);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    paintStamp(ctx, from.x + dx * t, from.y + dy * t, opts);
  }
}

// ---- Shapes & text --------------------------------------------------------

export type ShapeKind = "rect" | "ellipse" | "line";

export interface ShapePaint {
  color: string;
  fill: boolean;
  stroke: boolean;
  strokeWidth: number;
}

// Draw a shape between two points in the ctx's current coordinate space. Used
// both for the live overlay preview (screen space) and the raster commit (doc
// space).
export function paintShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  a: Point,
  b: Point,
  opts: ShapePaint,
) {
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = Math.max(0.5, opts.strokeWidth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "line") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  } else {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    if (kind === "rect") {
      if (opts.fill) {
        ctx.fillRect(x, y, w, h);
      }
      if (opts.stroke) {
        ctx.strokeRect(x, y, w, h);
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (opts.fill) {
        ctx.fill();
      }
      if (opts.stroke) {
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// Rasterize a line of text onto a new bitmap the size of the layer, with its
// top-left at `point`. Returns the text bitmap (draw it onto a layer clone).
export function rasterizeText(
  width: number,
  height: number,
  text: string,
  point: Point,
  opts: {
    color: string;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
  },
): HTMLCanvasElement {
  const canvas = createBitmap(width, height);
  const ctx = get2d(canvas);
  const style = `${opts.italic ? "italic " : ""}${opts.bold ? "700 " : "400 "}`;
  ctx.font = `${style}${opts.fontSize}px ${opts.fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = opts.color;
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    ctx.fillText(line, point.x, point.y + index * opts.fontSize * 1.25);
  });
  return canvas;
}

// Fill `ctx` (width×height) with a linear or radial gradient defined by the drag
// from → to. `fg-bg` is opaque foreground→background; `fg-transparent` fades the
// foreground to nothing (drawn source-over, so existing pixels show through).
export function fillGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  from: Point,
  to: Point,
  opts: {
    type: "linear" | "radial";
    fg: string;
    bg: string;
    mode: "fg-bg" | "fg-transparent";
  },
) {
  let gradient: CanvasGradient;
  if (opts.type === "radial") {
    const radius = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    gradient = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, radius);
  } else {
    gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  }
  const end = opts.mode === "fg-transparent" ? withAlpha(opts.fg, 0) : opts.bg;
  gradient.addColorStop(0, opts.fg);
  gradient.addColorStop(1, end);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// ---- Color utilities -----------------------------------------------------

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// Turn a #rrggbb / #rgb / rgb() color into an rgba() with the given alpha. Falls
// back to the input when it can't parse (already rgba, named color, etc.).
function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp01(alpha)})`;
}

export function parseColor(
  color: string,
): { r: number; g: number; b: number } | null {
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (full) {
    return {
      r: parseInt(full[1], 16),
      g: parseInt(full[2], 16),
      b: parseInt(full[3], 16),
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(hex);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => parseFloat(p));
    if (parts.length >= 3) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  return null;
}

// Read a single pixel back as #rrggbb (used by the eyedropper).
export function samplePixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): { hex: string; alpha: number } | null {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
    return null;
  }
  const data = get2dReadable(canvas).getImageData(px, py, 1, 1).data;
  return { hex: rgbToHex(data[0], data[1], data[2]), alpha: data[3] / 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// ---- Coordinate transform (screen <-> document) --------------------------

export interface Viewport {
  scale: number;
  offsetX: number; // doc-origin position in CSS px within the stage
  offsetY: number;
}

export function screenToDoc(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  view: Viewport,
): Point {
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

export function docToScreen(point: Point, view: Viewport): Point {
  return {
    x: point.x * view.scale + view.offsetX,
    y: point.y * view.scale + view.offsetY,
  };
}

export function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

// ---- Flood fill (bucket) --------------------------------------------------

// Fill the contiguous region matching the pixel at (x, y) within `tolerance`
// (0..255 per channel) with `fillColor`. Mutates `canvas` in place — call on a
// working clone, then commit copy-on-write. Returns false if the point is out
// of bounds or the color can't be parsed.
export function floodFill(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  fillColor: string,
  tolerance = 32,
): boolean {
  const { width, height } = canvas;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height) {
    return false;
  }
  const fill = parseColor(fillColor);
  if (!fill) {
    return false;
  }
  const ctx = get2dReadable(canvas);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const start = (py * width + px) * 4;
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const tol = tolerance * tolerance * 4;
  const matches = (i: number) => {
    const dr = data[i] - target[0];
    const dg = data[i + 1] - target[1];
    const db = data[i + 2] - target[2];
    const da = data[i + 3] - target[3];
    return dr * dr + dg * dg + db * db + da * da <= tol;
  };
  const visited = new Uint8Array(width * height);
  const stack: number[] = [py * width + px];
  while (stack.length) {
    const p = stack.pop() as number;
    if (visited[p]) {
      continue;
    }
    visited[p] = 1;
    const i = p * 4;
    if (!matches(i)) {
      continue;
    }
    data[i] = fill.r;
    data[i + 1] = fill.g;
    data[i + 2] = fill.b;
    data[i + 3] = 255;
    const cx = p % width;
    const cy = (p - cx) / width;
    if (cx > 0) stack.push(p - 1);
    if (cx < width - 1) stack.push(p + 1);
    if (cy > 0) stack.push(p - width);
    if (cy < height - 1) stack.push(p + width);
  }
  ctx.putImageData(image, 0, 0);
  return true;
}

// ---- Image ingest ---------------------------------------------------------

export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

// Decode a user-supplied image file entirely in the browser, guarding size so a
// huge (or hostile) image can't exhaust memory. Never throws — returns an error
// string instead so callers degrade gracefully.
export async function decodeImageFile(
  file: File,
  limits: { maxPixels: number; maxDimension: number },
): Promise<DecodedImage | { error: string }> {
  if (!file.type.startsWith("image/")) {
    return { error: "That file is not an image." };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: "Could not decode that image." };
  }
  const { width, height } = bitmap;
  if (
    width < 1 ||
    height < 1 ||
    width > limits.maxDimension ||
    height > limits.maxDimension ||
    width * height > limits.maxPixels
  ) {
    bitmap.close();
    return {
      error: `Image is too large (max ${limits.maxDimension}px per side).`,
    };
  }
  return { bitmap, width, height };
}
