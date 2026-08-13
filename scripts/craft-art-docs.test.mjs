import assert from "node:assert/strict";
import test from "node:test";
import {
  ART_THEME_IDS,
  collectCraftArtEntries,
  craftArtCoverageErrors,
  loadArtTheme,
  renderCraftArtDoc,
} from "./generate-craft-art-docs.mjs";
import { loadPromptCatalog } from "./prompt-data-files.mjs";

const catalogPromise = loadPromptCatalog();
const themePromise = loadArtTheme("sci-fi");

function clone(value) {
  return structuredClone(value);
}

test("every shipped art pack covers the catalog with no orphans", async () => {
  const catalog = await catalogPromise;

  for (const themeId of ART_THEME_IDS) {
    const theme = await loadArtTheme(themeId);
    assert.deepEqual(craftArtCoverageErrors(catalog, theme), []);
  }
});

test("the pack owes 226 images: 98 core, then 128 per-grade variants", async () => {
  const entries = collectCraftArtEntries(await catalogPromise, await themePromise);

  assert.equal(entries.length, 226);
  assert.equal(entries.filter((entry) => !entry.later).length, 98);
  assert.equal(entries.filter((entry) => entry.later).length, 128);
});

test("the acronym leads and every target sits under the theme path", async () => {
  const entries = collectCraftArtEntries(await catalogPromise, await themePromise);

  assert.deepEqual(
    entries.slice(0, 5).map((entry) => entry.name),
    ["Context", "Role", "Action", "Format", "Target audience"],
  );
  for (const entry of entries) {
    assert.ok(
      entry.target.startsWith("/card-art/sci-fi/"),
      `${entry.key} points outside the pack: ${entry.target}`,
    );
    assert.ok(entry.target.endsWith(".webp"), `${entry.key} is not a webp`);
  }
  assert.equal(new Set(entries.map((e) => e.target)).size, entries.length);
});

test("rendered prompts carry no generator flags and pair both paragraphs", async () => {
  const rendered = renderCraftArtDoc(
    await catalogPromise,
    await themePromise,
  );

  // Seedream takes plain prose; the aspect ratio is a UI control there.
  assert.ok(!rendered.includes("--ar"), "rendered doc leaked a Midjourney flag");
  assert.ok(!rendered.includes("--stylize"));
  assert.equal((rendered.match(/^#### \d{3}\./gm) ?? []).length, 226);

  const style = (await themePromise).theme.style;
  // One copy of the style paragraph per entry, plus the standalone one in
  // the shared art direction section.
  assert.equal(rendered.split(style).length - 1, 227);
});

test("a missing paragraph fails coverage", async () => {
  const theme = clone(await themePromise);
  delete theme.roles.researcher;

  assert.deepEqual(craftArtCoverageErrors(await catalogPromise, theme), [
    "sci-fi art pack is missing roles.researcher",
  ]);
});

test("an entry for a card that no longer exists fails coverage", async () => {
  const theme = clone(await themePromise);
  theme.archetypes["ghost-archetype"] = "A ghost.";

  assert.deepEqual(craftArtCoverageErrors(await catalogPromise, theme), [
    "sci-fi art pack has an orphan entry archetypes.ghost-archetype",
  ]);
});

test("a style paragraph without the no-text rule fails coverage", async () => {
  const theme = clone(await themePromise);
  theme.theme.style = "Some pretty sci-fi art.";

  assert.deepEqual(craftArtCoverageErrors(await catalogPromise, theme), [
    "sci-fi art pack style paragraph is missing the image-only no-text rule",
  ]);
});
