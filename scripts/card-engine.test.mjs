import assert from "node:assert/strict";
import test from "node:test";
import { createCardEngine } from "../src/lib/card-engine.ts";

// Synthetic two-section catalog. "power" carries 14 points so the snap-memory
// eviction cap (12 entries) can be exercised with real configuration keys.
const POWER_POINTS = Array.from({ length: 14 }, (_, index) => `p${index}`);

function grade(name, instruction) {
  return { name, description: `${name} description`, instruction };
}

function illustration(id) {
  return {
    src: `/card-art/test/${id}.webp`,
    alt: `${id} art`,
    motif: `${id} motif`,
    prompt: `${id} prompt`,
    status: "planned",
  };
}

function makeEngine() {
  return createCardEngine({
    sections: ["alpha", "beta"],
    trackIds: ["power", "style"],
    cards: [
      {
        id: "a1",
        code: "A1",
        section: "alpha",
        driver: "power",
        goals: ["goal a1"],
        grades: [grade("a1 g0", "a1 i0"), grade("a1 g1", "a1 i1")],
        illustration: illustration("a1"),
      },
      {
        id: "a2",
        code: "A2",
        section: "alpha",
        driver: "power",
        goals: ["goal a2"],
        grades: [grade("a2 g0", "a2 i0"), grade("a2 g1", "a2 i1")],
        illustration: illustration("a2"),
        affinity: { power: [0, 1] },
      },
      {
        id: "a3",
        code: "A3",
        section: "alpha",
        driver: "power",
        goals: ["goal a3"],
        grades: [grade("a3 g0", "a3 i0"), grade("a3 g1", "a3 i1")],
        illustration: illustration("a3"),
        affinity: { power: [2, 13] },
      },
      {
        id: "b1",
        code: "B1",
        section: "beta",
        driver: "style",
        goals: ["goal b1"],
        grades: [
          grade("b1 g0", "b1 i0"),
          grade("b1 g1", "b1 i1"),
          grade("b1 g2", "b1 i2"),
        ],
        illustration: illustration("b1"),
      },
      {
        id: "b2",
        code: "B2",
        section: "beta",
        driver: "style",
        goals: ["goal b2"],
        grades: [
          grade("b2 g0", "b2 i0"),
          grade("b2 g1", "b2 i1"),
          grade("b2 g2", "b2 i2"),
        ],
        illustration: illustration("b2"),
      },
      {
        id: "b3",
        code: "B3",
        section: "beta",
        driver: "style",
        goals: ["goal b3"],
        grades: [
          grade("b3 g0", "b3 i0"),
          grade("b3 g1", "b3 i1"),
          grade("b3 g2", "b3 i2"),
        ],
        illustration: illustration("b3"),
      },
      {
        id: "b4",
        code: "B4",
        section: "beta",
        driver: "style",
        goals: ["goal b4"],
        grades: [
          grade("b4 g0", "b4 i0"),
          grade("b4 g1", "b4 i1"),
          grade("b4 g2", "b4 i2"),
        ],
        illustration: illustration("b4"),
        affinity: { style: [0, 0] },
      },
    ],
    sectionTracks: { alpha: ["power"], beta: ["style"] },
    slotBudgets: { alpha: 2, beta: 3 },
    trackDefinitions: [
      {
        id: "power",
        label: "Power",
        description: "How hard the deck pushes.",
        points: POWER_POINTS,
      },
      {
        id: "style",
        label: "Style",
        description: "How the deck dresses.",
        points: ["Plain", "Fancy", "Wild"],
      },
    ],
    defaultTrackValues: { power: 1, style: 1 },
    vocabulary: { VKEY: { style: ["V0", "V1", "V2"] } },
    cardFamily: (section) => (section === "alpha" ? "Alpha" : "Beta"),
  });
}

test("section decks filter by section and track affinity", () => {
  const engine = makeEngine();
  assert.deepEqual(
    engine.getSectionDeck("alpha", { power: 0, style: 1 }).map((c) => c.id),
    ["a1", "a2"],
  );
  assert.deepEqual(
    engine.getSectionDeck("alpha", { power: 3, style: 1 }).map((c) => c.id),
    ["a1", "a3"],
  );
  assert.deepEqual(
    engine.getSectionDeck("beta", { power: 0, style: 2 }).map((c) => c.id),
    ["b1", "b2", "b3"],
  );
});

test("card grade follows the driver track and clamps to the last grade", () => {
  const engine = makeEngine();
  const a1 = engine.getLineage("a1");
  assert.equal(engine.getCardGrade(a1, { power: 0, style: 0 }).name, "a1 g0");
  assert.equal(engine.getCardGrade(a1, { power: 1, style: 0 }).name, "a1 g1");
  assert.equal(engine.getCardGrade(a1, { power: 9, style: 0 }).name, "a1 g1");
});

