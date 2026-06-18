import { readFile } from "node:fs/promises";
import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..");
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
