import assert from "node:assert/strict";
import test from "node:test";
import {
  CardRecordError,
  applyCardEdits,
  catalogKeyForEntry,
  readCardRecord,
} from "./card-record.mjs";
import { loadPromptCatalog } from "./prompt-data-files.mjs";
import { validateCatalog } from "./validate-prompt-data.mjs";

const catalogPromise = loadPromptCatalog();

test("a record reads its editable fields and its structural ones", async () => {
  const record = readCardRecord(await catalogPromise, "roles.researcher");

  assert.equal(record.kind, "Role");
  assert.equal(record.hasRecord, true);
  assert.deepEqual(
    record.fields.map((field) => field.id),
    ["name", "description", "ability.summary", "ability.bullets"],
  );
  assert.equal(record.fields[0].value, "Researcher");
  assert.ok(Array.isArray(record.fields[3].value));
  // Identity is shown but never offered as a field.
  assert.ok(record.structural.some((item) => item.label === "Id"));
  assert.ok(!record.fields.some((field) => field.id === "id"));
});

test("every group a card can belong to resolves", async () => {
  const catalog = await catalogPromise;
  for (const key of [
    "roles.researcher",
    "lineages.context-scope",
    "grades.context-scope[0]",
    "archetypes.executive-summary",
    "craft.C",
  ]) {
    const record = readCardRecord(catalog, key);
    assert.equal(record.hasRecord, true, `${key} had no record`);
    assert.ok(record.fields.length > 0, `${key} had no editable fields`);
  }

  // A shared swatch is interface chrome, not a card: no record, and the studio
  // says so rather than throwing.
  const shared = readCardRecord(catalog, "shared.custom-preset");
  assert.equal(shared.hasRecord, false);
  assert.deepEqual(shared.fields, []);
});

test("an edit returns a new catalog and leaves the original alone", async () => {
  const catalog = await catalogPromise;
  const next = applyCardEdits(catalog, "roles.researcher", {
    name: "  Renamed  ",
  });

  assert.equal(next.roles.roles[0].name, "Renamed", "not trimmed or not applied");
  assert.equal(
    catalog.roles.roles[0].name,
    "Researcher",
    "applyCardEdits mutated the catalog it was handed",
  );
});

test("only the fields in the table can be reached", async () => {
  const catalog = await catalogPromise;

  // Identity, references, and structure are readable and never writable,
  // because other records point at them.
  for (const id of ["id", "code", "section", "driver", "affinity", "roleIds", "core"]) {
    assert.throws(
      () => applyCardEdits(catalog, "roles.researcher", { [id]: "x" }),
      CardRecordError,
      `${id} was writable`,
    );
  }
  assert.throws(
    () => applyCardEdits(catalog, "archetypes.executive-summary", { tracks: "x" }),
    CardRecordError,
  );
  // Nor by shape: a list field will not take a bare string, and text will not
  // take an object.
  assert.throws(
    () => applyCardEdits(catalog, "roles.researcher", { "ability.bullets": "one" }),
    CardRecordError,
  );
  assert.throws(
    () => applyCardEdits(catalog, "roles.researcher", { name: { toString: 1 } }),
    CardRecordError,
  );
  assert.throws(
    () => applyCardEdits(catalog, "roles.researcher", { "ability.bullets": ["", " "] }),
    /cannot be empty/,
  );
});

// The keystone: the studio's save gate is the build's own validator, so an
// edit that would break the build cannot land.
test("a breaking edit is refused by the real build validator", async () => {
  const catalog = await catalogPromise;

  const tooMany = applyCardEdits(catalog, "roles.researcher", {
    "ability.bullets": ["a", "b", "c", "d", "e", "f", "g"],
  });
  await assert.rejects(() => validateCatalog(tooMany), /must NOT have more than 6 items/);

  const blank = applyCardEdits(catalog, "roles.researcher", { name: "" });
  await assert.rejects(() => validateCatalog(blank), /fewer than 1 characters/);

  // And an ordinary edit still passes, so the gate is not simply refusing
  // everything.
  const fine = applyCardEdits(catalog, "roles.researcher", { name: "Researcher II" });
  await assert.doesNotReject(() => validateCatalog(fine));
});

test("each group knows which catalog file it would be written to", () => {
  assert.equal(catalogKeyForEntry("roles.researcher"), "roles");
  assert.equal(catalogKeyForEntry("lineages.context-scope"), "cards");
  assert.equal(catalogKeyForEntry("grades.context-scope[2]"), "cards");
  assert.equal(catalogKeyForEntry("archetypes.executive-summary"), "archetypes");
  assert.equal(catalogKeyForEntry("craft.C"), "builder");
  // No catalog file, so the store refuses the save rather than guessing.
  assert.equal(catalogKeyForEntry("shared.custom-preset"), null);
});
