import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CardArtError, createCardArtStore } from "./card-art-store.mjs";
import { projectRoot } from "./prompt-data-files.mjs";
import { artPackShapeErrors } from "./validate-prompt-data.mjs";

// A 1x1 png and webp, enough to prove bytes land where they should.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const WEBP = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";

const ROLE_KEY = "roles.researcher";

const PACK_RELATIVE = path.join(
  "src",
  "data",
  "prompt-builder",
  "art-themes",
  "sci-fi.json",
);

async function makeStore() {
  const root = await mkdtemp(path.join(os.tmpdir(), "card-art-"));
  // The status flip edits the art pack, so give the temp root a real copy.
  await mkdir(path.join(root, path.dirname(PACK_RELATIVE)), { recursive: true });
  const source = await readFile(path.join(projectRoot, PACK_RELATIVE), "utf8");
  // Normalize to "planned" so these tests describe the store's behavior
  // rather than however much art has actually been generated so far.
  await writeFile(
    path.join(root, PACK_RELATIVE),
    source.replaceAll('"status": "generated"', '"status": "planned"'),
    "utf8",
  );
  const store = createCardArtStore({ root, regenerateDocs: false });
  return { root, store, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function readPack(root) {
  return JSON.parse(await readFile(path.join(root, PACK_RELATIVE), "utf8"));
}

function catalogPath(root, file) {
  return path.join(root, "src", "data", "prompt-builder", file);
}

function generatedKeys(pack) {
  const keys = [];
  for (const group of ["craft", "roles", "lineages", "archetypes", "shared"]) {
    for (const [id, entry] of Object.entries(pack[group])) {
      if (entry.status === "generated") keys.push(`${group}.${id}`);
    }
  }
  for (const [id, grades] of Object.entries(pack.grades)) {
    grades.forEach((entry, index) => {
      if (entry.status === "generated") keys.push(`grades.${id}[${index}]`);
    });
  }
  return keys;
}

test("entries come from the catalog with their file names and prompts", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const manifest = await store.listEntries("sci-fi");

    assert.equal(manifest.entries.length, 226);
    assert.equal(manifest.progress.total, 226);
    const researcher = manifest.entries.find((entry) => entry.key === ROLE_KEY);
    assert.equal(researcher.fileName, "SCI-006-Researcher.png");
    assert.equal(researcher.target, "/card-art/sci-fi/roles/researcher.webp");
    assert.ok(researcher.prompt.includes("xenoarchivist"));
    assert.deepEqual(researcher.variants, []);
  } finally {
    await cleanup();
  }
});

test("variants take the next free letter and keep the pasted bytes", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const first = await store.addVariant("sci-fi", ROLE_KEY, PNG);
    const second = await store.addVariant("sci-fi", ROLE_KEY, PNG);

    assert.equal(first.file, "SCI-006-Researcher-a.png");
    assert.equal(second.file, "SCI-006-Researcher-b.png");

    const read = await store.readVariantFile("sci-fi", ROLE_KEY, "b");
    assert.equal(read.file, "SCI-006-Researcher-b.png");
    assert.ok(read.bytes.byteLength > 0);
  } finally {
    await cleanup();
  }
});

test("a crop is a copy: the original variant survives untouched", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    const crop = await store.saveCrop("sci-fi", ROLE_KEY, "a", PNG);

    assert.equal(crop.file, "SCI-006-Researcher-a_cropped.png");
    assert.equal(crop.id, "a_cropped");

    const dir = path.join(root, "card-art-source", "sci-fi", "roles", "researcher");
    assert.ok(existsSync(path.join(dir, "SCI-006-Researcher-a.png")), "original was removed");

    const manifest = await store.listEntries("sci-fi");
    const entry = manifest.entries.find((e) => e.key === ROLE_KEY);
    assert.deepEqual(entry.variants.map((v) => v.id), ["a", "a_cropped"]);

    // A crop of a crop is refused; crops always derive from the original.
    await assert.rejects(
      () => store.saveCrop("sci-fi", ROLE_KEY, "a_cropped", PNG),
      /Crop the original/,
    );
  } finally {
    await cleanup();
  }
});

