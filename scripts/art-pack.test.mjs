import assert from "node:assert/strict";
import test from "node:test";
import {
  ArtPackKeyError,
  artKeyFor,
  artPackEntry,
  artPathFor,
  artRelativePath,
  isArtPackEntry,
  parseArtKey,
} from "./art-pack.mjs";
import { collectCraftArtEntries, loadArtTheme } from "./generate-craft-art-docs.mjs";
import { loadPromptCatalog } from "./prompt-data-files.mjs";

test("a path is a pure function of the pack id and the entry key", () => {
  assert.equal(
    artPathFor("sci-fi", "roles.researcher"),
    "/card-art/sci-fi/roles/researcher.webp",
  );
  assert.equal(
    artPathFor("sci-fi", "lineages.context-scope"),
    "/card-art/sci-fi/cards/context-scope/lineage.webp",
  );
  // A lineage and its grades share a folder: same card, different intensities.
  assert.equal(
    artPathFor("sci-fi", "grades.context-scope[0]"),
    "/card-art/sci-fi/cards/context-scope/grade-01.webp",
  );
  assert.equal(
    artPathFor("sci-fi", "grades.context-scope[3]"),
    "/card-art/sci-fi/cards/context-scope/grade-04.webp",
  );
  assert.equal(
    artPathFor("sci-fi", "archetypes.executive-summary"),
    "/card-art/sci-fi/archetypes/executive-summary.webp",
  );
  assert.equal(artPathFor("sci-fi", "craft.T"), "/card-art/sci-fi/craft/letter-t.webp");
  // Shared swatches keep their own folder so they can never collide with a
  // real card whose id happens to match.
  assert.equal(
    artPathFor("sci-fi", "shared.custom-preset"),
    "/card-art/sci-fi/shared/custom-preset.webp",
  );
});

test("a second pack lands beside the first with nothing else changing", () => {
  for (const key of [
    "roles.researcher",
    "lineages.context-scope",
    "grades.context-scope[2]",
    "archetypes.executive-summary",
    "craft.C",
    "shared.custom-preset",
  ]) {
    const sci = artPathFor("sci-fi", key);
    const fantasy = artPathFor("fantasy", key);
    assert.notEqual(sci, fantasy);
    assert.equal(fantasy, sci.replace("/card-art/sci-fi/", "/card-art/fantasy/"));
    // The pack-relative half is identical, which is what makes a pack a
    // drop-in world rather than a migration.
    assert.equal(artRelativePath("fantasy", key), artRelativePath("sci-fi", key));
  }
});

test("renaming a card in the studio cannot orphan its art", async () => {
  const catalog = await loadPromptCatalog();
  const theme = await loadArtTheme("sci-fi");
  const before = collectCraftArtEntries(catalog, theme).map((entry) => entry.target);

  // Every field the Card Studio's Card tab lets an owner edit, rewritten.
  const renamed = structuredClone(catalog);
  for (const role of renamed.roles.roles) {
    role.name = `${role.name} (renamed)`;
    role.description = "rewritten";
  }
  for (const card of renamed.cards.cards) {
    for (const grade of card.grades) {
      grade.name = `${grade.name} (renamed)`;
      grade.description = "rewritten";
    }
  }
  for (const archetype of renamed.archetypes.archetypes) {
    archetype.name = `${archetype.name} (renamed)`;
  }
  for (const part of renamed.builder.craftParts) {
    part.label = `${part.label} (renamed)`;
  }

  assert.deepEqual(
    collectCraftArtEntries(renamed, theme).map((entry) => entry.target),
    before,
  );
});

test("malformed keys are refused rather than resolved", () => {
  for (const key of [
    "",
    "roles",
    "roles.",
    "nope.researcher",
    "roles../../../etc/passwd",
    "roles.Researcher",
    "roles.a_b",
    "grades.context-scope",
    "grades.context-scope[]",
    "craft.CC",
    "craft.c",
  ]) {
    assert.throws(() => artPathFor("sci-fi", key), ArtPackKeyError, `accepted ${key}`);
  }
  assert.throws(() => artPathFor("../escape", "roles.researcher"), ArtPackKeyError);
});

test("parseArtKey and artKeyFor round-trip", () => {
  assert.deepEqual(parseArtKey("grades.context-scope[3]"), {
    group: "grades",
    id: "context-scope",
    index: 3,
  });
  assert.deepEqual(parseArtKey("roles.researcher"), {
    group: "roles",
    id: "researcher",
    index: null,
  });
  assert.equal(artKeyFor("grades", "context-scope", 3), "grades.context-scope[3]");
  assert.equal(artKeyFor("roles", "researcher"), "roles.researcher");
});

test("only a complete entry counts as one", () => {
  const good = { prompt: "p", alt: "a", status: "planned" };
  assert.ok(isArtPackEntry(good));
  assert.ok(isArtPackEntry({ ...good, bio: "b" }));
  assert.ok(!isArtPackEntry(null));
  assert.ok(!isArtPackEntry("a paragraph"));
  assert.ok(!isArtPackEntry({ ...good, status: "done" }));
  assert.ok(!isArtPackEntry({ ...good, bio: 12 }));
  assert.ok(!isArtPackEntry({ prompt: "p", status: "planned" }));
});

test("resolving an entry carries the derived path, never a stored one", async () => {
  const theme = await loadArtTheme("sci-fi");
  const resolved = artPackEntry(theme, "roles.researcher");

  assert.equal(resolved.src, "/card-art/sci-fi/roles/researcher.webp");
  assert.equal(resolved.status, "generated");
  assert.ok(resolved.prompt.includes("xenoarchivist"));
  // A pack file has no `src` to read - the path can only have been derived.
  assert.equal(theme.roles.researcher.src, undefined);
});

test("a half-authored pack renders placeholders instead of crashing", async () => {
  const theme = structuredClone(await loadArtTheme("sci-fi"));
  delete theme.roles.researcher;

  assert.equal(artPackEntry(theme, "roles.researcher"), undefined);
  assert.equal(artPackEntry(theme, "roles.not-a-role"), undefined);
  assert.equal(artPackEntry(theme, "garbage"), undefined);
});

test("every entry the catalog owes resolves to a unique webp", async () => {
  const entries = collectCraftArtEntries(
    await loadPromptCatalog(),
    await loadArtTheme("sci-fi"),
  );

  assert.equal(entries.length, 226);
  assert.equal(new Set(entries.map((entry) => entry.target)).size, 226);
  for (const entry of entries) {
    assert.equal(entry.target, artPathFor("sci-fi", entry.key));
    assert.ok(entry.target.endsWith(".webp"));
  }
});
