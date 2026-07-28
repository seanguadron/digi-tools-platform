// The image-editor document model. Pixel data lives in offscreen <canvas>
// elements treated as immutable: every edit produces a NEW bitmap and a NEW
// ImageDoc (copy-on-write), so the whole doc can be snapshotted by reference for
// undo/redo (see use-image-editor-history) and unchanged layers share memory.
//
// Nothing here creates a canvas at module scope — bitmaps are made by the
// factories in document.ts, called only from effects/handlers (browser-only).

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A layer's pixels: an offscreen canvas at document resolution, never mutated in
// place once it is part of a committed ImageDoc.
export type LayerBitmap = HTMLCanvasElement;

export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

export const BLEND_MODES: readonly BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
];

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  blendMode: BlendMode;
  locked: boolean; // transparency lock — paint only where already opaque
  clipped: boolean; // clip to the alpha of the layer below
  bitmap: LayerBitmap;
}

// The vector source of a selection, kept for crisp screen-space marching-ants
// (the mask is the canonical clip, but tracing it every frame is costly).
export type SelectionShape =
  | { kind: "rect"; rect: Rect }
  | { kind: "poly"; points: Point[] };

// A selection is a document-resolution alpha mask (opaque = selected). `bounds`
// is a tight integer box for fast clear/move ops; `shape` + `inverted` drive the
// outline. null selection = whole layer.
export interface Selection {
  mask: HTMLCanvasElement;
  bounds: Rect;
  shape: SelectionShape;
  inverted: boolean;
}

export interface ImageDoc {
  version: 1;
  width: number;
  height: number;
  // Pixels per inch — how large these pixels print. Pixels stay the master
  // unit; physical units (in/cm/mm) are a view through this (src/lib/units).
  ppi: number;
  layers: Layer[]; // index 0 = bottom of the stack
  activeLayerId: string;
  selection: Selection | null;
}

export const DEFAULT_DOC_WIDTH = 1280;
export const DEFAULT_DOC_HEIGHT = 800;

// Hard ceiling on an opened/created canvas so a hostile or accidental huge image
// can't exhaust memory. ~40 MP (e.g. 8000×5000). Enforced at every ingest point.
export const MAX_DOC_PIXELS = 40_000_000;
export const MAX_DOC_DIMENSION = 12_000;

// Ceilings on a deserialized project. A shape-valid file must not be able to
// request memory that a single-canvas dimension check misses: cap the layer
// count AND the total pixels across all layers (dimensions × count), since each
// layer allocates a full doc-sized bitmap.
export const MAX_DOC_LAYERS = 64;
export const MAX_TOTAL_PIXELS = 160_000_000;