test("deleting a variant frees its letter for reuse", async () => {
  const { store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await store.deleteVariant("sci-fi", ROLE_KEY, "a");

    const next = await store.addVariant("sci-fi", ROLE_KEY, PNG);
    assert.equal(next.letter, "a");
  } finally {
    await cleanup();
  }
});

test("selecting writes the live webp and flips the pack status", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    const result = await store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP);

    assert.equal(result.target, "/card-art/sci-fi/roles/researcher.webp");
    assert.equal(result.statusChanged, true);

    const live = path.join(root, "public", "card-art", "sci-fi", "roles", "researcher.webp");
    assert.ok(existsSync(live), "live webp was not written");

    // Only the targeted entry moved, and only in the pack.
    assert.deepEqual(generatedKeys(await readPack(root)), [ROLE_KEY]);
  } finally {
    await cleanup();
  }
});

test("the art workflow never touches a catalog file", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP);
    await store.clearLive("sci-fi", ROLE_KEY);

    // The fixture seeds ONLY the pack. If any of the above reached for a
    // catalog it would have had to create one, so absence is the proof.
    // (saveCard writes one BY DESIGN — covered separately below.)
    for (const file of ["roles.json", "cards.json", "archetypes.json"]) {
      assert.equal(existsSync(catalogPath(root, file)), false, `wrote ${file}`);
    }
  } finally {
    await cleanup();
  }
});

test("clearing removes the live file and returns the status to planned", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP);
    await store.clearLive("sci-fi", ROLE_KEY);

    const live = path.join(root, "public", "card-art", "sci-fi", "roles", "researcher.webp");
    assert.equal(existsSync(live), false, "live webp survived the clear");
    assert.deepEqual(generatedKeys(await readPack(root)), []);
  } finally {
    await cleanup();
  }
});

test("the live image must be webp, whatever the variant was", async () => {
  const { store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await assert.rejects(
      () => store.selectVariant("sci-fi", ROLE_KEY, "a", PNG),
      /must be webp/,
    );
  } finally {
    await cleanup();
  }
});

test("unknown themes, keys, and variants are refused", async () => {
  const { store, cleanup } = await makeStore();
  try {
    // A name no pack will ever have, so this stays true when the roadmap
    // packs are scaffolded for real.
    await assert.rejects(() => store.listEntries("no-such-world"), /Unknown art theme/);
    await assert.rejects(
      () => store.addVariant("sci-fi", "roles.does-not-exist", PNG),
      /Unknown card art entry/,
    );
    await assert.rejects(
      () => store.readVariantFile("sci-fi", ROLE_KEY, "z"),
      /Unknown variant/,
    );
    // A key shaped like a path must not become one.
    await assert.rejects(
      () => store.addVariant("sci-fi", "../../etc/passwd", PNG),
      /Unknown card art entry/,
    );
    await assert.rejects(
      () => store.readVariantFile("sci-fi", ROLE_KEY, "../../../secret"),
      /Unknown variant/,
    );
  } finally {
    await cleanup();
  }
});

test("only png, jpeg, and webp data URLs are accepted", async () => {
  const { store, cleanup } = await makeStore();
  try {
    for (const payload of [
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "https://example.com/image.png",
      "",
    ]) {
      await assert.rejects(
        () => store.addVariant("sci-fi", ROLE_KEY, payload),
        (error) => error instanceof CardArtError,
        `accepted a bad payload: ${payload}`,
      );
    }
  } finally {
    await cleanup();
  }
});

test("every derived path stays inside its own root", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    const manifest = await store.listEntries("sci-fi");
    for (const entry of manifest.entries) {
      const dir = store.variantDir("sci-fi", entry);
      const live = store.livePath("sci-fi", entry);
      assert.ok(
        dir.startsWith(path.join(root, "card-art-source")),
        `variant dir escaped: ${dir}`,
      );
      assert.ok(live.startsWith(path.join(root, "public")), `live path escaped: ${live}`);
    }
  } finally {
    await cleanup();
  }
});

