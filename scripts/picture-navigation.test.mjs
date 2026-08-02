import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextIncompletePicturePanel,
  getPictureStepIndexForPanel,
  getPictureStepPanel,
  PICTURE_PANEL_COUNT,
  PICTURE_PANEL_INDEX,
} from "../src/lib/picture-navigation.ts";

test("eight panels: guide plus the seven letters in order", () => {
  assert.equal(PICTURE_PANEL_COUNT, 8);
  assert.equal(PICTURE_PANEL_INDEX.guide, 0);
  assert.equal(PICTURE_PANEL_INDEX.protagonist, 1);
  assert.equal(PICTURE_PANEL_INDEX.execution, 7);
});

test("step and panel indices convert both ways", () => {
  assert.equal(getPictureStepIndexForPanel(PICTURE_PANEL_INDEX.guide), -1);
  assert.equal(getPictureStepIndexForPanel(PICTURE_PANEL_INDEX.canvas), 2);
  assert.equal(getPictureStepPanel(0), PICTURE_PANEL_INDEX.protagonist);
  assert.equal(getPictureStepPanel(6), PICTURE_PANEL_INDEX.execution);
  assert.equal(getPictureStepPanel(99), PICTURE_PANEL_INDEX.guide);
});

test("next unfinished wraps around and returns null when complete", () => {
  const none = Array.from({ length: 7 }, () => true);
  assert.equal(getNextIncompletePicturePanel(3, none), null);

  const toneOnly = none.map((_, index) => index !== 3);
  assert.equal(
    getNextIncompletePicturePanel(PICTURE_PANEL_INDEX.universe, toneOnly),
    PICTURE_PANEL_INDEX.tone,
  );
  assert.equal(
    getNextIncompletePicturePanel(PICTURE_PANEL_INDEX.guide, toneOnly),
    PICTURE_PANEL_INDEX.tone,
  );
});
