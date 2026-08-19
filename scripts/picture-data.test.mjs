import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPictureArtEntries,
  loadPictureArtTheme,
  pictureArtCoverageErrors,
} from "./generate-picture-art-docs.mjs";
import { loadCatalog, validateCatalog } from "./validate-picture-data.mjs";

const catalogPromise = loadCatalog();
const galleryPromise = loadPictureArtTheme("gallery");

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

// Art moved out of the catalog into the gallery pack; coverage is the pure
// function the validator calls once the pack's draft flag clears.
test("the gallery pack covers every card, grade, and archetype", async () => {
  const catalog = await catalogPromise;
  const pack = structuredClone(await galleryPromise);
  const entries = collectPictureArtEntries(catalog, pack);

  // 100 lineages + 18 archetypes + 1 shared swatch + 300 grade variants
  // + 7 acronym letters for the guide page.
  assert.equal(entries.length, 426);
  // Every derived target is unique.
  assert.equal(new Set(entries.map((entry) => entry.target)).size, 426);
});

test("a pack entry going missing fails coverage once draft clears", async () => {
  const catalog = await catalogPromise;
  const pack = structuredClone(await galleryPromise);
  pack.theme.draft = false;
  pack.theme.style =
    "no text, no letters, no numbers, no logos, no readable symbols, no ui labels, no card frame";
  delete pack.lineages[catalog.cards.cards[0].id];

  const errors = pictureArtCoverageErrors(catalog, pack);
  assert.ok(
    errors.some((error) => error.includes("is missing lineages.")),
    errors.join("\n"),
  );
});

test("an orphan pack entry and a missing no-text rule fail coverage", async () => {
  const catalog = await catalogPromise;
  const pack = structuredClone(await galleryPromise);
  pack.theme.draft = false;
  pack.theme.style = "a pretty style with no rules";
  pack.lineages["not-a-real-card"] = {
    prompt: "orphan",
    alt: "orphan",
    status: "planned",
  };

  const errors = pictureArtCoverageErrors(catalog, pack);
  assert.ok(errors.some((error) => error.includes("orphan entry")));
  assert.ok(errors.some((error) => error.includes("no-text rule")));
});

test("a draft pack is exempt from coverage", async () => {
  const catalog = await catalogPromise;
  const pack = structuredClone(await galleryPromise);
  pack.theme.draft = true;
  delete pack.lineages[catalog.cards.cards[0].id];
  assert.deepEqual(pictureArtCoverageErrors(catalog, pack), []);
});

test("a scenario equipping into the wrong section fails validation", async () => {
  const catalog = structuredClone(await catalogPromise);
  catalog.proofScenarios.scenarios[0].equipped = { tone: ["golden-hour"] };

  await assert.rejects(validateCatalog(catalog), /it is a illumination card/);
});