test("a pack whose entry is missing fails loudly instead of writing", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);

    // The manifest still owes this image (the catalog says so), but the pack
    // it would be written into no longer describes it.
    const pack = await readPack(root);
    delete pack.roles.researcher;
    await writeFile(
      path.join(root, PACK_RELATIVE),
      JSON.stringify(pack, null, 2),
      "utf8",
    );

    await assert.rejects(
      () => store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP),
      /Could not find roles\.researcher/,
    );
  } finally {
    await cleanup();
  }
});

// --- the Card tab: catalog edits through the store -------------------------

test("saveCard writes only its own catalog file, and only what changed", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    const saved = await store.saveCard(ROLE_KEY, { name: "Researcher II" });
    assert.equal(saved.fields.find((f) => f.id === "name").value, "Researcher II");

    const roles = JSON.parse(await readFile(catalogPath(root, "roles.json"), "utf8"));
    assert.equal(roles.roles.find((r) => r.id === "researcher").name, "Researcher II");
    // Untouched siblings are never written, so a save is a one-file diff.
    for (const file of ["cards.json", "archetypes.json", "builder.json"]) {
      assert.equal(existsSync(catalogPath(root, file)), false, `also wrote ${file}`);
    }
  } finally {
    await cleanup();
  }
});

// The safety keystone, exercised through the writer rather than the pure
// helper: a rejected edit must leave the disk exactly as it was.
test("a save the build validator rejects writes nothing at all", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await assert.rejects(
      () => store.saveCard(ROLE_KEY, { "ability.bullets": ["a", "b", "c", "d", "e", "f", "g"] }),
      /must NOT have more than 6 items/,
    );
    assert.equal(existsSync(catalogPath(root, "roles.json")), false);

    // Same for a field outside the writable table, and for one over the
    // length ceiling.
    await assert.rejects(() => store.saveCard(ROLE_KEY, { id: "hacked" }), /no editable field/);
    await assert.rejects(
      () => store.saveCard(ROLE_KEY, { name: "x".repeat(5000) }),
      /characters or fewer/,
    );
    assert.equal(existsSync(catalogPath(root, "roles.json")), false);
  } finally {
    await cleanup();
  }
});

test("a card with no catalog record is refused rather than guessed at", async () => {
  const { store, cleanup } = await makeStore();
  try {
    await assert.rejects(
      () => store.saveCard("shared.custom-preset", { name: "x" }),
      /no catalog record/,
    );
    const record = await store.readCard("shared.custom-preset");
    assert.equal(record.hasRecord, false);
  } finally {
    await cleanup();
  }
});

// --- bios ------------------------------------------------------------------

test("setBio round-trips through the pack and enforces the panel's ceiling", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.setBio("sci-fi", ROLE_KEY, "  A short bio.  ");
    assert.equal((await readPack(root)).roles.researcher.bio, "A short bio.");

    // Emptying it removes the key rather than storing "".
    await store.setBio("sci-fi", ROLE_KEY, "   ");
    assert.equal("bio" in (await readPack(root)).roles.researcher, false);

    await assert.rejects(
      () => store.setBio("sci-fi", ROLE_KEY, "x".repeat(241)),
      /241|characters or fewer/,
    );
    // Two different ways a key can be wrong, and setBio has to refuse both.
    // A key the CATALOG does not own is rejected first, by the same
    // cross-reference every other write op runs - so a bio can never land on
    // a pack record the catalog has stopped owning.
    await assert.rejects(
      () => store.setBio("sci-fi", "roles.not-a-role", "hi"),
      (error) => error.status === 404 && /Unknown card art entry/.test(error.message),
    );
    // A key the catalog DOES own but the pack has no record for.
    const pack = await readPack(root);
    delete pack.roles.researcher;
    await writeFile(
      path.join(root, PACK_RELATIVE),
      JSON.stringify(pack, null, 2),
      "utf8",
    );
    await assert.rejects(
      () => store.setBio("sci-fi", ROLE_KEY, "hi"),
      (error) => error.status === 404 && /Could not find/.test(error.message),
    );
    // And a malformed key answers 400, not an uncaught 500.
    await assert.rejects(
      () => store.setBio("sci-fi", "not a valid key", "hi"),
      (error) => error.status === 404 || error.status === 400,
    );
  } finally {
    await cleanup();
  }
});