test("track definitions honor vocabulary overrides and reject unknown tracks", () => {
  const engine = makeEngine();
  assert.deepEqual(engine.getTrackDefinition("style", "NONE").points, [
    "Plain",
    "Fancy",
    "Wild",
  ]);
  assert.deepEqual(engine.getTrackDefinition("style", "VKEY").points, [
    "V0",
    "V1",
    "V2",
  ]);
  assert.throws(() => engine.getTrackDefinition("missing", "NONE"), /Unknown/);
  assert.equal(engine.getTrackMax("power"), 13);
  assert.equal(engine.getTrackMax("style"), 2);
});

test("configuration keys serialize only the section's tracks", () => {
  const engine = makeEngine();
  assert.equal(
    engine.getSectionConfigurationKey("alpha", { power: 2, style: 0 }),
    "power:2",
  );
  assert.equal(
    engine.getSectionConfigurationKey("beta", { power: 2, style: 0 }),
    "style:0",
  );
});

test("createEquippedSlots pads every section to its slot budget", () => {
  const engine = makeEngine();
  assert.deepEqual(engine.createEquippedSlots(), {
    alpha: ["", ""],
    beta: ["", "", ""],
  });
  assert.deepEqual(engine.createEquippedSlots({ beta: ["b1"] }), {
    alpha: ["", ""],
    beta: ["b1", "", ""],
  });
});

test("toggle fills the first empty slot, removes on re-toggle, no-ops when full", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem();
  state = { ...state, equipped: engine.createEquippedSlots() };

  state = engine.toggleEquippedCard(state, "alpha", "a1");
  assert.deepEqual(state.equipped.alpha, ["a1", ""]);

  state = engine.toggleEquippedCard(state, "alpha", "a2");
  assert.deepEqual(state.equipped.alpha, ["a1", "a2"]);

  state = engine.toggleEquippedCard(state, "alpha", "a3");
  assert.deepEqual(state.equipped.alpha, ["a1", "a2"]);

  state = engine.toggleEquippedCard(state, "alpha", "a1");
  assert.deepEqual(state.equipped.alpha, ["", "a2"]);
});

test("toggle and place clear the section's suggestion", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem();
  state = {
    ...state,
    equipped: engine.createEquippedSlots(),
    suggested: { alpha: "a3", beta: "b2" },
  };

  state = engine.toggleEquippedCard(state, "alpha", "a1");
  assert.equal(state.suggested.alpha, null);
  assert.equal(state.suggested.beta, "b2");

  state = engine.placeEquippedCard(state, "beta", 1, "b1");
  assert.equal(state.suggested.beta, null);
});

test("placing into a slot shift-inserts and dedupes the moved card", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem();
  state = {
    ...state,
    equipped: engine.createEquippedSlots({ beta: ["b1", "b2", "b3"] }),
  };

  state = engine.placeEquippedCard(state, "beta", 0, "b3");
  assert.deepEqual(state.equipped.beta, ["b3", "b1", "b2"]);
});

test("remove leaves a hole; clear empties the section", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem();
  state = {
    ...state,
    equipped: engine.createEquippedSlots({ beta: ["b1", "b2", "b3"] }),
    suggested: { alpha: null, beta: "b4" },
  };

  state = engine.removeEquippedCard(state, "beta", 1);
  assert.deepEqual(state.equipped.beta, ["b1", "", "b3"]);

  state = engine.clearEquippedCards(state, "beta");
  assert.deepEqual(state.equipped.beta, ["", "", ""]);
  assert.equal(state.suggested.beta, null);
});

test("reconcile keeps suggestions for sections whose configuration is unchanged", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem({ power: 1, style: 1 });
  state = {
    ...state,
    equipped: engine.createEquippedSlots({ alpha: ["a1"] }),
    suggested: { alpha: "a2", beta: "b1" },
  };

  const next = engine.reconcileCardSystem(state, { power: 1, style: 1 });
  assert.equal(next.suggested.alpha, "a2");
  assert.equal(next.suggested.beta, "b1");
  assert.deepEqual(next.equipped, state.equipped);
});

test("reconcile drops incompatible cards and suggests a replacement", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem({ power: 1, style: 1 });
  state = {
    ...state,
    equipped: engine.createEquippedSlots({ alpha: ["a1", "a2"] }),
  };

  const next = engine.reconcileCardSystem(state, { power: 3, style: 1 });
  assert.deepEqual(next.equipped.alpha, ["a1", ""]);
  assert.equal(next.suggested.alpha, "a3");
  // Beta's configuration key did not change, so it is untouched.
  assert.deepEqual(next.equipped.beta, ["", "", ""]);
});

