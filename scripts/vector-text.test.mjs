import assert from "node:assert/strict";
import test from "node:test";
import {
  clampFontSize,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  fontCss,
  isFontFamilyName,
  MAX_TEXT_LENGTH,
  sanitizeText,
  textLines,
} from "../src/lib/vector-editor/text.ts";

test("catalog names are unique and the default is a member", () => {
  const names = FONT_FAMILIES.map((family) => family.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes(DEFAULT_FONT_FAMILY));
});

test("isFontFamilyName accepts only catalog names", () => {
  assert.ok(isFontFamilyName("Georgia"));
  assert.ok(!isFontFamilyName("Comic Sans MS"));
  assert.ok(!isFontFamilyName(42));
  assert.ok(!isFontFamilyName("georgia"));
});

test("fontCss resolves a stack and falls back for unknown names", () => {
  assert.match(fontCss("Courier New"), /monospace/);
  assert.equal(fontCss("Nope"), FONT_FAMILIES[0].css);
});

test("clampFontSize bounds and defaults", () => {
  assert.equal(clampFontSize(48), 48);
  assert.equal(clampFontSize(0), 1);
  assert.equal(clampFontSize(99999), 2000);
  assert.equal(clampFontSize(Number.NaN), DEFAULT_FONT_SIZE);
});

test("textLines splits on newlines and never returns empty", () => {
  assert.deepEqual(textLines("a\nb"), ["a", "b"]);
  assert.deepEqual(textLines(""), [""]);
});

test("sanitizeText caps length, keeps tabs/newlines, strips controls", () => {
  assert.equal(sanitizeText("a".repeat(MAX_TEXT_LENGTH + 50)).length, MAX_TEXT_LENGTH);
  assert.equal(sanitizeText("a\r\nb\rc"), "a\nb\nc");
  assert.equal(sanitizeText("keep\tthis\nline"), "keep\tthis\nline");
  assert.equal(sanitizeText(`bad${String.fromCharCode(0)}nul${String.fromCharCode(7)}bell`), "badnulbell");
  assert.equal(sanitizeText(`del${String.fromCharCode(127)}gone`), "delgone");
});
