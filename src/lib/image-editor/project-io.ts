// Serialize an ImageDoc to a portable JSON bundle (layers as PNG data URLs) and
// back. Deserialization is the app's trust boundary for opened projects and
// restored autosaves: everything is shape-validated and decoded client-side, and
// any failure degrades to null (never throws) so callers fall back to defaults.

import { makeId } from "@/lib/prompt-storage";
import { clampPpi, DEFAULT_DOC_PPI } from "@/lib/units";
import { createBitmap, get2d } from "./raster";
import {
  BLEND_MODES,
  MAX_DOC_DIMENSION,
  MAX_DOC_LAYERS,
  MAX_DOC_PIXELS,
  MAX_TOTAL_PIXELS,
  type BlendMode,
  type ImageDoc,
  type Layer,
} from "./types";

export interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  clipped: boolean;
  data: string; // PNG data URL
}

export interface SerializedDoc {
  version: 1;
  name: string;
  width: number;
  height: number;
  ppi?: number; // absent in pre-ppi projects; restored via clampPpi default
  activeLayerId: string;
  layers: SerializedLayer[];
}

export function serializeDoc(doc: ImageDoc, name: string): SerializedDoc {
  return {
    version: 1,
    name,
    width: doc.width,
    height: doc.height,
    ppi: doc.ppi,
    activeLayerId: doc.activeLayerId,
    layers: doc.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      locked: layer.locked,
      clipped: layer.clipped,
      data: layer.bitmap.toDataURL("image/png"),
    })),
  };
}

export function serializeDocJson(doc: ImageDoc, name: string): string {
  return JSON.stringify(serializeDoc(doc, name));
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function clampOpacity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 1;
}

function coerceBlend(value: unknown): BlendMode {
  return BLEND_MODES.includes(value as BlendMode)
    ? (value as BlendMode)
    : "normal";
}

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,/;

function dataUrlToCanvas(
  dataUrl: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      // Reject an embedded image whose own intrinsic size blows the ceiling,
      // independent of the (already-capped) destination canvas size.
      if (image.naturalWidth * image.naturalHeight > MAX_DOC_PIXELS) {
        resolve(null);
        return;
      }
      try {
        const canvas = createBitmap(width, height);
        get2d(canvas).drawImage(image, 0, 0);
        resolve(canvas);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

// Validate + decode a parsed project object into an ImageDoc. Returns null on any
// structural problem. Async because each layer's image must decode.
export async function deserializeDoc(
  raw: unknown,
): Promise<{ doc: ImageDoc; name: string } | null> {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) {
    return null;
  }
  const width = value.width;
  const height = value.height;
  if (
    !isPositiveInt(width) ||
    !isPositiveInt(height) ||
    width > MAX_DOC_DIMENSION ||
    height > MAX_DOC_DIMENSION ||
    width * height > MAX_DOC_PIXELS
  ) {
    return null;
  }
  if (
    !Array.isArray(value.layers) ||
    value.layers.length === 0 ||
    value.layers.length > MAX_DOC_LAYERS ||
    width * height * value.layers.length > MAX_TOTAL_PIXELS
  ) {
    return null;
  }

  const layers: Layer[] = [];
  for (const entry of value.layers) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const layer = entry as Record<string, unknown>;
    if (typeof layer.data !== "string" || !DATA_URL.test(layer.data)) {
      continue;
    }
    const bitmap = await dataUrlToCanvas(layer.data, width, height);
    if (!bitmap) {
      continue;
    }
    layers.push({
      id: typeof layer.id === "string" ? layer.id : makeId(),
      name: typeof layer.name === "string" ? layer.name : "Layer",
      visible: layer.visible !== false,
      opacity: clampOpacity(layer.opacity),
      blendMode: coerceBlend(layer.blendMode),
      locked: layer.locked === true,
      clipped: layer.clipped === true,
      bitmap,
    });
  }
  if (layers.length === 0) {
    return null;
  }

  const activeLayerId =
    typeof value.activeLayerId === "string" &&
    layers.some((layer) => layer.id === value.activeLayerId)
      ? value.activeLayerId
      : layers[layers.length - 1].id;

  return {
    doc: {
      version: 1,
      width,
      height,
      // Only scalar shapes ride Number()'s coercion; anything else (arrays,
      // objects, absent) takes the documented pre-ppi default. Guards the
      // Number([]) === 0 quirk from flooring a malformed value to 1 PPI.
      ppi:
        typeof value.ppi === "number" || typeof value.ppi === "string"
          ? clampPpi(Number(value.ppi))
          : DEFAULT_DOC_PPI,
      layers,
      activeLayerId,
      selection: null,
    },
    name: typeof value.name === "string" && value.name ? value.name : "Untitled",
  };
}

export async function parseProjectJson(
  json: string,
): Promise<{ doc: ImageDoc; name: string } | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  return deserializeDoc(raw);
}
