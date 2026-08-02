import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCENT_DARK,
  ACCENT_LIGHT,
  contrastRatio,
  hexToRgb,
  paletteForBackground,
  paletteForLuminance,
  relativeLuminance,
} from "../src/lib/vector-editor/overlay-palette.ts";

const MIN = 3;

function ratioAgainst(accentHex, backgroundHex) {
  return contrastRatio(
    relativeLuminance(hexToRgb(accentHex)),
    relativeLuminance(hexToRgb(backgroundHex)),
  );
}

test("relative luminance is gamma-corrected, not a raw average", () => {
  // Mid gray #808080 linearizes to ~0.216, well under the naive 0.5.
  const mid = relativeLuminance(hexToRgb("#808080"));
  assert.ok(mid > 0.2 && mid < 0.23, `got ${mid}`);
  assert.equal(relativeLuminance(hexToRgb("#000000")), 0);
  assert.ok(Math.abs(relativeLuminance(hexToRgb("#ffffff")) - 1) < 1e-9);
});

test("white artboard keeps the dark brand cyan", () => {
  const palette = paletteForBackground(hexToRgb("#ffffff"));
  assert.equal(palette.accent, ACCENT_DARK);
  assert.equal(palette.paper, "#ffffff");
});

test("near-black artboard keeps the bright brand cyan", () => {
  const palette = paletteForBackground(hexToRgb("#10141c"));
  assert.equal(palette.accent, ACCENT_LIGHT);
});

test("the mid-tone dead zone falls back instead of failing the floor", () => {
  // Exactly the colors the design gate proved both cyans failed on.
  for (const background of ["#969696", "#c3b091", "#808000", "#ff8800", "#d2b48c"]) {
    const palette = paletteForBackground(hexToRgb(background));
    const ratio = ratioAgainst(palette.accent, background);
    assert.ok(
      ratio >= MIN,
      `${background} -> ${palette.accent} was ${ratio.toFixed(2)}:1`,
    );
    assert.ok(
      palette.accent === "#000000" || palette.accent === "#ffffff",
      `${background} should fall back, got ${palette.accent}`,
    );
  }
});

test("no background anywhere in sRGB drops under the 3:1 floor", () => {
  let worst = Infinity;
  let worstAt = "";
  for (let r = 0; r <= 255; r += 15) {
    for (let g = 0; g <= 255; g += 15) {
      for (let b = 0; b <= 255; b += 15) {
        const luminance = relativeLuminance({ r, g, b });
        const palette = paletteForLuminance(luminance);
        const ratio = contrastRatio(
          relativeLuminance(hexToRgb(palette.accent)),
          luminance,
        );
        if (ratio < worst) {
          worst = ratio;
          worstAt = `rgb(${r},${g},${b})`;
        }
      }
    }
  }
  assert.ok(worst >= MIN, `worst was ${worst.toFixed(2)}:1 at ${worstAt}`);
});

test("the branch boundary has no cliff — neighbors both clear the floor", () => {
  for (const background of ["#727272", "#737373", "#747474"]) {
    const palette = paletteForBackground(hexToRgb(background));
    assert.ok(ratioAgainst(palette.accent, background) >= MIN, background);
  }
});

test("paper always contrasts with its own accent", () => {
  for (const background of ["#ffffff", "#000000", "#969696", "#808000"]) {
    const palette = paletteForBackground(hexToRgb(background));
    assert.ok(ratioAgainst(palette.accent, palette.paper) >= MIN, background);
  }
});

test("hexToRgb rejects junk and accepts both # forms", () => {
  assert.deepEqual(hexToRgb("#ff8800"), { r: 255, g: 136, b: 0 });
  assert.deepEqual(hexToRgb("ff8800"), { r: 255, g: 136, b: 0 });
  assert.equal(hexToRgb("red"), null);
  assert.equal(hexToRgb("#fff"), null);
});
