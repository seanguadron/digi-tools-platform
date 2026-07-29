// Pure, immutable operations over an ImageDoc. Each returns a NEW doc; layer
// bitmaps are shared by reference unless the op replaces one (copy-on-write), so
// the history hook can snapshot by reference. All bitmap creation is browser-only
// (these run from effects/handlers, never at module scope).

import {
  blankBitmap,
  clipToAlpha,
  cloneBitmap,
  composite,
  createBitmap,
  get2d,
} from "./raster";
import { applySelectionClip } from "./selection";
import type { BlendMode, ImageDoc, Layer, Rect } from "./types";
import {
  DEFAULT_DOC_HEIGHT,
  DEFAULT_DOC_WIDTH,
  MAX_DOC_DIMENSION,
  MAX_DOC_PIXELS,
} from "./types";
import { DEFAULT_DOC_PPI } from "@/lib/units";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createLayer(
  width: number,
  height: number,
  name: string,
  fill?: HTMLCanvasElement | HTMLImageElement | ImageBitmap,
): Layer {
  const bitmap = blankBitmap(width, height);
  if (fill) {
    get2d(bitmap).drawImage(fill, 0, 0);
  }
  return {
    id: uid("layer"),
    name,
    visible: true,
    opacity: 1,
    blendMode: "normal",
    locked: false,
    clipped: false,
    bitmap,
  };
}

// A fresh document with a single raster layer — transparent by default, or
// filled with a background color when one is chosen at creation.
export function createDoc(
  width = DEFAULT_DOC_WIDTH,
  height = DEFAULT_DOC_HEIGHT,
  ppi = DEFAULT_DOC_PPI,
  background: string | null = null,
): ImageDoc {
  const layer = createLayer(width, height, "Background");
  if (background) {
    const ctx = get2d(layer.bitmap);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  return {
    version: 1,
    width,
    height,
    ppi,
    layers: [layer],
    activeLayerId: layer.id,
    selection: null,
  };
}

// A document seeded from an opened image, sized to the image.
export function createDocFromImage(
  source: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
  width: number,
  height: number,
): ImageDoc {
  const layer = createLayer(width, height, "Image", source);
  return {
    version: 1,
    width,
    height,
    ppi: DEFAULT_DOC_PPI,
    layers: [layer],
    activeLayerId: layer.id,
    selection: null,
  };
}

// Add a decoded image as a new top layer, drawn at the top-left of the canvas.
export function addImageLayer(
  doc: ImageDoc,
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  name: string,
): ImageDoc {
  const layer = createLayer(doc.width, doc.height, name, source);
  return {
    ...doc,
    layers: [...doc.layers, layer],
    activeLayerId: layer.id,
  };
}

export function findLayer(doc: ImageDoc, id: string): Layer | undefined {
  return doc.layers.find((layer) => layer.id === id);
}

export function activeLayerOf(doc: ImageDoc): Layer | undefined {
  return findLayer(doc, doc.activeLayerId);
}

function replaceLayer(doc: ImageDoc, id: string, next: Layer): ImageDoc {
  return {
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === id ? next : layer)),
  };
}

// Swap in a new bitmap for a layer (copy-on-write result of a paint/edit op).
export function commitLayerBitmap(
  doc: ImageDoc,
  layerId: string,
  bitmap: HTMLCanvasElement,
): ImageDoc {
  const layer = findLayer(doc, layerId);
  if (!layer) {
    return doc;
  }
  return replaceLayer(doc, layerId, { ...layer, bitmap });
}

/**
 * The single choke point every paint / fill / stroke path commits through, so
 * the two trust rules can't be forgotten at a call site:
 *  - an active selection confines the paint to inside it (unless `clipToSelection`
 *    is false — a selection-*edge* stroke intentionally straddles the boundary), and
 *  - a transparency-locked layer confines the paint to its existing opaque pixels.
 */
