// Selection model + operations. A selection is a document-resolution alpha mask
// (opaque = selected) plus a vector shape for crisp outlines. All ops are pure
// and browser-only (canvas), called from effects/handlers.

import { createBitmap, get2d, get2dReadable } from "./raster";
import type { ImageDoc, Point, Rect, Selection } from "./types";

function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(width, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height, Math.round(rect.y)));
  const right = Math.max(0, Math.min(width, Math.round(rect.x + rect.width)));
  const bottom = Math.max(0, Math.min(height, Math.round(rect.y + rect.height)));
  return { x, y, width: right - x, height: bottom - y };
}

function maskCanvas(width: number, height: number): HTMLCanvasElement {
  return createBitmap(width, height);
}

export function rectSelection(
  width: number,
  height: number,
  rect: Rect,
): Selection | null {
  const bounds = clampRect(rect, width, height);
  if (bounds.width < 1 || bounds.height < 1) {
    return null;
  }
  const mask = maskCanvas(width, height);
  const ctx = get2d(mask);
  ctx.fillStyle = "#fff";
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  return { mask, bounds, shape: { kind: "rect", rect: bounds }, inverted: false };
}

export function polySelection(
  width: number,
  height: number,
  points: Point[],
): Selection | null {
  if (points.length < 3) {
    return null;
  }
  const mask = maskCanvas(width, height);
  const ctx = get2d(mask);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const bounds = clampRect(
    { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    width,
    height,
  );
  if (bounds.width < 1 || bounds.height < 1) {
    return null;
  }
  return {
    mask,
    bounds,
    shape: { kind: "poly", points: points.map((p) => ({ ...p })) },
    inverted: false,
  };
}

function ellipsePoints(rect: Rect): Point[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const points: Point[] = [];
  const count = 48;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return points;
}

export function ellipseSelection(
  width: number,
  height: number,
  rect: Rect,
): Selection | null {
  const bounds = clampRect(rect, width, height);
  if (bounds.width < 1 || bounds.height < 1) {
    return null;
  }
  const mask = maskCanvas(width, height);
  const ctx = get2d(mask);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    bounds.width / 2,
    bounds.height / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  return {
    mask,
    bounds,
    shape: { kind: "poly", points: ellipsePoints(bounds) },
    inverted: false,
  };
}

// Select the contiguous region around (sx, sy) whose color is within `tolerance`
// of the clicked pixel. `source` is the sampled bitmap (usually the composite).
export function magicWandSelection(
  source: HTMLCanvasElement,
  sx: number,
  sy: number,
  tolerance: number,
): Selection | null {
  const width = source.width;
  const height = source.height;
  const px = Math.floor(sx);
  const py = Math.floor(sy);
  if (px < 0 || py < 0 || px >= width || py >= height) {
    return null;
  }
  const data = get2dReadable(source).getImageData(0, 0, width, height).data;
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
  const selected = new Uint8Array(width * height);
  const stack: number[] = [py * width + px];
  let minX = px;
  let maxX = px;
  let minY = py;
  let maxY = py;
  let any = false;
  while (stack.length) {
    const p = stack.pop() as number;
    if (selected[p]) {
      continue;
    }
    if (!matches(p * 4)) {
      continue;
    }
    selected[p] = 1;
    any = true;
    const cx = p % width;
    const cy = (p - cx) / width;
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
    if (cx > 0) stack.push(p - 1);
    if (cx < width - 1) stack.push(p + 1);
    if (cy > 0) stack.push(p - width);
    if (cy < height - 1) stack.push(p + width);
  }
  if (!any) {
    return null;
  }
  const mask = maskCanvas(width, height);
  const mctx = get2d(mask);
  const image = mctx.createImageData(width, height);
  const out = image.data;
  for (let p = 0; p < selected.length; p += 1) {
    if (selected[p]) {
      const i = p * 4;
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
  mctx.putImageData(image, 0, 0);
  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  return { mask, bounds, shape: { kind: "rect", rect: bounds }, inverted: false };
}

export function selectAll(width: number, height: number): Selection {
  const mask = maskCanvas(width, height);
  const ctx = get2d(mask);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  return {
    mask,
    bounds: { x: 0, y: 0, width, height },
    shape: { kind: "rect", rect: { x: 0, y: 0, width, height } },
    inverted: false,
  };
}

// Invert: mask becomes everything the old mask didn't cover. Keeps the source
// shape so the outline can render as "canvas border minus the shape".
export function invertSelection(
  selection: Selection,
  width: number,
  height: number,
): Selection {
  const mask = maskCanvas(width, height);
  const ctx = get2d(mask);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(selection.mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return {
    mask,
    bounds: { x: 0, y: 0, width, height },
    shape: selection.shape,
    inverted: !selection.inverted,
  };
}

// Erase the selected pixels from a layer bitmap (Delete inside a selection).
export function clearInSelection(
  layerBitmap: HTMLCanvasElement,
  selection: Selection,
): HTMLCanvasElement {
  const result = createBitmap(layerBitmap.width, layerBitmap.height);
  const ctx = get2d(result);
  ctx.drawImage(layerBitmap, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(selection.mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return result;
}

// Combine an edited bitmap with the original so only the selected region changes.
export function applySelectionClip(
  original: HTMLCanvasElement,
  edited: HTMLCanvasElement,
  selection: Selection,
): HTMLCanvasElement {
  const width = original.width;
  const height = original.height;

  // inside = edited ∩ selection
  const inside = createBitmap(width, height);
  const ictx = get2d(inside);
  ictx.drawImage(edited, 0, 0);
  ictx.globalCompositeOperation = "destination-in";
  ictx.drawImage(selection.mask, 0, 0);

  // result = (original outside selection) then inside on top
  const result = createBitmap(width, height);
  const rctx = get2d(result);
  rctx.drawImage(original, 0, 0);
  rctx.globalCompositeOperation = "destination-out";
  rctx.drawImage(selection.mask, 0, 0);
  rctx.globalCompositeOperation = "source-over";
  rctx.drawImage(inside, 0, 0);
  return result;
}

// A floating bitmap containing only the selected pixels (for move).
export function extractSelection(
  layerBitmap: HTMLCanvasElement,
  selection: Selection,
): HTMLCanvasElement {
  const float = createBitmap(layerBitmap.width, layerBitmap.height);
  const ctx = get2d(float);
  ctx.drawImage(layerBitmap, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(selection.mask, 0, 0);
  return float;
}

// Shift a selection by (dx, dy) — mask, bounds, and shape together.
export function translateSelection(
  selection: Selection,
  dx: number,
  dy: number,
  width: number,
  height: number,
): Selection {
  const mask = createBitmap(width, height);
  get2d(mask).drawImage(selection.mask, dx, dy);
  const shape: Selection["shape"] =
    selection.shape.kind === "rect"
      ? {
          kind: "rect",
          rect: {
            ...selection.shape.rect,
            x: selection.shape.rect.x + dx,
            y: selection.shape.rect.y + dy,
          },
        }
      : {
          kind: "poly",
          points: selection.shape.points.map((p) => ({
            x: p.x + dx,
            y: p.y + dy,
          })),
        };
  return {
    mask,
    bounds: {
      ...selection.bounds,
      x: selection.bounds.x + dx,
      y: selection.bounds.y + dy,
    },
    shape,
    inverted: selection.inverted,
  };
}

export function hasSelection(doc: ImageDoc): boolean {
  return doc.selection !== null;
}
