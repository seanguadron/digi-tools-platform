// Image adjustments as pure bitmap → bitmap transforms (browser-only; call from
// handlers). Blur uses the native canvas filter; the tonal ops run over ImageData
// so they're portable and predictable. Alpha is always preserved.

import { createBitmap, get2d, get2dReadable } from "./raster";

export interface Adjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  hue: number; // -180..180 (degrees)
  saturation: number; // -100..100
  levelsBlack: number; // 0..254 input black point
  levelsWhite: number; // 1..255 input white point
  gamma: number; // 0.1..9.9 (1 = neutral)
  posterize: number; // 0 = off, else 2..64 levels
  threshold: number; // 0 = off, else 1..255 mono cutoff
  blur: number; // 0..20 (px)
  grayscale: boolean;
  invert: boolean;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  hue: 0,
  saturation: 0,
  levelsBlack: 0,
  levelsWhite: 255,
  gamma: 1,
  posterize: 0,
  threshold: 0,
  blur: 0,
  grayscale: false,
  invert: false,
};

export function isNeutral(adj: Adjustments): boolean {
  return (
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.hue === 0 &&
    adj.saturation === 0 &&
    adj.levelsBlack === 0 &&
    adj.levelsWhite === 255 &&
    adj.gamma === 1 &&
    adj.posterize === 0 &&
    adj.threshold === 0 &&
    adj.blur === 0 &&
    !adj.grayscale &&
    !adj.invert
  );
}

// Apply the full adjustment stack to a copy of `source`. Order: blur (spatial),
// then grayscale → brightness → contrast → invert (tonal, per pixel).
export function applyAdjustments(
  source: HTMLCanvasElement,
  adj: Adjustments,
): HTMLCanvasElement {
  const { width, height } = source;

  // Blur first, via the native filter, into a working canvas.
  const blurred = createBitmap(width, height);
  const bctx = get2d(blurred);
  if (adj.blur > 0) {
    bctx.filter = `blur(${adj.blur}px)`;
  }
  bctx.drawImage(source, 0, 0);
  bctx.filter = "none";

  const tonal =
    adj.brightness !== 0 ||
    adj.contrast !== 0 ||
    adj.hue !== 0 ||
    adj.saturation !== 0 ||
    adj.levelsBlack !== 0 ||
    adj.levelsWhite !== 255 ||
    adj.gamma !== 1 ||
    adj.posterize !== 0 ||
    adj.threshold !== 0 ||
    adj.grayscale ||
    adj.invert;
  if (!tonal) {
    return blurred;
  }

  const ctx = get2dReadable(blurred);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  const brightness = (adj.brightness / 100) * 128;
  const contrast = (adj.contrast / 100) * 128;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (adj.grayscale) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray;
      g = gray;
      b = gray;
    }

    if (adj.hue !== 0 || adj.saturation !== 0) {
      const [h, s, l] = rgbToHsl(r, g, b);
      let nh = (h + adj.hue / 360) % 1;
      if (nh < 0) {
        nh += 1;
      }
      const ns = Math.min(1, Math.max(0, s * (1 + adj.saturation / 100)));
      [r, g, b] = hslToRgb(nh, ns, l);
    }

    r += brightness;
    g += brightness;
    b += brightness;

    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    if (adj.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    if (adj.levelsBlack !== 0 || adj.levelsWhite !== 255 || adj.gamma !== 1) {
      r = applyLevels(r, adj);
      g = applyLevels(g, adj);
      b = applyLevels(b, adj);
    }

    if (adj.posterize >= 2) {
      const step = 255 / (adj.posterize - 1);
      r = Math.round(r / step) * step;
      g = Math.round(g / step) * step;
      b = Math.round(b / step) * step;
    }

    if (adj.threshold > 0) {
      const value = 0.299 * r + 0.587 * g + 0.114 * b >= adj.threshold ? 255 : 0;
      r = value;
      g = value;
      b = value;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
    // alpha (data[i + 3]) untouched
  }

  ctx.putImageData(image, 0, 0);
  return blurred;
}

function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function applyLevels(value: number, adj: Adjustments): number {
  const range = Math.max(1, adj.levelsWhite - adj.levelsBlack);
  let n = (value - adj.levelsBlack) / range;
  n = n < 0 ? 0 : n > 1 ? 1 : n;
  n = Math.pow(n, 1 / adj.gamma);
  return n * 255;
}

// r,g,b in 0..255 → h,s,l in 0..1.
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h /= 6;
    if (h < 0) {
      h += 1;
    }
  }
  return [h, s, l];
}

// h,s,l in 0..1 → r,g,b in 0..255.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  const seg = Math.floor(h * 6);
  if (seg === 0) {
    [r, g, b] = [c, x, 0];
  } else if (seg === 1) {
    [r, g, b] = [x, c, 0];
  } else if (seg === 2) {
    [r, g, b] = [0, c, x];
  } else if (seg === 3) {
    [r, g, b] = [0, x, c];
  } else if (seg === 4) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
