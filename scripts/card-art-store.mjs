// The Card Art Studio's file layer: everything that touches disk for the
// authoring page lives here, not in the route handler, so it can be tested
// directly by the node runner and the HTTP shell stays thin.
//
// Two trees, deliberately separate:
//   card-art-source/<theme>/<dir>/<entry>/<file>.png   committed, never built
//   public/card-art/<theme>/<dir>/<entry>.webp         the one live file
//
// Callers address entries by their KEY (roles.researcher). Every path is
// derived from that key by scripts/art-pack.mjs; a caller can never supply one.
//
// The only data file this writes is the art pack: catalogs are untouched, so
// the studio cannot change what a card DOES, only how it looks.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ART_PACKS,
  ART_PACK_GROUPS,
  MAX_BIO_LENGTH,
  artPathFor,
  artRelativePath,
  parseArtKey,
} from "./art-pack.mjs";
import {
  applyCardEdits,
  catalogKeyForEntry,
  readCardRecord,
} from "./card-record.mjs";
import {
  collectCraftArtEntries,
  artFileName,
  generateCraftArtDocs,
} from "./generate-craft-art-docs.mjs";
import { generateRoleDocs } from "./generate-prompt-role-docs.mjs";
import {
  catalogFiles,
  loadPromptCatalog,
  projectRoot,
} from "./prompt-data-files.mjs";
import { artPackShapeErrors, validateCatalog } from "./validate-prompt-data.mjs";

export const VARIANT_ROOT = "card-art-source";
const CROP_SUFFIX = "_cropped";
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

export class CardArtError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CardArtError";
    this.status = status;
  }
}

