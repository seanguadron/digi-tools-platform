import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  PICTURE_ART_PACKS,
  artKeyFor,
  artPackEntry,
  artPathFor,
} from "./art-pack.mjs";
import { artFileName } from "./generate-craft-art-docs.mjs";
import { ILLUSTRATION_PROMPT_RULE } from "./illustration-rule.mjs";
import {
  loadPictureCatalog,
  pictureArtManifestPath,
} from "./picture-data-files.mjs";
import { projectRoot } from "./prompt-data-files.mjs";

// Art packs for the PICTURE deck - the mirror of generate-craft-art-docs.mjs
// with one deliberate difference: this deck has a single pack ("gallery"),
// because every card's art demonstrates the technique that card teaches. The
// generated doc keeps the historical PICTURE_ART_MANIFEST.md path.
//
// The key grammar is shared with CRAFT (lineages.<id>, grades.<id>[n],
// archetypes.<id>); the picture deck simply never uses the craft/roles/shared
// groups.

export function installedPictureArtPackIds() {
  return PICTURE_ART_PACKS.map((pack) => pack.id).filter((id) =>
    existsSync(pictureArtThemePath(id)),
  );
}

// Panel order - the order a player meets the sections.
const SECTION_ORDER = [
  "protagonist",
  "illumination",
  "canvas",
  "tone",
  "universe",
  "references",
  "execution",
];
// The guide page spells the acronym with these seven cards. Appended after
// the grades so the first 419 sequence numbers never move.
const PICTURE_LETTERS = [
  { letter: "P", label: "Protagonist" },
  { letter: "I", label: "Illumination" },
  { letter: "C", label: "Canvas" },
  { letter: "T", label: "Tone" },
  { letter: "U", label: "Universe" },
  { letter: "R", label: "References" },
  { letter: "E", label: "Execution" },
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

export function pictureArtThemePath(themeId) {
  return path.join(
    projectRoot,
    "src",
    "data",
    "picture-deck",
    "art-themes",
    `${themeId}.json`,
  );
}

export async function loadPictureArtTheme(themeId) {
  try {
    return JSON.parse(await readFile(pictureArtThemePath(themeId), "utf8"));
  } catch (error) {
    throw new Error(`picture art-themes/${themeId}.json: ${error.message}`);
  }
}

// PICTURE cards store no display name (faces show the grade's name); the
// studio and the doc derive one from the id.
export function pictureCardLabel(card) {
  return card.id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function packEntry(theme, key) {
  const resolved = artPackEntry(theme, key);
  return {
    target: artPathFor(theme.theme.id, key),
    status: resolved?.status ?? "missing",
    unique: resolved?.prompt,
    bio: resolved?.bio,
    key,
  };
}

// One flat, ordered list of every image the pack owes: cards in panel order,
// then archetypes, then the per-grade variants in their own later section.
export function collectPictureArtEntries(catalog, theme) {
  const entries = [];

  for (const section of SECTION_ORDER) {
    for (const card of catalog.cards.cards) {
      if (card.section !== section) {
        continue;
      }
      entries.push({
        group: `Cards - ${SECTION_LABELS[section]}`,
        name: pictureCardLabel(card),
        owner: `Card \`${card.id}\``,
        ...packEntry(theme, `lineages.${card.id}`),
      });
    }
  }

  for (const archetype of catalog.archetypes.archetypes) {
    entries.push({
      group: "Archetypes",
      name: archetype.name,
      owner: `Archetype \`${archetype.id}\``,
      ...packEntry(theme, `archetypes.${archetype.id}`),
    });
  }

  for (const key of Object.keys(theme.shared ?? {})) {
    entries.push({
      group: "Shared",
      name: "Custom preset swatch",
      owner: "picture-custom-archetypes.ts",
      ...packEntry(theme, `shared.${key}`),
    });
  }

  // Later section: one variant per grade, ordered inside its lineage.
  for (const section of SECTION_ORDER) {
    for (const card of catalog.cards.cards) {
      if (card.section !== section) {
        continue;
      }
      card.grades.forEach((grade, index) => {
        entries.push({
          group: `Per-grade variants - ${SECTION_LABELS[section]}`,
          name: `${pictureCardLabel(card)} ${index + 1}. ${grade.name}`,
          owner: `Card \`${card.id}\` grade \`${grade.name}\``,
          later: true,
          ...packEntry(theme, `grades.${card.id}[${index}]`),
        });
      });
    }
  }

  for (const { letter, label } of PICTURE_LETTERS) {
    entries.push({
      group: "Acronym letters - the guide page",
      name: `Letter ${letter} - ${label}`,
      owner: `Guide step \`${label}\``,
      later: true,
      ...packEntry(theme, `craft.${letter}`),
    });
  }

  return entries;
}

// How a picture card relates to its neighbours: a lineage and its grades are
// one card at three intensities, and an archetype equips cards. (No roles in
// this deck.)
export function buildPictureRelations(catalog) {
  const relations = new Map();
  const add = (key, group) => {
    const groups = relations.get(key) ?? [];
    groups.push(group);
    relations.set(key, groups);
  };

  for (const card of catalog.cards.cards) {
    const chain = card.grades.map((grade, index) => ({
      key: artKeyFor("grades", card.id, index),
      label: `${index + 1} · ${grade.name}`,
    }));
    add(artKeyFor("lineages", card.id), [
      { label: "Morphs into", items: chain },
    ]);
    card.grades.forEach((grade, index) => {
      add(artKeyFor("grades", card.id, index), [
        {
          label: `Morph ${index + 1} of ${card.grades.length} · ${card.code}`,
          items: [
            { key: artKeyFor("lineages", card.id), label: `${card.code} lineage` },
            ...chain.filter((_, chainIndex) => chainIndex !== index),
          ],
        },
      ]);
    });
  }

  for (const archetype of catalog.archetypes.archetypes) {
    const key = artKeyFor("archetypes", archetype.id);
    const groups = [];
    const equipped = Object.values(archetype.equipped ?? {})
      .flat()
      .filter((cardId) => catalog.cards.cards.some((card) => card.id === cardId))
      .map((cardId) => {
        const card = catalog.cards.cards.find(
          (candidate) => candidate.id === cardId,
        );
        return { key: artKeyFor("lineages", cardId), label: `${card.code}` };
      });
    if (equipped.length) {
      groups.push({ label: "Equips", items: equipped });
    }
    add(key, groups);
  }

  return relations;
}

export function pictureArtCoverageErrors(catalog, theme) {
  // A draft pack is allowed to be unfinished; clearing `draft` is the moment
  // it has to be complete.
  if (theme.theme.draft) {
    return [];
  }

  const errors = [];
  const entries = collectPictureArtEntries(catalog, theme);

  const targets = new Set();
  for (const entry of entries) {
    if (typeof entry.unique !== "string" || !entry.unique.trim()) {
      errors.push(`${theme.theme.id} art pack is missing ${entry.key}`);
    }
    if (targets.has(entry.target)) {
      errors.push(
        `${theme.theme.id} art pack derives ${entry.target} more than once (${entry.key})`,
      );
    }
    targets.add(entry.target);
  }

  const expected = new Set(entries.map((entry) => entry.key));
  for (const group of ["lineages", "archetypes", "craft", "roles", "shared"]) {
    for (const key of Object.keys(theme[group] ?? {})) {
      if (!expected.has(`${group}.${key}`)) {
        errors.push(
          `${theme.theme.id} art pack has an orphan entry ${group}.${key}`,
        );
      }
    }
  }
  for (const [lineageId, grades] of Object.entries(theme.grades ?? {})) {
    const list = Array.isArray(grades) ? grades : [];
    list.forEach((_, index) => {
      if (!expected.has(`grades.${lineageId}[${index}]`)) {
        errors.push(
          `${theme.theme.id} art pack has an orphan entry grades.${lineageId}[${index}]`,
        );
      }
    });
  }

  if (!theme.theme.style.toLowerCase().includes(ILLUSTRATION_PROMPT_RULE)) {
    errors.push(
      `${theme.theme.id} art pack style paragraph is missing the image-only no-text rule`,
    );
  }

  return errors;
}

export function renderPictureArtDoc(catalog, theme) {
  const entries = collectPictureArtEntries(catalog, theme);
  const core = entries.filter((entry) => !entry.later);
  const later = entries.filter((entry) => entry.later);
  const generated = entries.filter(
    (entry) => entry.status === "generated",
  ).length;
  const { name, generator, aspectRatio, style } = theme.theme;

  const lines = [
    `# PICTURE Deck art pack: ${name}`,
    "",
    "> Generated from `src/data/picture-deck/` and",
    `> \`src/data/picture-deck/art-themes/${theme.theme.id}.json\` by`,
    "> `scripts/generate-picture-art-docs.mjs`. Do not edit by hand; run",
    "> `npm run data:generate` after changing the art pack or the catalog.",
    ">",
    "> The catalog decides WHICH images this pack owes and in what order; the",
    "> pack supplies every word below. Target paths are derived from the pack",
    "> id and the entry key, never stored.",
    "",
    `Target generator: **${generator}**. Set the aspect ratio to **${aspectRatio}**`,
    "in the generator's own controls - the prompts below carry no parameter",
    "flags. Each card's art DEMONSTRATES the technique that card teaches, so",
    "the shared paragraph is structural (framing, cleanliness) rather than a",
    "house style: the brief carries the look.",
    "",
    "Per image:",
    "",
    "1. Copy the whole block and generate it square.",
    `2. Save the pick under its listed file name, e.g. \`${artFileName(theme, 1, "Lone Wanderer")}\`.`,
    "3. Paste it into the Picture Studio (`/studio/picture`), crop it, and",
    '   press "Use this" - it writes the webp to the listed target path, flips',
    '   this pack\'s `status` to `"generated"`, and re-renders this file.',
    "",
    `Progress: ${generated}/${entries.length} generated - ${core.length} core images first, then ${later.length} per-grade variants.`,
    "",
    "## Shared craft rules",
    "",
    "Every prompt in this pack opens with this paragraph:",
    "",
    "```",
    style,
    "```",
    "",
  ];

  let sequence = 0;
  let currentGroup = null;
  let laterOpened = false;

  for (const entry of entries) {
    if (entry.later && !laterOpened) {
      laterOpened = true;
      lines.push(
        "## Later: per-grade variants",
        "",
        "Until a grade's own art exists, every grade of a lineage shows that",
        "lineage's image. Generate a grade here to override its card face with",
        "the technique at that grade's intensity.",
        "",
      );
      currentGroup = null;
    }

    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      lines.push(`### ${currentGroup}`, "");
    }

    sequence += 1;
    lines.push(
      `#### ${String(sequence).padStart(3, "0")}. ${entry.name}`,
      "",
      `- File name: \`${artFileName(theme, sequence, entry.name)}\``,
      `- Target: \`public${entry.target}\``,
      `- Owner: ${entry.owner}`,
      `- Status: ${entry.status}`,
      ...(entry.bio ? [`- Bio: ${entry.bio}`] : []),
      "",
      "```",
      style,
      "",
      entry.unique,
      "```",
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function generatePictureArtDocs({ check = false } = {}) {
  const catalog = await loadPictureCatalog();

  for (const themeId of installedPictureArtPackIds()) {
    const theme = await loadPictureArtTheme(themeId);
    // A draft pack is a world in progress: no doc is rendered for it, and
    // coverage lets it through.
    if (theme.theme.draft) {
      continue;
    }

    const rendered = renderPictureArtDoc(catalog, theme);
    const docPath = pictureArtManifestPath;

    if (check) {
      let current = "";
      try {
        current = await readFile(docPath, "utf8");
      } catch {
        throw new Error(
          `${path.basename(docPath)} is missing; run npm run data:generate`,
        );
      }
      if (current !== rendered) {
        throw new Error(
          `${path.basename(docPath)} is stale; run npm run data:generate`,
        );
      }
      continue;
    }

    await writeFile(docPath, rendered, "utf8");
    console.log(`Generated docs${path.sep}${path.basename(docPath)}.`);
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  generatePictureArtDocs().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
