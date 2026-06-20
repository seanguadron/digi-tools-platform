import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, validateCatalog } from "./validate-prompt-data.mjs";

function clone(value) {
  return structuredClone(value);
}

test("the current prompt catalog is valid", async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.roles.roles.length, 35);
  assert.ok(
    catalog.cards.cards.every(
      (card) => card.goals.length >= 1 && card.goals.length <= 6,
    ),
  );
  assert.ok(catalog.roles.roles.every((role) => role.illustration));
  assert.ok(
    catalog.roles.roles.every(
      (role) => role.ability.bullets.length >= 1 && role.ability.bullets.length <= 6,
    ),
  );
  assert.equal(
    catalog.cards.cards.flatMap((card) => card.grades).filter((grade) => grade.illustration)
      .length,
    108,
  );
  assert.ok(catalog.archetypes.archetypes.every((archetype) => archetype.effects.length > 0));

  await assert.doesNotReject(async () => {
    await validateCatalog(catalog);
  });
});

test("duplicate IDs fail validation", async () => {
  const catalog = await loadCatalog();
  const invalid = clone(catalog);
  invalid.roles.roles[1].id = invalid.roles.roles[0].id;

  await assert.rejects(
    () => validateCatalog(invalid),
    /Duplicate role id: researcher/,
  );
});

test("broken scenario references fail validation", async () => {
  const catalog = await loadCatalog();
  const invalid = clone(catalog);
  invalid.proofScenarios.scenarios[0].roles[0] = "missing-role";

  await assert.rejects(
    () => validateCatalog(invalid),
    /references unknown role missing-role/,
  );
});

test("track values cannot exceed their snap points", async () => {
  const catalog = await loadCatalog();
  const invalid = clone(catalog);
  invalid.tracks.defaultValues.practicality = 4;

  await assert.rejects(
    () => validateCatalog(invalid),
    /practicality uses snap 4, but the track ends at 2/,
  );
});

test("duplicate illustration paths fail validation", async () => {
  const catalog = await loadCatalog();
  const invalid = clone(catalog);
  invalid.roles.roles[1].illustration.src = invalid.roles.roles[0].illustration.src;

  await assert.rejects(
    () => validateCatalog(invalid),
    /Duplicate illustration path: \/card-art\/roles\/researcher\.webp/,
  );
});

test("illustration prompts must ban embedded text", async () => {
  const catalog = await loadCatalog();
  const invalid = clone(catalog);
  invalid.archetypes.archetypes[0].illustration.prompt = "Draw a card.";

  await assert.rejects(
    () => validateCatalog(invalid),
    /illustration prompt is missing the image-only no-text rule/,
  );
});