export function commitPaintedBitmap(
  doc: ImageDoc,
  layerId: string,
  working: HTMLCanvasElement,
  clipToSelection = true,
): ImageDoc {
  const layer = findLayer(doc, layerId);
  if (!layer) {
    return doc;
  }
  let result =
    clipToSelection && doc.selection
      ? applySelectionClip(layer.bitmap, working, doc.selection)
      : working;
  if (layer.locked) {
    result = clipToAlpha(result, layer.bitmap);
  }
  return commitLayerBitmap(doc, layerId, result);
}

export function patchLayer(
  doc: ImageDoc,
  layerId: string,
  patch: Partial<Omit<Layer, "id" | "bitmap">>,
): ImageDoc {
  const layer = findLayer(doc, layerId);
  if (!layer) {
    return doc;
  }
  return replaceLayer(doc, layerId, { ...layer, ...patch });
}

export function setActiveLayer(doc: ImageDoc, layerId: string): ImageDoc {
  return findLayer(doc, layerId) ? { ...doc, activeLayerId: layerId } : doc;
}

export function addLayer(doc: ImageDoc, name?: string): ImageDoc {
  const layer = createLayer(
    doc.width,
    doc.height,
    name ?? `Layer ${doc.layers.length + 1}`,
  );
  return {
    ...doc,
    layers: [...doc.layers, layer],
    activeLayerId: layer.id,
  };
}

export function duplicateLayer(doc: ImageDoc, layerId: string): ImageDoc {
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) {
    return doc;
  }
  const source = doc.layers[index];
  const copy: Layer = {
    ...source,
    id: uid("layer"),
    name: `${source.name} copy`,
    bitmap: cloneBitmap(source.bitmap),
  };
  const layers = [...doc.layers];
  layers.splice(index + 1, 0, copy);
  return { ...doc, layers, activeLayerId: copy.id };
}

export function deleteLayer(doc: ImageDoc, layerId: string): ImageDoc {
  if (doc.layers.length <= 1) {
    return doc; // keep at least one layer
  }
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) {
    return doc;
  }
  const layers = doc.layers.filter((layer) => layer.id !== layerId);
  const nextActive =
    doc.activeLayerId === layerId
      ? layers[Math.max(0, index - 1)].id
      : doc.activeLayerId;
  return { ...doc, layers, activeLayerId: nextActive };
}

// Move a layer up/down in the visual stack (delta +1 = toward top).
export function reorderLayer(
  doc: ImageDoc,
  layerId: string,
  delta: number,
): ImageDoc {
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) {
    return doc;
  }
  const target = Math.max(0, Math.min(doc.layers.length - 1, index + delta));
  if (target === index) {
    return doc;
  }
  const layers = [...doc.layers];
  const [moved] = layers.splice(index, 1);
  layers.splice(target, 0, moved);
  return { ...doc, layers };
}

// Move a layer to an absolute stack index (used by drag-reorder).
export function moveLayerToIndex(
  doc: ImageDoc,
  layerId: string,
  toIndex: number,
): ImageDoc {
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) {
    return doc;
  }
  const target = Math.max(0, Math.min(doc.layers.length - 1, toIndex));
  if (target === index) {
    return doc;
  }
  const layers = [...doc.layers];
  const [moved] = layers.splice(index, 1);
  layers.splice(target, 0, moved);
  return { ...doc, layers };
}

// Merge a layer down into the one below it, respecting opacity + blend mode.
export function mergeLayerDown(doc: ImageDoc, layerId: string): ImageDoc {
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index <= 0) {
    return doc; // nothing beneath
  }
  const top = doc.layers[index];
  const bottom = doc.layers[index - 1];
  const merged = cloneBitmap(bottom.bitmap);
  const ctx = get2d(merged);
  ctx.globalAlpha = top.opacity;
  ctx.globalCompositeOperation =
    top.blendMode === "normal" ? "source-over" : top.blendMode;
  ctx.drawImage(top.bitmap, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const nextBottom: Layer = { ...bottom, bitmap: merged };
  const layers = doc.layers.filter((layer) => layer.id !== layerId);
  layers[index - 1] = nextBottom;
  return {
    ...doc,
    layers,
    activeLayerId:
      doc.activeLayerId === layerId ? nextBottom.id : doc.activeLayerId,
  };
}

