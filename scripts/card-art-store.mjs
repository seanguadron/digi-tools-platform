// The Card Art Studio's file layer: everything that touches disk for the
// authoring page lives here, not in the route handler, so it can be tested
// directly by the node runner and the HTTP shell stays thin.
//
// Two trees, deliberately separate:
//   card-art-source/<theme>/<dir>/<entry>/<file>.png   committed, never built
//   public/card-art/<theme>/<dir>/<entry>.webp         the one live file
//
// Callers address entries by their catalog KEY (roles.researcher). Every path
// is derived here from the catalog; a caller can never supply one.

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ART_THEME_IDS,
  collectCraftArtEntries,
  artFileName,
  generateCraftArtDocs,
  loadArtTheme,
} from "./generate-craft-art-docs.mjs";
import { catalogFiles, loadPromptCatalog, projectRoot } from "./prompt-data-files.mjs";

export const VARIANT_ROOT = "card-art-source";
const CROP_SUFFIX = "_cropped";
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

// Which catalog file owns each entry group, for the status flip.
const CATALOG_FOR_GROUP = {
  roles: "roles",
  lineages: "cards",
  grades: "cards",
  archetypes: "archetypes",
};

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

  function assertInside(candidate, base, label) {
    const resolved = path.resolve(candidate);
    const resolvedBase = path.resolve(base);
    if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
      throw new CardArtError(`${label} resolved outside its root`, 400);
    }
    return resolved;
  }

  function requireTheme(themeId) {
    if (!ART_THEME_IDS.includes(themeId)) {
      throw new CardArtError(`Unknown art theme: ${themeId}`, 404);
    }
    return themeId;
  }

  async function loadContext(themeId) {
    requireTheme(themeId);
    const [catalog, theme] = await Promise.all([
      loadPromptCatalog(),
      loadArtTheme(themeId),
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
    // entry.target is "/card-art/sci-fi/roles/researcher.webp" -> "roles/researcher"
    const relative = entry.target.replace(/^\/card-art\/[^/]+\//, "").replace(/\.webp$/, "");
    return assertInside(
      path.join(variantRoot, themeId, relative),
      variantRoot,
      "variant directory",
    );
  }

  function livePath(entry) {
    return assertInside(
      path.join(publicRoot, entry.target.replace(/^\//, "")),
      publicRoot,
      "live art path",
    );
  }

  function variantBaseName(entry) {
    return entry.fileName.replace(/\.[a-z0-9]+$/i, "");
  }

  function decodeDataUrl(dataUrl) {
    if (typeof dataUrl !== "string") {
      throw new CardArtError("Image payload must be a data URL");
    }
    const match = DATA_URL.exec(dataUrl.trim());
    if (!match) {
      throw new CardArtError("Only png, jpeg, or webp data URLs are accepted");
    }
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength === 0) {
      throw new CardArtError("Image payload is empty");
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new CardArtError("Image payload is too large", 413);
    }
    return { bytes, extension: match[1] === "jpeg" ? "jpg" : match[1] };
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
        variants: await readVariants(themeId, entry),
      })),
    );

    return {
      theme: themeId,
      style: (await loadArtTheme(themeId)).theme.style,
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
    const existing = await readVariants(themeId, entry);
    const letter = nextLetter(existing);
    const file = `${variantBaseName(entry)}-${letter}.${extension}`;

    await mkdir(dir, { recursive: true });
    await writeFile(assertInside(path.join(dir, file), variantRoot, "variant file"), bytes);

    return { id: letter, letter, cropped: false, file };
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

  // Flip one entry's status in its catalog JSON. Targeted string surgery on
  // the illustration block that owns this src, so the rest of the file keeps
  // its exact formatting (a JSON round-trip would reformat 3k lines).
  async function setStatus(entry, status) {
    const group = entry.key.split(".")[0];
    const catalogKey = CATALOG_FOR_GROUP[group];
    if (!catalogKey) {
      // craft letters and the shared swatch have no catalog record yet.
      return false;
    }

    const file = path.join(root, "src", "data", "prompt-builder", catalogFiles[catalogKey]);
    const source = await readFile(file, "utf8");
    const marker = `"src": "${entry.target}"`;
    const at = source.indexOf(marker);
    if (at === -1) {
      throw new CardArtError(`Could not find ${entry.target} in ${catalogFiles[catalogKey]}`, 500);
    }
    const statusAt = source.indexOf('"status": "', at);
    if (statusAt === -1) {
      throw new CardArtError(`Could not find a status field for ${entry.target}`, 500);
    }
    const valueStart = statusAt + '"status": "'.length;
    const valueEnd = source.indexOf('"', valueStart);
    const current = source.slice(valueStart, valueEnd);
    if (current === status) {
      return false;
    }

    await writeFile(
      file,
      source.slice(0, valueStart) + status + source.slice(valueEnd),
      "utf8",
    );
    return true;
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

    const target = livePath(entry);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    const flipped = await setStatus(entry, "generated");
    if (flipped && regenerateDocs) {
      await generateCraftArtDocs();
    }

    return { target: entry.target, selected: variantId, statusChanged: flipped };
  }

  async function clearLive(themeId, key) {
    const { entries } = await loadContext(themeId);
    const entry = findEntry(entries, key);
    await rm(livePath(entry), { force: true });
    const flipped = await setStatus(entry, "planned");
    if (flipped && regenerateDocs) {
      await generateCraftArtDocs();
    }
    return { target: entry.target, statusChanged: flipped };
  }

  return {
    listEntries,
    readVariantFile,
    addVariant,
    saveCrop,
    deleteVariant,
    selectVariant,
    clearLive,
    // exposed for tests
    variantDir,
    livePath,
  };
}
