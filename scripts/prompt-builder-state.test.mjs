import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOW_PANEL_INDEX,
  getCraftStepIndexForPanel,
  getCraftStepPanel,
  getNextIncompletePanel,
} from "../src/lib/prompt-navigation.ts";

test("next unfinished moves forward from the current panel", () => {
  assert.equal(
    getNextIncompletePanel(FLOW_PANEL_INDEX.role, [
      true,
      true,
      false,
      false,
      false,
    ]),
    FLOW_PANEL_INDEX.action,
  );
});

test("next unfinished wraps to an earlier incomplete panel", () => {
  assert.equal(
    getNextIncompletePanel(FLOW_PANEL_INDEX.target, [
      false,
      true,
      true,
      true,
      true,
    ]),
    FLOW_PANEL_INDEX.context,
  );
});

test("next unfinished returns null when the prompt is complete", () => {
  assert.equal(
    getNextIncompletePanel(FLOW_PANEL_INDEX.action, [
      true,
      true,
      true,
      true,
      true,
    ]),
    null,
  );
});

test("craft step lookup maps merged panels to steps", () => {
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.context), 0);
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.role), 1);
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.target), 4);
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.guide), -1);
});

test("craft step panel returns the matching panel and falls back to guide", () => {
  assert.equal(getCraftStepPanel(0), FLOW_PANEL_INDEX.context);
  assert.equal(getCraftStepPanel(3), FLOW_PANEL_INDEX.format);
  assert.equal(getCraftStepPanel(4), FLOW_PANEL_INDEX.target);
  assert.equal(getCraftStepPanel(9), FLOW_PANEL_INDEX.guide);
});
