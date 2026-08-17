// The Card tab: what a card IS, as opposed to what it looks like in a
// particular world. The art pack owns the look; this module owns the reading
// and writing of the universal half.
//
// Two rules shape it.
//
// Writable fields are a CLOSED TABLE, not a path expression a caller supplies.
// The studio sends a field id from this table and nothing else, so no request
// can reach a part of the catalog this file did not deliberately expose - ids,
// codes, sections, drivers, affinities, track values and equipped cards are
// readable and never writable, because they are referenced by other records.
//
// Nothing here validates. The caller builds a candidate catalog with
// applyCardEdits and hands it to the real build validator; an edit that would
// break referential integrity is refused by the same code that guards the
// build, rather than by a second, weaker copy of those rules.

import { parseArtKey } from "./art-pack.mjs";

export class CardRecordError extends Error {}

// Every one of these fields renders onto a card face or into a panel that
// clips, so an unbounded string is a layout bug waiting to be typed. The
// catalog schema has no maxLength of its own, so the ceiling is enforced
// here, where the only writer is. Roughly double the longest value the
// catalog ships today (608 characters, an archetype's action text), so it
// stops runaway input without standing in the way of ordinary editing.
export const MAX_FIELD_LENGTH = 1200;

const line = (id, label, get, set, hint) => ({ id, label, kind: "line", get, set, hint });
const text = (id, label, get, set, hint) => ({ id, label, kind: "text", get, set, hint });
const list = (id, label, get, set, hint) => ({ id, label, kind: "list", get, set, hint });

const FIELDS = {
  roles: [
    line("name", "Name", (r) => r.name, (r, v) => { r.name = v; }),
    text(
      "description",
      "Description",
      (r) => r.description,
      (r, v) => { r.description = v; },
      "The instruction this role writes into the prompt.",
    ),
    text(
      "ability.summary",
      "Ability",
      (r) => r.ability.summary,
      (r, v) => { r.ability.summary = v; },
      "One line, shown on the card's inspection panel.",
    ),
    list(
      "ability.bullets",
      "Ability bullets",
      (r) => r.ability.bullets,
      (r, v) => { r.ability.bullets = v; },
      "One per line, 1 to 6.",
    ),
  ],
  lineages: [
    list(
      "goals",
      "What this adds",
      (c) => c.goals,
      (c, v) => { c.goals = v; },
      "One per line, 1 to 6. Card flavour: never sent in the prompt.",
    ),
  ],
  grades: [
    line("name", "Name", (g) => g.name, (g, v) => { g.name = v; }),
    text(
      "description",
      "Description",
      (g) => g.description,
      (g, v) => { g.description = v; },
      "Shown on the card face at this intensity.",
    ),
    text(
      "instruction",
      "Instruction",
      (g) => g.instruction,
      (g, v) => { g.instruction = v; },
      "The line this grade contributes to the assembled prompt.",
    ),
  ],
  archetypes: [
    line("name", "Name", (a) => a.name, (a, v) => { a.name = v; }),
    text("description", "Description", (a) => a.description, (a, v) => { a.description = v; }),
    text(
      "defaultAudience",
      "Default audience",
      (a) => a.defaultAudience,
      (a, v) => { a.defaultAudience = v; },
      "Used when the Target field is left on \"Use default\".",
    ),
    list(
      "effects",
      "Effects",
      (a) => a.effects,
      (a, v) => { a.effects = v; },
      "One per line, 1 to 6. What applying this preset changes.",
    ),
    text("action", "Action text", (a) => a.action ?? "", (a, v) => { a.action = v; }),
    text(
      "formatNotes",
      "Format notes",
      (a) => a.formatNotes ?? "",
      (a, v) => { a.formatNotes = v; },
    ),
  ],
  craft: [
    line("label", "Label", (p) => p.label, (p, v) => { p.label = v; }),
    line("summary", "Summary", (p) => p.summary, (p, v) => { p.summary = v; }),
  ],
  shared: [],
};

const STRUCTURAL = {
  roles: (r) => [
    ["Id", r.id],
    ["Category", r.category],
    ["Core role", r.core ? "yes" : "no"],
  ],
  lineages: (c) => [
    ["Id", c.id],
    ["Code", c.code],
    ["Section", c.section],
    ["Driver track", c.driver],
    ["Affinity", c.affinity ? Object.keys(c.affinity).join(", ") : "none"],
    ["Grades", String(c.grades.length)],
  ],
  grades: (g, lineage, index) => [
    ["Lineage", `${lineage.code} (${lineage.id})`],
    ["Intensity", `${index + 1} of ${lineage.grades.length}`],
    ["Driver track", lineage.driver],
  ],
  archetypes: (a) => [
    ["Id", a.id],
    ["Code", a.code],
    ["Format", a.formatCode],
    ["Roles", a.roleIds.join(", ")],
    ["Tracks", `${Object.keys(a.tracks).length} set`],
    [
      "Equipped",
      `${Object.values(a.equipped).reduce((n, ids) => n + ids.length, 0)} cards`,
    ],
  ],
  craft: (p) => [["Letter", p.letter]],
  shared: () => [],
};

