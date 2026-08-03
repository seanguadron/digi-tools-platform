import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadPictureCatalog,
  pictureArtManifestPath,
} from "./picture-data-files.mjs";

// Panel order for the card entries; archetypes come first because the
// toolbar shows their swatches on every visit.
const SECTION_ORDER = [
  "protagonist",
  "illumination",
  "canvas",
  "tone",
  "universe",
  "references",
  "execution",
];

const SECTION_LABELS = {
  protagonist: "Protagonist",
  illumination: "Illumination",
  canvas: "Canvas",
  tone: "Tone",
  universe: "Universe",
  references: "References",
  execution: "Execution",
};

function manifestEntries(catalog) {
  const entries = catalog.archetypes.archetypes.map((archetype) => ({
    owner: `Archetype \`${archetype.id}\``,
    group: "Archetypes",
    name: archetype.name,
    illustration: archetype.illustration,
  }));

  for (const section of SECTION_ORDER) {
    for (const card of catalog.cards.cards) {
      if (card.section !== section) {
        continue;
      }
      entries.push({
        owner: `Card \`${card.id}\``,
        group: SECTION_LABELS[section],
        name: card.grades[1]?.name ?? card.code,
        illustration: card.illustration,
      });
    }
  }

  return entries;
}

export function renderPictureArtManifest(catalog) {
  const entries = manifestEntries(catalog);
  const generatedCount = entries.filter(
    (entry) => entry.illustration.status === "generated",
  ).length;

  const lines = [
    "# PICTURE Deck art manifest",
    "",
    "> Generated from `src/data/picture-deck/` by",
    "> `scripts/generate-picture-art-manifest.mjs`. Do not edit by hand;",
    "> run `npm run data:generate` after changing catalog illustrations.",
    "",
    "One swatch per entry, priority-ordered: archetypes first (their art is",
    "visible on every visit), then cards in panel order. The workflow per",
    "entry:",
    "",
    "1. Paste the prompt into Midjourney and pick the best square result.",
    "2. Save it as a webp at the target path under `public/`.",
    "3. Flip the entry's `status` to `\"generated\"` in its catalog JSON.",
    "4. Run `npm run data:generate` so this manifest re-renders.",
    "",
    `Progress: ${generatedCount}/${entries.length} generated.`,
    "",
  ];

  let sequence = 0;
  let currentGroup = null;
  for (const entry of entries) {
    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      lines.push(`## ${currentGroup}`, "");
    }

    sequence += 1;
    const status =
      entry.illustration.status === "generated" ? "generated" : "planned";
    lines.push(
      `### ${String(sequence).padStart(3, "0")}. ${entry.name}`,
      "",
      `- Owner: ${entry.owner}`,
      `- Target: \`public${entry.illustration.src}\``,
      `- Status: ${status}`,
      "",
      "```",
      `${entry.illustration.prompt} --ar 1:1`,
      "```",
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function generatePictureArtManifest({ check = false } = {}) {
  const catalog = await loadPictureCatalog();
  const rendered = renderPictureArtManifest(catalog);

  if (check) {
    let existing = "";
    try {
      existing = await readFile(pictureArtManifestPath, "utf8");
    } catch {
      throw new Error(
        "docs/PICTURE_ART_MANIFEST.md is missing. Run `npm run data:generate`.",
      );
    }
    if (existing !== rendered) {
      throw new Error(
        "docs/PICTURE_ART_MANIFEST.md is stale. Run `npm run data:generate`.",
      );
    }
    return;
  }

  await writeFile(pictureArtManifestPath, rendered, "utf8");
  console.log(
    `Generated ${path.relative(process.cwd(), pictureArtManifestPath)}.`,
  );
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const check = process.argv.includes("--check");
  generatePictureArtManifest({ check })
    .then(() => {
      if (check) {
        console.log("PICTURE art manifest is in sync.");
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
