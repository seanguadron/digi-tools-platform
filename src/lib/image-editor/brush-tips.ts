// Brush tips (stencils). Built-in tips are procedural (round/square/spray) plus
// a lazily-generated "chalk" alpha texture; imported PNGs become custom image
// tips. `resolveStampTip` maps a tip id + the custom-tip list to the StampTip the
// paint code (raster.paintStamp) understands. No canvas is created at module
// scope — the chalk texture and imported alphas are built inside functions.

import { createBitmap, get2d, get2dReadable } from "./raster";
import type { StampTip } from "./raster";

export interface BrushTipDef {
  id: string;
  label: string;
  kind: "round" | "square" | "spray" | "image";
}

export const BUILTIN_TIPS: readonly BrushTipDef[] = [
  { id: "round", label: "Round", kind: "round" },
  { id: "square", label: "Square", kind: "square" },
  { id: "spray", label: "Spray", kind: "spray" },
  { id: "chalk", label: "Chalk", kind: "image" },
];

export interface CustomTip {
  id: string;
  label: string;
  image: HTMLCanvasElement; // white RGB, alpha = tip profile
}

// A soft round base modulated by grain — a chalky/dry-media alpha. Built once
// and cached.
let chalkAlpha: HTMLCanvasElement | null = null;
function getChalkAlpha(): HTMLCanvasElement {
  if (chalkAlpha) {
    return chalkAlpha;
  }
  const size = 128;
  const canvas = createBitmap(size, size);
  const ctx = get2d(canvas);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = 0.35 + Math.random() * 0.65;
    data[i + 3] = Math.round(data[i + 3] * grain);
  }
  ctx.putImageData(img, 0, 0);
  chalkAlpha = canvas;
  return canvas;
}

// Turn an imported bitmap into a tip alpha (white RGB + derived alpha). If the
// image has transparency, its alpha is the profile; otherwise darkness is
// opacity (black paints, white is empty — the .abr convention).
const MAX_TIP_DIM = 512;

export function buildTipAlpha(
  source: CanvasImageSource,
  w: number,
  h: number,
): HTMLCanvasElement {
  // A stencil never needs more than a few hundred px; downscale large imports
  // so a big PNG can't retain tens of MB of RGBA per tip.
  const scale = Math.min(1, MAX_TIP_DIM / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const base = createBitmap(tw, th);
  get2d(base).drawImage(source, 0, 0, tw, th);
  const src = get2dReadable(base).getImageData(0, 0, tw, th);
  const sd = src.data;
  let hasAlpha = false;
  for (let i = 3; i < sd.length; i += 4) {
    if (sd[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  const out = createBitmap(tw, th);
  const octx = get2d(out);
  const od = octx.createImageData(tw, th);
  const dd = od.data;
  for (let i = 0; i < sd.length; i += 4) {
    const lum = 0.299 * sd[i] + 0.587 * sd[i + 1] + 0.114 * sd[i + 2];
    dd[i] = 255;
    dd[i + 1] = 255;
    dd[i + 2] = 255;
    dd[i + 3] = hasAlpha ? sd[i + 3] : Math.round(255 - lum);
  }
  octx.putImageData(od, 0, 0);
  return out;
}

// Resolve a tip id (+ custom tips) to a StampTip for paintStamp.
export function resolveStampTip(
  tipId: string,
  customTips: readonly CustomTip[],
): StampTip {
  if (tipId === "square" || tipId === "spray") {
    return { kind: tipId };
  }
  if (tipId === "chalk") {
    return { kind: "image", image: getChalkAlpha() };
  }
  const custom = customTips.find((tip) => tip.id === tipId);
  if (custom) {
    return { kind: "image", image: custom.image };
  }
  return { kind: "round" };
}
