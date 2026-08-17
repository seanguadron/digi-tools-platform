import { readFile } from "node:fs/promises";
import path from "node:path";

// See prompt-data-files.mjs: dirname is undefined under a bundler, and the
// cwd fallback is verified there rather than assumed.
export { projectRoot } from "./prompt-data-files.mjs";
import { projectRoot } from "./prompt-data-files.mjs";
export const pictureDataDir = path.join(
  projectRoot,
  "src",
  "data",
  "picture-deck",
);
export const pictureArtManifestPath = path.join(
  projectRoot,
  "docs",
  "PICTURE_ART_MANIFEST.md",
);
export const catalogFiles = {
  tracks: "tracks.json",
  cards: "cards.json",
  archetypes: "archetypes.json",
  builder: "builder.json",
  proofScenarios: "proof-scenarios.json",
};

export async function readPictureDataJson(fileName) {
  try {
    return JSON.parse(
      await readFile(path.join(pictureDataDir, fileName), "utf8"),
    );
  } catch (error) {
    throw new Error(`${fileName}: ${error.message}`);
  }
}

export async function loadPictureCatalog() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(catalogFiles).map(async ([key, fileName]) => [
        key,
        await readPictureDataJson(fileName),
      ]),
    ),
  );
}
