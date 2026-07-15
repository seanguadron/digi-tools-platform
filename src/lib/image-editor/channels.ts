// Channel viewing + selection. Channels are a DISPLAY transform over the
// composite plus a selection source — there is no separate channel storage in
// the document model (layers stay RGBA canvases). `applyChannelView` runs on
// recomposite (doc edit / channel toggle), never per pan-frame.

import { composite, createBitmap, get2d, get2dReadable } from "./raster";
import type { ImageDoc, Selection } from "./types";

export type ChannelKey = "r" | "g" | "b" | "a";

export interface ChannelView {
  r: boolean;
  g: boolean;
  b: boolean;
  a: boolean;
}

export const ALL_CHANNELS: ChannelView = { r: true, g: true, b: true, a: true };

export function channelsAllVisible(view: ChannelView): boolean {
  return view.r && view.g && view.b && view.a;
}

const CHANNEL_OFFSET: Record<ChannelKey, number> = { r: 0, g: 1, b: 2, a: 3 };

// Produce a display bitmap honoring channel visibility (Photoshop semantics):
// - all RGB visible: unchanged colour.
// - exactly one RGB visible: grayscale of that channel.
// - a subset of RGB visible: hidden channels zeroed (tinted view).
// - alpha hidden: forced opaque. alpha-only (RGB all hidden): alpha as gray.
export function applyChannelView(
  src: HTMLCanvasElement,
  view: ChannelView,
  reuse?: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out =
    reuse && reuse.width === w && reuse.height === h
      ? reuse
      : createBitmap(w, h);
  const img = get2dReadable(src).getImageData(0, 0, w, h);
  const data = img.data;
  const rgbCount = (view.r ? 1 : 0) + (view.g ? 1 : 0) + (view.b ? 1 : 0);
  const alphaOnly = rgbCount === 0 && view.a;

  for (let i = 0; i < data.length; i += 4) {
    if (alphaOnly) {
      const alpha = data[i + 3];
      data[i] = alpha;
      data[i + 1] = alpha;
      data[i + 2] = alpha;
      data[i + 3] = 255;
      continue;
    }
    if (rgbCount === 1) {
      const value = view.r ? data[i] : view.g ? data[i + 1] : data[i + 2];
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    } else {
      if (!view.r) {
        data[i] = 0;
      }
      if (!view.g) {
        data[i + 1] = 0;
      }
      if (!view.b) {
        data[i + 2] = 0;
      }
    }
    if (!view.a) {
      data[i + 3] = 255;
    }
  }

  get2d(out).putImageData(img, 0, 0);
  return out;
}

// Build a selection whose alpha mask is one channel's per-pixel value (a
// graduated selection), modelled like the mask-based magic-wand selection.
export function loadChannelAsSelection(
  doc: ImageDoc,
  channel: ChannelKey,
): Selection | null {
  const flat = composite(doc);
  const { width, height } = flat;
  const img = get2dReadable(flat).getImageData(0, 0, width, height);
  const data = img.data;
  const offset = CHANNEL_OFFSET[channel];

  const mask = createBitmap(width, height);
  const mctx = get2d(mask);
  const out = mctx.createImageData(width, height);
  const od = out.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const value = data[i + offset];
      od[i] = 255;
      od[i + 1] = 255;
      od[i + 2] = 255;
      od[i + 3] = value;
      if (value > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return null;
  }
  mctx.putImageData(out, 0, 0);
  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  return { mask, bounds, shape: { kind: "rect", rect: bounds }, inverted: false };
}