// --- worlds ----------------------------------------------------------------

test("listPacks reports what exists and how far along it is", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const packs = await store.listPacks();
    const sciFi = packs.find((pack) => pack.id === "sci-fi");
    assert.equal(sciFi.installed, true);
    assert.equal(sciFi.total, 226);
    // The fixture normalizes every status to planned.
    assert.equal(sciFi.generated, 0);
    // The roadmap packs are listed even though they do not exist yet.
    assert.ok(packs.some((pack) => pack.id === "fantasy" && !pack.installed));
  } finally {
    await cleanup();
  }
});

test("scaffolding a world produces a pack that itself validates", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    const result = await store.scaffoldPack("fantasy");
    assert.equal(result.entries, 226);

    const file = path.join(root, "src", "data", "prompt-builder", "art-themes", "fantasy.json");
    const pack = JSON.parse(await readFile(file, "utf8"));
    assert.equal(pack.theme.draft, true, "a new world must land as a draft");
    assert.equal(Object.keys(pack.roles).length, 35);
    assert.equal(Object.keys(pack.grades).length, 32);
    // scaffoldPack runs the pack schema over what it built before writing, so
    // reaching here at all is the shape assertion.
    assert.deepEqual(await artPackShapeErrors(pack), []);

    const packs = await store.listPacks();
    assert.ok(packs.find((entry) => entry.id === "fantasy").draft);
  } finally {
    await cleanup();
  }
});

// Two clicks racing to create the same brand-new world: the check and the
// write are one queued step, so exactly one can win.
test("scaffolding the same world twice cannot clobber the first", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const results = await Promise.allSettled([
      store.scaffoldPack("fantasy"),
      store.scaffoldPack("fantasy"),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1, "both scaffolds succeeded — the check raced the write");
    assert.match(failed[0].reason.message, /already exists/);

    await assert.rejects(() => store.scaffoldPack("no-such-world"), /Unknown art pack/);
  } finally {
    await cleanup();
  }
});

// --- relationships ---------------------------------------------------------

test("every card knows its relatives: morph chains, roles, archetypes", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const manifest = await store.listEntries("sci-fi");
    const byKey = new Map(manifest.entries.map((entry) => [entry.key, entry]));

    // A lineage lists its whole morph chain, in order.
    const lineage = byKey.get("lineages.context-scope");
    const chain = lineage.related.find((group) => group.label === "Morphs into");
    assert.deepEqual(
      chain.items.map((item) => item.key),
      [0, 1, 2, 3].map((i) => `grades.context-scope[${i}]`),
    );

    // A grade points back at its lineage and names its position.
    const grade = byKey.get("grades.context-scope[1]");
    const morph = grade.related[0];
    assert.match(morph.label, /Morph 2 of 4/);
    assert.equal(morph.items[0].key, "lineages.context-scope");

    // Every related key that exists resolves to a real entry.
    for (const entry of manifest.entries) {
      for (const group of entry.related) {
        for (const item of group.items) {
          if (item.key) {
            assert.ok(byKey.has(item.key), `${entry.key} links to unknown ${item.key}`);
          }
        }
      }
    }

    // Roles and archetypes reference each other both ways.
    const researcher = byKey.get("roles.researcher");
    const usedBy = researcher.related.find((g) => g.label === "Used by archetypes");
    assert.ok(usedBy && usedBy.items.length > 0, "researcher is used by no archetype");
    const archetype = byKey.get(usedBy.items[0].key);
    const loads = archetype.related.find((g) => g.label === "Loads roles");
    assert.ok(
      loads.items.some((item) => item.key === "roles.researcher"),
      "archetype does not link back to the role that claims it",
    );
  } finally {
    await cleanup();
  }
});
