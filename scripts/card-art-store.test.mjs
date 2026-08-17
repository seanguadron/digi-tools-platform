import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CardArtError, createCardArtStore } from "./card-art-store.mjs";
import { projectRoot } from "./prompt-data-files.mjs";

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

test("the studio never writes a catalog file", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP);
    await store.clearLive("sci-fi", ROLE_KEY);

    // The fixture seeds ONLY the pack. If any of the above reached for a
    // catalog it would have had to create one, so absence is the proof.
    for (const file of ["roles.json", "cards.json", "archetypes.json"]) {
      assert.equal(
        existsSync(path.join(root, "src", "data", "prompt-builder", file)),
        false,
        `the store wrote ${file}`,
      );
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
    await assert.rejects(() => store.listEntries("fantasy"), /Unknown art theme/);
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
