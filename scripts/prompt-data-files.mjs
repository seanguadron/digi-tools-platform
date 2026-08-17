import { readFile } from "node:fs/promises";
import path from "node:path";

// import.meta.dirname is set when node runs these scripts directly, but it is
// undefined once a bundler inlines the module — which happens now that the
// Card Art Studio's route handler imports this file. The dev server is always
// started from the repo root, so cwd is the correct fallback there.
export const projectRoot = import.meta.dirname
  ? path.resolve(import.meta.dirname, "..")
  : process.cwd();
export const promptDataDir = path.join(
  projectRoot,
  "src",
  "data",
  "prompt-builder",
);
export const roleDocsPath = path.join(
  projectRoot,
  "docs",
  "PROMPT_ROLES.md",
);
export const catalogFiles = {
  roles: "roles.json",
  tracks: "tracks.json",
  formats: "formats.json",
  cards: "cards.json",
  archetypes: "archetypes.json",
  suggestions: "suggestions.json",
  builder: "builder.json",
  proofScenarios: "proof-scenarios.json",
};

export async function readPromptDataJson(fileName) {
  try {
    return JSON.parse(
      await readFile(path.join(promptDataDir, fileName), "utf8"),
    );
  } catch (error) {
    throw new Error(`${fileName}: ${error.message}`);
  }
}

export async function loadPromptCatalog() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(catalogFiles).map(async ([key, fileName]) => [
        key,
        await readPromptDataJson(fileName),
      ]),
    ),
  );
}
