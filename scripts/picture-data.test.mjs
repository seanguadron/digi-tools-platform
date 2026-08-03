import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, validateCatalog } from "./validate-picture-data.mjs";

const catalogPromise = loadCatalog();

test("the current picture catalog is valid", async () => {
  await validateCatalog(await catalogPromise);
});

test("catalog counts and invariants", async () => {
  const catalog = await catalogPromise;
  const cards = catalog.cards.cards;

  assert.equal(cards.length, 100);
  assert.equal(catalog.archetypes.archetypes.length, 18);
  assert.equal(catalog.proofScenarios.scenarios.length, 8);

  for (const card of cards) {
    assert.equal(card.grades.length, 3, `${card.id} must carry 3 grades`);
    assert.equal(card.driver, "intensity");
  }

  for (const archetype of catalog.archetypes.archetypes) {
    assert.ok(archetype.effects.length > 0, `${archetype.id} needs effects`);
  }
});

test("per-section card counts match the authored plan", async () => {
  const catalog = await catalogPromise;
  const counts = {};
  for (const card of catalog.cards.cards) {
    counts[card.section] = (counts[card.section] ?? 0) + 1;
  }

  assert.deepEqual(counts, {
    protagonist: 12,
    illumination: 12,
    canvas: 14,
    tone: 12,
    universe: 14,
    references: 20,
    execution: 16,
  });
});

test("duplicate card ids fail validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.cards.cards.push(catalog.cards.cards[0]);

  await assert.rejects(validateCatalog(catalog), /Duplicate card id/);
});

test("an archetype referencing an unknown card fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.archetypes.archetypes[0].equipped.canvas = ["ghost-card"];

  await assert.rejects(validateCatalog(catalog), /unknown card ghost-card/);
});

test("an equipped card outside its affinity fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  // neon-saturation carries affinity intensity [1, 2]; forcing the archetype
  // to Subtle must trip the compatibility check.
  const noir = catalog.archetypes.archetypes.find(
    (archetype) => archetype.id === "neon-noir",
  );
  noir.tracks.intensity = 0;

  await assert.rejects(validateCatalog(catalog), /outside its affinity/);
});

test("intensity beyond the last snap fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.archetypes.archetypes[0].tracks.intensity = 3;

  await assert.rejects(validateCatalog(catalog), /must be <= 2/);
});

test("a wrong illustration prefix fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.cards.cards[0].illustration.src = "/card-art/cards/wrong-home.webp";

  await assert.rejects(validateCatalog(catalog), /pattern|\/card-art\/picture\//);
});

test("a duplicate illustration path fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.cards.cards[1].illustration.src =
    catalog.cards.cards[0].illustration.src;

  await assert.rejects(validateCatalog(catalog), /Duplicate illustration path/);
});

test("an illustration prompt without the no-text rule fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.cards.cards[0].illustration.prompt = "a pretty picture";

  await assert.rejects(validateCatalog(catalog), /no-text rule/);
});

test("a scenario equipping into the wrong section fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.proofScenarios.scenarios[0].equipped = { tone: ["golden-hour"] };

  await assert.rejects(validateCatalog(catalog), /it is a illumination card/);
});