test("reconcile restores a remembered arrangement when returning to a configuration", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem({ power: 1, style: 1 });
  state = {
    ...state,
    equipped: engine.createEquippedSlots({ alpha: ["a2", "a1"] }),
  };

  state = engine.reconcileCardSystem(state, { power: 3, style: 1 });
  assert.deepEqual(state.equipped.alpha, ["", "a1"]);

  state = engine.reconcileCardSystem(state, { power: 1, style: 1 });
  assert.deepEqual(state.equipped.alpha, ["a2", "a1"]);
});

test("snap memory keeps at most 12 configurations per section", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem({ power: 0, style: 1 });
  state = {
    ...state,
    equipped: engine.createEquippedSlots({ alpha: ["a1"] }),
  };

  for (let power = 1; power < 14; power += 1) {
    state = engine.reconcileCardSystem(state, { power, style: 1 });
  }

  const keys = Object.keys(state.memory.alpha);
  assert.equal(keys.length, 12);
  assert.equal(keys.includes("power:0"), false);
  assert.equal(keys.includes("power:12"), true);
});

test("applyRecommendedTracks respects overrides only when asked to", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem({ power: 5, style: 2 });
  state = { ...state, overrides: ["style"] };

  const preserved = engine.applyRecommendedTracks(
    state,
    { power: 0, style: 0 },
    true,
  );
  assert.deepEqual(preserved.tracks, { power: 0, style: 2 });
  assert.deepEqual(preserved.overrides, ["style"]);

  const reset = engine.applyRecommendedTracks(
    state,
    { power: 0, style: 0 },
    false,
  );
  assert.deepEqual(reset.tracks, { power: 0, style: 0 });
  assert.deepEqual(reset.overrides, []);
});

test("setTrackValue records the override once and no-ops on the same value", () => {
  const engine = makeEngine();
  let state = engine.createCardSystem({ power: 1, style: 1 });

  assert.equal(engine.setTrackValue(state, "power", 1), state);

  state = engine.setTrackValue(state, "power", 2);
  state = engine.setTrackValue(state, "power", 3);
  assert.deepEqual(state.overrides, ["power"]);
  assert.equal(state.tracks.power, 3);
});

test("sanitize clamps track values and defaults non-numeric ones", () => {
  const engine = makeEngine();
  const state = engine.sanitizeCardSystemShape({
    tracks: { power: 99, style: 1.6 },
    equipped: { alpha: [], beta: [] },
    overrides: [],
  });
  assert.equal(state.tracks.power, 13);
  assert.equal(state.tracks.style, 2);

  const defaulted = engine.sanitizeCardSystemShape({
    tracks: { power: "loud", style: Number.NaN },
    equipped: { alpha: [], beta: [] },
    overrides: [],
  });
  assert.deepEqual(defaulted.tracks, { power: 1, style: 1 });
});

test("sanitize drops unknown, wrong-section, duplicate, and over-budget cards", () => {
  const engine = makeEngine();
  const state = engine.sanitizeCardSystemShape({
    tracks: { power: 1, style: 1 },
    equipped: {
      alpha: ["a1", "b1", "a1", "ghost", "a2"],
      beta: ["b1", "b2", "b3", "b4"],
    },
    overrides: ["power", "ghostTrack"],
  });
  assert.deepEqual(state.equipped.alpha, ["a1", "a2"]);
  assert.deepEqual(state.equipped.beta, ["b1", "b2", "b3"]);
  assert.deepEqual(state.overrides, ["power"]);
});

test("sanitize degrades a null state to catalog defaults", () => {
  const engine = makeEngine();
  const state = engine.sanitizeCardSystemShape(null);
  assert.deepEqual(state.tracks, { power: 1, style: 1 });
  assert.deepEqual(state.equipped, { alpha: [], beta: [] });
  assert.deepEqual(state.overrides, []);
});

test("equipped instructions follow slot order and skip holes and unknowns", () => {
  const engine = makeEngine();
  const instructions = engine.getEquippedInstructions(
    { alpha: ["", "a1"], beta: ["b2", "ghost", "b1"] },
    { power: 1, style: 2 },
  );
  assert.deepEqual(instructions.alpha, ["a1 i1"]);
  assert.deepEqual(instructions.beta, ["b2 i2", "b1 i2"]);
});

test("createCardSystem copies default tracks instead of sharing them", () => {
  const engine = makeEngine();
  const state = engine.createCardSystem();
  state.tracks.power = 9;
  assert.equal(engine.createCardSystem().tracks.power, 1);
});
