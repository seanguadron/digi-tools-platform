import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function makeStore() {
  const root = await mkdtemp(path.join(os.tmpdir(), "card-art-"));
  // The status flip edits a catalog file, so give the temp root real copies.
  const dataDir = path.join(root, "src", "data", "prompt-builder");
  await mkdir(dataDir, { recursive: true });
  for (const file of ["roles.json", "cards.json", "archetypes.json"]) {
    await cp(path.join(projectRoot, "src", "data", "prompt-builder", file), path.join(dataDir, file));
  }
  const store = createCardArtStore({ root, regenerateDocs: false });
  return { root, store, cleanup: () => rm(root, { recursive: true, force: true }) };
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

test("selecting writes the live webp and flips the catalog status", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    const result = await store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP);

    assert.equal(result.target, "/card-art/sci-fi/roles/researcher.webp");
    assert.equal(result.statusChanged, true);

    const live = path.join(root, "public", "card-art", "sci-fi", "roles", "researcher.webp");
    assert.ok(existsSync(live), "live webp was not written");

    const roles = JSON.parse(
      await readFile(path.join(root, "src", "data", "prompt-builder", "roles.json"), "utf8"),
    );
    const researcher = roles.roles.find((role) => role.id === "researcher");
    assert.equal(researcher.illustration.status, "generated");
    // Only the targeted entry moved.
    assert.equal(roles.roles.filter((r) => r.illustration.status === "generated").length, 1);
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

    const roles = JSON.parse(
      await readFile(path.join(root, "src", "data", "prompt-builder", "roles.json"), "utf8"),
    );
    const researcher = roles.roles.find((role) => role.id === "researcher");
    assert.equal(researcher.illustration.status, "planned");
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
      const dir = store.variantDir("sci-fi", { ...entry, fileName: entry.fileName });
      const live = store.livePath(entry);
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

test("a catalog whose entry is missing fails loudly instead of writing", async () => {
  const { root, store, cleanup } = await makeStore();
  try {
    const rolesPath = path.join(root, "src", "data", "prompt-builder", "roles.json");
    const source = await readFile(rolesPath, "utf8");
    await writeFile(
      rolesPath,
      source.replace('"src": "/card-art/sci-fi/roles/researcher.webp"', '"src": "/card-art/sci-fi/roles/moved.webp"'),
      "utf8",
    );

    await store.addVariant("sci-fi", ROLE_KEY, PNG);
    await assert.rejects(
      () => store.selectVariant("sci-fi", ROLE_KEY, "a", WEBP),
      /Could not find/,
    );
  } finally {
    await cleanup();
  }
});
