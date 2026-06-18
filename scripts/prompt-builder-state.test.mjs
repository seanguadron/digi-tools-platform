import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOW_PANEL_INDEX,
  getCraftStepIndexForPanel,
  getLegacyProofPanel,
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
    getNextIncompletePanel(FLOW_PANEL_INDEX.targetCards, [
      false,
      true,
      true,
      true,
      true,
    ]),
    FLOW_PANEL_INDEX.contextWrite,
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

test("craft step lookup keeps context and target subpages grouped", () => {
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.contextWrite), 0);
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.contextCards), 0);
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.targetWrite), 4);
  assert.equal(getCraftStepIndexForPanel(FLOW_PANEL_INDEX.targetCards), 4);
});

test("legacy proof scenario panels open the matching card workbench", () => {
  assert.equal(getLegacyProofPanel(1), FLOW_PANEL_INDEX.contextCards);
  assert.equal(getLegacyProofPanel(2), FLOW_PANEL_INDEX.role);
  assert.equal(getLegacyProofPanel(5), FLOW_PANEL_INDEX.targetCards);
});
