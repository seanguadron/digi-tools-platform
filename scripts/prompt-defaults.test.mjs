import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAudienceDefaultLine,
  CONTEXT_DEFAULT_TEXT,
} from "../src/lib/prompt-defaults.ts";

test("the context default defers to the accompanying request", () => {
  assert.equal(
    CONTEXT_DEFAULT_TEXT,
    "The working context is provided outside this file. Treat the request that accompanies this prompt as the task context. If no context accompanies it, ask what the user is working on before proceeding.",
  );
});

test("an archetype assumption lands after the otherwise-assume lead", () => {
  assert.equal(
    buildAudienceDefaultLine(
      "a busy decision-maker who reads the bottom line first and skims the rest.",
    ),
    "If the accompanying request names an audience, write for them. Otherwise assume: a busy decision-maker who reads the bottom line first and skims the rest.",
  );
});

test("no assumption falls back to infer-and-state", () => {
  const generic =
    "If the accompanying request names an audience, write for them. Otherwise infer the most likely audience, state your assumption in one line, and proceed.";
  assert.equal(buildAudienceDefaultLine(null), generic);
  assert.equal(buildAudienceDefaultLine(undefined), generic);
  assert.equal(buildAudienceDefaultLine("   "), generic);
});
