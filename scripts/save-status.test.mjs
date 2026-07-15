import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSaveStatusLabel,
  isSaveStateUnavailable,
} from "../src/lib/save-status.ts";

test("restoring label defaults to ASCII dots and accepts an override", () => {
  assert.equal(formatSaveStatusLabel("restoring", null), "Restoring...");
  assert.equal(
    formatSaveStatusLabel("restoring", null, { restoring: "Restoring…" }),
    "Restoring…",
  );
});

test("unavailable and large produce their fixed labels", () => {
  assert.equal(
    formatSaveStatusLabel("unavailable", new Date()),
    "Local save unavailable",
  );
  assert.equal(
    formatSaveStatusLabel("large", new Date()),
    "Too large to autosave — use Save",
  );
});

test("saved renders the timestamp when present, fallback when not", () => {
  const at = new Date(2026, 6, 14, 14, 41);
  assert.equal(
    formatSaveStatusLabel("saved", at),
    `Saved ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
  );
  assert.equal(formatSaveStatusLabel("saved", null), "Saved locally");
});

test("the chip's unavailable styling covers both blocked states", () => {
  assert.equal(isSaveStateUnavailable("unavailable"), true);
  assert.equal(isSaveStateUnavailable("large"), true);
  assert.equal(isSaveStateUnavailable("saved"), false);
  assert.equal(isSaveStateUnavailable("restoring"), false);
});
