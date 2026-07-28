import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPpi,
  DEFAULT_DOC_PPI,
  formatSize,
  fromPx,
  isDocUnit,
  roundForUnit,
  toPx,
} from "../src/lib/units.ts";

test("px is the identity unit", () => {
  assert.equal(toPx(640, "px", 300), 640);
  assert.equal(fromPx(640, "px", 72), 640);
});

test("inches convert through ppi both ways", () => {
  assert.equal(toPx(8.5, "in", 300), 2550);
  assert.equal(fromPx(2550, "in", 300), 8.5);
});

test("centimeters and millimeters agree with each other", () => {
  const px = toPx(2.54, "cm", 300);
  assert.ok(Math.abs(px - 300) < 1e-9);
  assert.ok(Math.abs(toPx(25.4, "mm", 300) - 300) < 1e-9);
  assert.ok(Math.abs(fromPx(300, "mm", 300) - 25.4) < 1e-9);
});

test("clampPpi bounds and defaults", () => {
  assert.equal(clampPpi(300), 300);
  assert.equal(clampPpi(0), 1);
  assert.equal(clampPpi(99999), 1200);
  assert.equal(clampPpi(Number.NaN), DEFAULT_DOC_PPI);
  assert.equal(clampPpi(72.6), 73);
});

test("rounding: whole px, two decimals physical", () => {
  assert.equal(roundForUnit(123.6, "px"), 124);
  assert.equal(roundForUnit(8.5051, "in"), 8.51);
});

test("formatSize renders value + unit", () => {
  assert.equal(formatSize(2550, "in", 300), "8.5 in");
  assert.equal(formatSize(2550, "px", 300), "2550 px");
});

test("isDocUnit accepts only the four units", () => {
  assert.ok(isDocUnit("px") && isDocUnit("in") && isDocUnit("cm") && isDocUnit("mm"));
  assert.ok(!isDocUnit("pt"));
  assert.ok(!isDocUnit(42));
});