const KIND_LABELS = {
  roles: "Role",
  lineages: "Card lineage",
  grades: "Card grade",
  archetypes: "Archetype",
  craft: "Acronym letter",
  shared: "Shared swatch",
};

const STRUCTURAL_NOTE =
  "These identify the card and are referenced by other records, so they are " +
  "edited in the catalog JSON where the change can be reviewed as a diff.";

// The catalog object an entry key names, or null when the key has no catalog
// record at all (the shared swatches are UI chrome, not cards).
function locate(catalog, key) {
  const { group, id, index } = parseArtKey(key);

  if (group === "roles") {
    return { group, record: catalog.roles.roles.find((r) => r.id === id) };
  }
  if (group === "lineages") {
    return { group, record: catalog.cards.cards.find((c) => c.id === id) };
  }
  if (group === "grades") {
    const lineage = catalog.cards.cards.find((c) => c.id === id);
    return { group, record: lineage?.grades[index], lineage, index };
  }
  if (group === "archetypes") {
    return {
      group,
      record: catalog.archetypes.archetypes.find((a) => a.id === id),
    };
  }
  if (group === "craft") {
    return {
      group,
      record: catalog.builder.craftParts.find((p) => p.letter === id),
    };
  }
  return { group, record: null };
}

export function readCardRecord(catalog, key) {
  const { group, record, lineage, index } = locate(catalog, key);

  if (group === "shared") {
    return {
      key,
      kind: KIND_LABELS.shared,
      hasRecord: false,
      fields: [],
      structural: [],
      note: "A swatch the interface draws itself. It has no catalog record, so there is nothing here to edit.",
    };
  }
  if (!record) {
    throw new CardRecordError(`No catalog record for ${key}`);
  }

  return {
    key,
    kind: KIND_LABELS[group],
    hasRecord: true,
    fields: FIELDS[group].map((field) => ({
      id: field.id,
      label: field.label,
      kind: field.kind,
      hint: field.hint,
      value: field.get(record),
    })),
    structural: STRUCTURAL[group](record, lineage, index).map(([label, value]) => ({
      label,
      value,
    })),
    note: STRUCTURAL_NOTE,
  };
}

// Returns a NEW catalog with the edits applied. The original is untouched, so
// a caller can validate the candidate and throw the whole thing away.
export function applyCardEdits(catalog, key, edits) {
  const candidate = structuredClone(catalog);
  const { group, record } = locate(candidate, key);

  if (!record) {
    throw new CardRecordError(`No catalog record for ${key}`);
  }

  const byId = new Map(FIELDS[group].map((field) => [field.id, field]));
  const checkLength = (label, value) => {
    if (value.length > MAX_FIELD_LENGTH) {
      throw new CardRecordError(
        `${label} has to fit on a card: ${MAX_FIELD_LENGTH} characters or fewer`,
      );
    }
    return value;
  };

  for (const [id, raw] of Object.entries(edits)) {
    const field = byId.get(id);
    if (!field) {
      throw new CardRecordError(`${key} has no editable field "${id}"`);
    }

    if (field.kind === "list") {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
        throw new CardRecordError(`${field.label} must be a list of lines`);
      }
      const cleaned = raw
        .map((item) => checkLength(field.label, item.trim()))
        .filter(Boolean);
      if (cleaned.length === 0) {
        throw new CardRecordError(`${field.label} cannot be empty`);
      }
      field.set(record, cleaned);
      continue;
    }

    if (typeof raw !== "string") {
      throw new CardRecordError(`${field.label} must be text`);
    }
    field.set(record, checkLength(field.label, raw.trim()));
  }

  return candidate;
}

// Which catalog file each group lives in, so a save rewrites one file rather
// than all eight.
export const CATALOG_FOR_GROUP = {
  roles: "roles",
  lineages: "cards",
  grades: "cards",
  archetypes: "archetypes",
  craft: "builder",
};

export function catalogKeyForEntry(key) {
  return CATALOG_FOR_GROUP[parseArtKey(key).group] ?? null;
}
