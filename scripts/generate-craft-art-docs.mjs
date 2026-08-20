import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ART_PACKS, ART_PACK_GROUPS, artPackEntry, artPathFor } from "./art-pack.mjs";
import { ILLUSTRATION_PROMPT_RULE } from "./illustration-rule.mjs";
import { loadPromptCatalog, projectRoot } from "./prompt-data-files.mjs";

// Art packs for the CRAFT deck. Each pack file holds one shared style
// paragraph plus a per-image entry (brief, alt text, optional bio, status);
// this generator joins them into paste-ready prompts.
//
// Installed means "the file is there": scaffolding a pack in the Card Studio
// makes it real with no code change. Read on every call rather than cached at
// module load, because the studio scaffolds packs inside a running dev server
// and a snapshot would not show the world it had just created.
//
// A pack marked `draft` is skipped by the generator and the validator so a
// half-authored world cannot fail the build - clearing that flag is the moment
// it has to be complete.
export function installedArtPackIds() {
  return ART_PACKS.map((pack) => pack.id).filter((id) =>
    existsSync(artThemePath(id)),
  );
}

const SECTION_ORDER = ["context", "action", "format", "target"];
const SECTION_LABELS = {
  context: "Context",
  action: "Action",
  format: "Format",
  target: "Target",
};

export function artThemePath(themeId) {
  return path.join(
    projectRoot,
    "src",
    "data",
    "prompt-builder",
    "art-themes",
    `${themeId}.json`,
  );
}

export function artDocPath(themeId) {
  return path.join(
    projectRoot,
    "docs",
    `CRAFT_ART_${themeId.replace(/-/g, "").toUpperCase()}.md`,
  );
}

export async function loadArtTheme(themeId) {
  try {
    return JSON.parse(await readFile(artThemePath(themeId), "utf8"));
  } catch (error) {
    throw new Error(`art-themes/${themeId}.json: ${error.message}`);
  }
}

// The name to save a generated image under, e.g. SCI-011-Synthesizer.png.
// Keeps the entry's own capitalization so the file is readable in a download
// folder, and leads with the sequence number so the batch sorts in doc order.
// This is the working file; the app wants a webp at the entry's target path.
export function artFileName(theme, sequence, name) {
  const prefix = theme.theme.filePrefix;
  const slug = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${prefix}-${String(sequence).padStart(3, "0")}-${slug}.${theme.theme.fileExtension}`;
}

// The catalog names WHICH images a pack owes and in what order; the pack
// itself supplies every word and the status. Nothing here reads a path out of
// the catalog any more - `artPathFor` derives it from the pack id and the key.
function packEntry(theme, key) {
  const resolved = artPackEntry(theme, key);
  return {
    target: artPathFor(theme.theme.id, key),
    status: resolved?.status ?? "missing",
    unique: resolved?.prompt,
    bio: resolved?.bio,
    liveVariant: resolved?.liveVariant,
    key,
  };
}

// One flat, ordered list of every image the pack owes. The acronym leads
// (it frames the whole deck), then the surfaces a player actually sees on a
// card face, and the 128 per-grade variants trail in their own later section.
export function collectCraftArtEntries(catalog, theme) {
  const entries = [];

  for (const part of catalog.builder.craftParts) {
    entries.push({
      group: "Acronym",
      name: part.label,
      owner: `craftParts \`${part.letter}\``,
      ...packEntry(theme, `craft.${part.letter}`),
    });
  }

  const roleCategories = [];
  for (const role of catalog.roles.roles) {
    if (!roleCategories.includes(role.category)) {
      roleCategories.push(role.category);
    }
  }
  for (const category of roleCategories) {
    for (const role of catalog.roles.roles) {
      if (role.category !== category) {
        continue;
      }
      entries.push({
        group: `Roles - ${category}`,
        name: role.name,
        owner: `Role \`${role.id}\``,
        ...packEntry(theme, `roles.${role.id}`),
      });
    }
  }

  for (const section of SECTION_ORDER) {
    for (const lineage of catalog.cards.cards) {
      if (lineage.section !== section) {
        continue;
      }
      entries.push({
        group: `Cards - ${SECTION_LABELS[section]}`,
        name: `${lineage.code} lineage`,
        owner: `Card \`${lineage.id}\``,
        ...packEntry(theme, `lineages.${lineage.id}`),
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
      owner: "prompt-custom-archetypes.ts",
      ...packEntry(theme, `shared.${key}`),
    });
  }

  // Later section: one variant per grade, ordered inside its lineage.
  for (const section of SECTION_ORDER) {
    for (const lineage of catalog.cards.cards) {
      if (lineage.section !== section) {
        continue;
      }
      lineage.grades.forEach((grade, index) => {
        entries.push({
          group: `Per-grade variants - ${SECTION_LABELS[section]}`,
          name: `${lineage.code} ${index + 1}. ${grade.name}`,
          owner: `Card \`${lineage.id}\` grade \`${grade.name}\``,
          ...packEntry(theme, `grades.${lineage.id}[${index}]`),
          later: true,
        });
      });
    }
  }

  return entries;
}