export function createCardArtStore({
  root = projectRoot,
  // Tests point `root` at a temp dir and turn this off; doc rendering is
  // covered on its own in craft-art-docs.test.mjs.
  regenerateDocs = true,
} = {}) {
  const variantRoot = path.join(root, VARIANT_ROOT);
  const publicRoot = path.join(root, "public");
  const catalogRoot = path.join(root, "src", "data", "prompt-builder");
  const packRoot = path.join(catalogRoot, "art-themes");

  function assertInside(candidate, base, label) {
    const resolved = path.resolve(candidate);
    const resolvedBase = path.resolve(base);
    if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
      throw new CardArtError(`${label} resolved outside its root`, 400);
    }
    return resolved;
  }

  // Which packs exist, relative to THIS store's root. The generator's own
  // `installedArtPackIds` always answers for the repo root; here the check
  // and the write have to agree about the same directory, or scaffolding
  // asks one place whether a file exists and creates it in another.
  function installedPackIds() {
    return ART_PACKS.map((pack) => pack.id).filter((id) =>
      existsSync(path.join(packRoot, `${id}.json`)),
    );
  }

  function requireTheme(themeId) {
    if (!installedPackIds().includes(themeId)) {
      throw new CardArtError(`Unknown art theme: ${themeId}`, 404);
    }
    return themeId;
  }

  // The pack is the one data file this store writes, so it is read from the
  // store's own root rather than the repo root: a test pointing `root` at a
  // temp dir then reads back exactly what it wrote.
  function packPath(themeId) {
    return assertInside(
      path.join(packRoot, `${requireTheme(themeId)}.json`),
      packRoot,
      "art pack",
    );
  }

  async function loadPack(themeId) {
    return JSON.parse(await readFile(packPath(themeId), "utf8"));
  }

  async function loadContext(themeId) {
    requireTheme(themeId);
    const [catalog, theme] = await Promise.all([
      loadPromptCatalog(),
      loadPack(themeId),
    ]);
    const entries = collectCraftArtEntries(catalog, theme).map((entry, index) => ({
      ...entry,
      sequence: index + 1,
      fileName: artFileName(theme, index + 1, entry.name),
    }));
    return { catalog, theme, entries };
  }

  function findEntry(entries, key) {
    const entry = entries.find((candidate) => candidate.key === key);
    if (!entry) {
      throw new CardArtError(`Unknown card art entry: ${key}`, 404);
    }
    return entry;
  }

  // The variant folder mirrors the live target's own directory structure, so
  // an entry's sources sit next to nothing else.
  function variantDir(themeId, entry) {
    // "roles.researcher" -> card-art-source/sci-fi/roles/researcher
    return assertInside(
      path.join(variantRoot, themeId, artRelativePath(themeId, entry.key)),
      variantRoot,
      "variant directory",
    );
  }

  function livePath(themeId, entry) {
    return assertInside(
      path.join(publicRoot, artPathFor(themeId, entry.key).replace(/^\//, "")),
      publicRoot,
      "live art path",
    );
  }

  function variantBaseName(entry) {
    return entry.fileName.replace(/\.[a-z0-9]+$/i, "");
  }

  // Magic numbers, so a payload cannot claim to be a png while carrying
  // something else: the bytes are written to disk under that extension and
  // served back with that content type.
  function sniff(bytes) {
    if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47) {
      return "png";
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "jpeg";
    }
    if (
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    ) {
      return "webp";
    }
    return null;
  }

  function decodeDataUrl(dataUrl) {
    if (typeof dataUrl !== "string") {
      throw new CardArtError("Image payload must be a data URL");
    }
    const match = DATA_URL.exec(dataUrl.trim());
    if (!match) {
      throw new CardArtError("Only png, jpeg, or webp data URLs are accepted");
    }
    // Reject on the ENCODED length first: decoding to find out it was too big
    // is the allocation an oversized payload was trying to provoke.
    if (match[2].length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) {
      throw new CardArtError("Image payload is too large", 413);
    }
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength === 0) {
      throw new CardArtError("Image payload is empty");
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new CardArtError("Image payload is too large", 413);
    }
    const claimed = match[1];
    if (sniff(bytes) !== claimed) {
      throw new CardArtError(`Payload is not really ${claimed} data`);
    }
    return { bytes, extension: claimed === "jpeg" ? "jpg" : claimed };
  }

  async function listVariantFiles(dir) {
    try {
      const files = await readdir(dir);
      return files.filter((file) => /\.(png|jpg|webp)$/i.test(file)).sort();
    } catch {
      return [];
    }
  }

  function parseVariant(baseName, file) {
    // <base>-<letter>[_cropped].<ext>
    const pattern = new RegExp(
      `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-([a-z])(${CROP_SUFFIX})?\\.([a-z0-9]+)$`,
      "i",
    );
    const match = pattern.exec(file);
    if (!match) {
      return null;
    }
    return {
      id: `${match[1]}${match[2] ? CROP_SUFFIX : ""}`,
      letter: match[1],
      cropped: Boolean(match[2]),
      file,
    };
  }

  async function readVariants(themeId, entry) {
    const dir = variantDir(themeId, entry);
    const baseName = variantBaseName(entry);
    const files = await listVariantFiles(dir);
    return files
      .map((file) => parseVariant(baseName, file))
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function nextLetter(variants) {
    const used = new Set(variants.map((variant) => variant.letter));
    for (let code = 97; code <= 122; code += 1) {
      const letter = String.fromCharCode(code);
      if (!used.has(letter)) {
        return letter;
      }
    }
    throw new CardArtError("This entry already has 26 variants", 409);
  }

  async function listEntries(themeId) {
    const { entries } = await loadContext(themeId);
    const withVariants = await Promise.all(
      entries.map(async (entry) => ({
        key: entry.key,
        sequence: entry.sequence,
        name: entry.name,
        group: entry.group,
        later: Boolean(entry.later),
        owner: entry.owner,
        fileName: entry.fileName,
        target: entry.target,
        status: entry.status,
        prompt: entry.unique,
        bio: entry.bio ?? "",
        variants: await readVariants(themeId, entry),
      })),
    );

    return {
      theme: themeId,
      style: (await loadPack(themeId)).theme.style,
      entries: withVariants,
      progress: {
        generated: withVariants.filter((entry) => entry.status === "generated").length,
        total: withVariants.length,
      },
    };
  }

  async function readVariantFile(themeId, key, variantId) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    const variants = await readVariants(themeId, entry);
    const variant = variants.find((candidate) => candidate.id === variantId);
    if (!variant) {
      throw new CardArtError(`Unknown variant: ${variantId}`, 404);
    }
    const filePath = assertInside(
      path.join(variantDir(themeId, entry), variant.file),
      variantRoot,
      "variant file",
    );
    return { bytes: await readFile(filePath), file: variant.file };
  }

  async function addVariant(themeId, key, dataUrl) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    const { bytes, extension } = decodeDataUrl(dataUrl);
    const dir = variantDir(themeId, entry);
    await mkdir(dir, { recursive: true });

    // Exclusive create, retried: two quick pastes can both pick the same free
    // letter, and the loser must not silently overwrite the winner's image.
    for (let attempt = 0; attempt < 26; attempt += 1) {
      const letter = nextLetter(await readVariants(themeId, entry));
      const file = `${variantBaseName(entry)}-${letter}.${extension}`;
      try {
        await writeFile(
          assertInside(path.join(dir, file), variantRoot, "variant file"),
          bytes,
          { flag: "wx" },
        );
        return { id: letter, letter, cropped: false, file };
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw error;
        }
      }
    }

    throw new CardArtError("Could not find a free variant letter", 409);
  }

  // A crop is always a COPY: the source variant stays byte-identical on disk
  // so any crop can be thrown away and redone from the original.
  async function saveCrop(themeId, key, variantId, dataUrl) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    const variants = await readVariants(themeId, entry);
    const source = variants.find((candidate) => candidate.id === variantId);
    if (!source) {
      throw new CardArtError(`Unknown variant: ${variantId}`, 404);
    }
    if (source.cropped) {
      throw new CardArtError("Crop the original variant, not another crop");
    }

    const { bytes, extension } = decodeDataUrl(dataUrl);
    const dir = variantDir(themeId, entry);
    const file = `${variantBaseName(entry)}-${source.letter}${CROP_SUFFIX}.${extension}`;

    await mkdir(dir, { recursive: true });
    await writeFile(assertInside(path.join(dir, file), variantRoot, "crop file"), bytes);

    return { id: `${source.letter}${CROP_SUFFIX}`, letter: source.letter, cropped: true, file };
  }

  async function deleteVariant(themeId, key, variantId) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    const variants = await readVariants(themeId, entry);
    const variant = variants.find((candidate) => candidate.id === variantId);
    if (!variant) {
      throw new CardArtError(`Unknown variant: ${variantId}`, 404);
    }
    await rm(
      assertInside(path.join(variantDir(themeId, entry), variant.file), variantRoot, "variant file"),
      { force: true },
    );
    return { removed: variant.id };
  }

  // ONE queue for every write, not one per file. Two requests landing together
  // would otherwise each read the pre-edit file and the second would silently
  // revert the first — and separate per-file queues would still let two
  // writers reach the generated docs at once, which both a pack write and a
  // catalog write do. This is a single-author local tool, so full
  // serialization costs nothing and removes the whole class of race.
  let writeQueue = Promise.resolve();

  // Run `body` with the write lock held, keeping the chain alive on failure.
  function serialize(body) {
    const run = writeQueue.then(body);
    writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  // Flip one entry's status in its art pack. The pack is machine-formatted
  // JSON that only this store and `npm run data:generate` write, so a plain
  // round-trip is safe here where it would not have been on the catalogs.
  //
  // The doc re-render happens INSIDE the lock: it is the one file every write
  // path touches, so letting it run after the lock released would let two
  // renders overlap on it.
  function setStatus(themeId, entry, status) {
    return serialize(async () => {
      const pack = await loadPack(themeId);
      const { group, id, index } = parseArtKey(entry.key);
      const record =
        group === "grades" ? pack.grades?.[id]?.[index] : pack[group]?.[id];

      if (!record) {
        throw new CardArtError(
          `Could not find ${entry.key} in the ${themeId} art pack`,
          500,
        );
      }
      if (record.status !== "planned" && record.status !== "generated") {
        throw new CardArtError(
          `Unexpected status "${record.status}" for ${entry.key}`,
          500,
        );
      }
      if (record.status === status) {
        return false;
      }

      record.status = status;
      await writeFile(
        packPath(themeId),
        `${JSON.stringify(pack, null, 2)}\n`,
        "utf8",
      );
      await refreshGeneratedDocs();
      return true;
    });
  }

  // The pack's generated doc prints a status line per entry, and
  // check:standards fails the build on its drift, so a flip has to re-render
  // it. Only one doc quotes status now that it belongs to the pack alone.
  async function refreshGeneratedDocs() {
    if (!regenerateDocs) {
      return;
    }
    await generateCraftArtDocs();
  }

  async function selectVariant(themeId, key, variantId, webpDataUrl) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    const variants = await readVariants(themeId, entry);
    if (!variants.some((candidate) => candidate.id === variantId)) {
      throw new CardArtError(`Unknown variant: ${variantId}`, 404);
    }

    const { bytes, extension } = decodeDataUrl(webpDataUrl);
    if (extension !== "webp") {
      throw new CardArtError("The live card image must be webp");
    }

    const target = livePath(themeId, entry);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    const flipped = await setStatus(themeId, entry, "generated");

    return { target: entry.target, selected: variantId, statusChanged: flipped };
  }

  async function clearLive(themeId, key) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    await rm(livePath(themeId, entry), { force: true });
    const flipped = await setStatus(themeId, entry, "planned");
    return { target: entry.target, statusChanged: flipped };
  }

  // --- the Card tab -------------------------------------------------------

  async function readCard(key) {
    const catalog = await loadPromptCatalog();
    try {
      return readCardRecord(catalog, key);
    } catch (error) {
      throw new CardArtError(error.message, 404);
    }
  }

  // The safety keystone. A save builds a CANDIDATE catalog, runs the real
  // build validator over it, and only then writes. The studio therefore
  // cannot land an edit that would break the build, because the check that
  // guards the build is the check that guards the save - not a second,
  // weaker copy of those rules.
  function saveCard(key, edits) {
    return serialize(async () => {
      const catalogKey = catalogKeyForEntry(key);
      if (!catalogKey) {
        throw new CardArtError(`${key} has no catalog record to edit`, 400);
      }

      const catalog = await loadPromptCatalog();
      let candidate;
      try {
        candidate = applyCardEdits(catalog, key, edits);
      } catch (error) {
        throw new CardArtError(error.message, 400);
      }

      try {
        await validateCatalog(candidate);
      } catch (error) {
        throw new CardArtError(error.message, 422);
      }

      // `catalogKey` comes from a fixed table, never from the request - but
      // asserted anyway, so the module's "every write is contained" invariant
      // stays true by construction rather than by that table's good behaviour.
      const file = assertInside(
        path.join(catalogRoot, catalogFiles[catalogKey]),
        catalogRoot,
        "catalog file",
      );
      await writeFile(
        file,
        `${JSON.stringify(candidate[catalogKey], null, 2)}\n`,
        "utf8",
      );
      if (regenerateDocs && catalogKey === "roles") {
        await generateRoleDocs();
      }
      await refreshGeneratedDocs();
      return readCardRecord(candidate, key);
    });
  }

  // --- the pack's own words ------------------------------------------------

  function setBio(themeId, key, bio) {
    return serialize(async () => {
      const pack = await loadPack(themeId);
      const { group, id, index } = parseArtKey(key);
      const record =
        group === "grades" ? pack.grades?.[id]?.[index] : pack[group]?.[id];
      if (!record) {
        throw new CardArtError(
          `Could not find ${key} in the ${themeId} art pack`,
          404,
        );
      }

      const trimmed = String(bio ?? "").trim();
      // The bio renders in a panel that clips silently, so the ceiling is the
      // schema's and it is enforced here rather than discovered later.
      if (trimmed.length > MAX_BIO_LENGTH) {
        throw new CardArtError(
          `A bio has to fit the card panel: ${MAX_BIO_LENGTH} characters or fewer`,
          400,
        );
      }

      if (trimmed) {
        record.bio = trimmed;
      } else {
        delete record.bio;
      }
      await writeFile(packPath(themeId), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
      await refreshGeneratedDocs();
      return { bio: trimmed };
    });
  }

  // --- a new world ---------------------------------------------------------

  async function listPacks() {
    const installed = installedPackIds();
    return Promise.all(
      ART_PACKS.map(async (pack) => {
        if (!installed.includes(pack.id)) {
          return { ...pack, installed: false, draft: false, generated: 0, total: 0 };
        }
        const file = await loadPack(pack.id);
        let generated = 0;
        let total = 0;
        for (const group of ART_PACK_GROUPS) {
          for (const value of Object.values(file[group] ?? {})) {
            for (const entry of Array.isArray(value) ? value : [value]) {
              total += 1;
              if (entry.status === "generated") generated += 1;
            }
          }
        }
        return {
          ...pack,
          name: file.theme.name,
          installed: true,
          draft: Boolean(file.theme.draft),
          generated,
          total,
        };
      }),
    );
  }

  // Writes an empty world: every key the catalog owes, with a placeholder
  // brief and nothing generated. It lands marked `draft`, so the build stays
  // green while it is being written.
  //
  // Serialized like every other write: the "does it already exist" check and
  // the write have to be atomic, or two requests for the same brand-new pack
  // both see "no" and the second silently clobbers the first.
  function scaffoldPack(themeId) {
    return serialize(async () => {
    const target = ART_PACKS.find((pack) => pack.id === themeId);
    if (!target) {
      throw new CardArtError(`Unknown art pack: ${themeId}`, 404);
    }
    if (installedPackIds().includes(themeId)) {
      throw new CardArtError(`The ${themeId} pack already exists`, 409);
    }

    const catalog = await loadPromptCatalog();
    const source = await loadPack(installedPackIds()[0]);
    const blank = (alt) => ({
      prompt: `TODO: write the ${target.name} brief for this card.`,
      alt,
      status: "planned",
    });

    const pack = {
      schemaVersion: 2,
      theme: {
        id: themeId,
        name: target.name,
        filePrefix: target.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(),
        fileExtension: "png",
        generator: source.theme.generator,
        aspectRatio: source.theme.aspectRatio,
        style: `TODO: write the shared ${target.name} art direction.`,
        draft: true,
      },
      craft: {},
      roles: {},
      lineages: {},
      archetypes: {},
      grades: {},
      shared: {},
    };

    for (const entry of collectCraftArtEntries(catalog, source)) {
      const { group, id, index } = parseArtKey(entry.key);
      const alt = `Illustration for ${entry.name}.`;
      if (group === "grades") {
        pack.grades[id] ??= [];
        pack.grades[id][index] = blank(alt);
      } else {
        pack[group][id] = blank(alt);
      }
    }

    // Validate the world we just built before writing it, for the same reason
    // saveCard validates a catalog edit: the check that guards the build is
    // the check that guards the write. A future change to the scaffold shape
    // fails here rather than landing a malformed draft.
    const errors = await artPackShapeErrors(pack);
    if (errors.length > 0) {
      throw new CardArtError(
        `Scaffolded pack is not valid:\n- ${errors.join("\n- ")}`,
        500,
      );
    }

    // themeId came from the fixed ART_PACKS table, never from the request -
    // asserted anyway so containment is a property of this module, not of
    // that table staying well-behaved.
    await writeFile(
      assertInside(path.join(packRoot, `${themeId}.json`), packRoot, "art pack"),
      `${JSON.stringify(pack, null, 2)}\n`,
      "utf8",
    );
    return { theme: themeId, entries: collectCraftArtEntries(catalog, source).length };
    });
  }

  return {
    listEntries,
    listPacks,
    readVariantFile,
    addVariant,
    saveCrop,
    deleteVariant,
    selectVariant,
    clearLive,
    readCard,
    saveCard,
    setBio,
    scaffoldPack,
    // exposed for tests
    variantDir,
    livePath,
  };
}
