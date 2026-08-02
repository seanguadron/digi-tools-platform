// Picks the canvas-overlay palette (selection frame, anchors, handles, pen
// preview, marquee) against the ARTBOARD's own background, which the user
// can set to any color. Import-free so the node test runner can load it.
//
// The rule the design gate held us to: overlay chrome is a non-text UI
// component, so it owes WCAG 1.4.11's 3:1 against what it sits on. A fixed
// light/dark pair does NOT satisfy that — for mid-tone backgrounds
// (khaki, olive, tan, mid-grays) neither brand cyan reaches 3:1. So:
// prefer brand cyan when it genuinely clears the floor, and fall back to
// black or white when it doesn't. That fallback can never fail: for any
// background luminance, the better of black/white is >= 4.58:1.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface OverlayPalette {
  accent: string; // strokes and selected fills
  paper: string; // the "hollow" fill of unselected anchors/handles
}

// The two brand candidates, resolved from --brand-cyan-text and
// --brand-cyan (oklch(0.48 0.12 200) / oklch(0.82 0.18 200)) to sRGB.
export const ACCENT_DARK = "#007078";
export const ACCENT_LIGHT = "#00e5f2";
const PAPER_LIGHT = "#ffffff";
const PAPER_DARK = "#10141c";

const MIN_CONTRAST = 3;

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// WCAG relative luminance — gamma-corrected, not a raw weighted average
// of 8-bit values (that shortcut is what produced the dead zone).
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

const LUMINANCE_DARK = relativeLuminance(hexToRgb(ACCENT_DARK) as Rgb);
const LUMINANCE_LIGHT = relativeLuminance(hexToRgb(ACCENT_LIGHT) as Rgb);

// Given the artboard background's luminance, the palette whose accent
// actually clears the 3:1 floor. Brand cyan wins ties and near-ties so the
// common white/dark artboards keep the product's color.
export function paletteForLuminance(background: number): OverlayPalette {
  const darkRatio = contrastRatio(LUMINANCE_DARK, background);
  const lightRatio = contrastRatio(LUMINANCE_LIGHT, background);
  const best = Math.max(darkRatio, lightRatio);

  if (best >= MIN_CONTRAST) {
    return darkRatio >= lightRatio
      ? { accent: ACCENT_DARK, paper: PAPER_LIGHT }
      : { accent: ACCENT_LIGHT, paper: PAPER_DARK };
  }

  // Neither cyan clears the floor: black or white always does.
  const blackRatio = contrastRatio(0, background);
  const whiteRatio = contrastRatio(1, background);
  return blackRatio >= whiteRatio
    ? { accent: "#000000", paper: PAPER_LIGHT }
    : { accent: "#ffffff", paper: PAPER_DARK };
}

// The palette for a resolved background color. `null` means a transparent
// artboard — the app theme shows through, so the caller passes the theme's
// own backdrop luminance instead.
export function paletteForBackground(background: Rgb | null): OverlayPalette {
  if (!background) return { accent: ACCENT_DARK, paper: PAPER_LIGHT };
  return paletteForLuminance(relativeLuminance(background));
}