// Flatten every visible layer into a single opaque-capable raster layer.
export function flattenDoc(doc: ImageDoc): ImageDoc {
  const flat = composite(doc);
  const layer = createLayer(doc.width, doc.height, "Flattened", flat);
  return { ...doc, layers: [layer], activeLayerId: layer.id, selection: null };
}

// Resize the canvas (not the content) — grows/crops every layer to w×h with the
// existing pixels anchored at the top-left. Used by crop with an offset.
export function resizeCanvas(
  doc: ImageDoc,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
): ImageDoc {
  const layers = doc.layers.map((layer) => {
    const next = createBitmap(width, height);
    get2d(next).drawImage(layer.bitmap, offsetX, offsetY);
    return { ...layer, bitmap: next };
  });
  return { ...doc, width, height, layers, selection: null };
}

// Crop the canvas to a rect (doc-space), keeping all layers aligned. The
// rect can come from free-typed numeric fields, so the app's size ceilings
// are enforced HERE, at the allocation choke point — an out-of-budget rect
// is a no-op, never a throw.
export function cropDoc(doc: ImageDoc, rect: Rect): ImageDoc {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const width = Math.min(MAX_DOC_DIMENSION, Math.max(1, Math.round(rect.width)));
  const height = Math.min(
    MAX_DOC_DIMENSION,
    Math.max(1, Math.round(rect.height)),
  );
  if (width * height > MAX_DOC_PIXELS) {
    return doc;
  }
  return resizeCanvas(doc, width, height, -x, -y);
}

export function setSelection(
  doc: ImageDoc,
  selection: ImageDoc["selection"],
): ImageDoc {
  return { ...doc, selection };
}

// Flip every layer across the horizontal or vertical axis (canvas size kept).
export function flipDoc(
  doc: ImageDoc,
  axis: "horizontal" | "vertical",
): ImageDoc {
  const layers = doc.layers.map((layer) => {
    const next = createBitmap(doc.width, doc.height);
    const ctx = get2d(next);
    if (axis === "horizontal") {
      ctx.translate(doc.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, doc.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(layer.bitmap, 0, 0);
    return { ...layer, bitmap: next };
  });
  return { ...doc, layers, selection: null };
}

// Rotate the whole document 90° (dimensions swap).
export function rotateDoc(doc: ImageDoc, dir: "cw" | "ccw"): ImageDoc {
  const width = doc.height;
  const height = doc.width;
  const layers = doc.layers.map((layer) => {
    const next = createBitmap(width, height);
    const ctx = get2d(next);
    if (dir === "cw") {
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, height);
      ctx.rotate(-Math.PI / 2);
    }
    ctx.drawImage(layer.bitmap, 0, 0);
    return { ...layer, bitmap: next };
  });
  return { ...doc, width, height, layers, selection: null };
}

// Resample every layer to a new size (scales content, unlike crop/resize-canvas).
// "smooth" = high-quality interpolation for photos; "pixelated" = nearest
// neighbor for pixel art and hard edges.
export function resampleDoc(
  doc: ImageDoc,
  width: number,
  height: number,
  quality: "smooth" | "pixelated" = "smooth",
): ImageDoc {
  const layers = doc.layers.map((layer) => {
    const next = createBitmap(width, height);
    const ctx = get2d(next);
    ctx.imageSmoothingEnabled = quality === "smooth";
    if (quality === "smooth") {
      ctx.imageSmoothingQuality = "high";
    }
    ctx.drawImage(layer.bitmap, 0, 0, doc.width, doc.height, 0, 0, width, height);
    return { ...layer, bitmap: next };
  });
  return { ...doc, width, height, layers, selection: null };
}

export function setBlendMode(
  doc: ImageDoc,
  layerId: string,
  blendMode: BlendMode,
): ImageDoc {
  return patchLayer(doc, layerId, { blendMode });
}