// The guarantee that a pack can never silently miss a card: every entry the
// catalog owes needs an authored brief, and the pack may not carry entries for
// things that no longer exist.
export function craftArtCoverageErrors(catalog, theme) {
  // A draft world is allowed to be unfinished. Clearing `draft` is the moment
  // it has to be complete, and that is what this function then enforces.
  if (theme.theme.draft) {
    return [];
  }

  const errors = [];
  const entries = collectCraftArtEntries(catalog, theme);

  // Paths are derived rather than stored, so a collision is a bug in the key
  // scheme rather than a typo - but it would silently make two cards share an
  // image, so it is still worth refusing.
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
  for (const group of ART_PACK_GROUPS) {
    if (group === "grades") {
      continue;
    }
    for (const key of Object.keys(theme[group] ?? {})) {
      if (!expected.has(`${group}.${key}`)) {
        errors.push(`${theme.theme.id} art pack has an orphan entry ${group}.${key}`);
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

  if (
    !theme.theme.style.toLowerCase().includes(ILLUSTRATION_PROMPT_RULE)
  ) {
    errors.push(
      `${theme.theme.id} art pack style paragraph is missing the image-only no-text rule`,
    );
  }

  return errors;
}

export function renderCraftArtDoc(catalog, theme) {
  const entries = collectCraftArtEntries(catalog, theme);
  const core = entries.filter((entry) => !entry.later);
  const later = entries.filter((entry) => entry.later);
  const generated = entries.filter(
    (entry) => entry.status === "generated",
  ).length;
  const { name, generator, aspectRatio, style } = theme.theme;

  const lines = [
    `# CRAFT Deck art pack: ${name}`,
    "",
    "> Generated from `src/data/prompt-builder/` and",
    `> \`src/data/prompt-builder/art-themes/${theme.theme.id}.json\` by`,
    "> `scripts/generate-craft-art-docs.mjs`. Do not edit by hand; run",
    "> `npm run data:generate` after changing the art pack or the catalog.",
    ">",
    "> The catalog decides WHICH images this pack owes and in what order; the",
    "> pack supplies every word below. Target paths are derived from the pack",
    "> id and the entry key, never stored, so a second pack lands beside this",
    "> one without moving a file.",
    "",
    `Target generator: **${generator}**. Set the aspect ratio to **${aspectRatio}**`,
    "in the generator's own controls - the prompts below carry no parameter",
    "flags. Each block is complete on its own: the shared art direction is the",
    "first paragraph, the image's unique brief is the second, so one copy takes",
    "the whole prompt.",
    "",
    "Per image:",
    "",
    "1. Copy the whole block and generate it square.",
    `2. Save the pick under its listed file name, e.g. \`${artFileName(theme, 11, "Synthesizer")}\`.`,
    "3. Paste it into the Card Studio (`/studio/cards`), crop it, and press",
    "   \"Use this\" - it writes the webp to the listed target path, flips this",
    "   pack's `status` to `\"generated\"`, and re-renders this file.",
    "4. By hand instead: convert to webp, place it at the target path under",
    "   `public/`, flip `status` in this pack's JSON, and run",
    "   `npm run data:generate`.",
    "",
    `Progress: ${generated}/${entries.length} generated - ${core.length} core images first, then ${later.length} per-grade variants.`,
    "",
    "## Shared art direction",
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
        "Optional second pass. Until a grade's own art exists, every grade of a",
        "lineage shows that lineage's image, so the deck is fully illustrated",
        "without these. Generate a grade here to override its card face.",
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

export async function generateCraftArtDocs({ check = false } = {}) {
  const catalog = await loadPromptCatalog();

  for (const themeId of installedArtPackIds()) {
    const theme = await loadArtTheme(themeId);
    // A draft pack is a world in progress: no doc is rendered for it, and
    // coverage lets it through, so scaffolding one cannot break the build.
    if (theme.theme.draft) {
      continue;
    }
    const errors = craftArtCoverageErrors(catalog, theme);
    if (errors.length > 0) {
      throw new Error(
        `CRAFT art pack validation failed:\n- ${errors.join("\n- ")}`,
      );
    }

    const rendered = renderCraftArtDoc(catalog, theme);
    const docPath = artDocPath(themeId);

    if (check) {
      let existing = "";
      try {
        existing = await readFile(docPath, "utf8");
      } catch {
        throw new Error(
          `${path.relative(projectRoot, docPath)} is missing. Run \`npm run data:generate\`.`,
        );
      }
      if (existing.replace(/\r\n/g, "\n") !== rendered) {
        throw new Error(
          `${path.relative(projectRoot, docPath)} is stale. Run \`npm run data:generate\`.`,
        );
      }
      continue;
    }

    await writeFile(docPath, rendered, "utf8");
    console.log(`Generated ${path.relative(process.cwd(), docPath)}.`);
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const check = process.argv.includes("--check");
  generateCraftArtDocs({ check })
    .then(() => {
      if (check) {
        console.log("CRAFT art packs are in sync.");
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
