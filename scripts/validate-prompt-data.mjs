import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv from "ajv";
import {
  installedArtPackIds,
  generateCraftArtDocs,
  loadArtTheme,
} from "./generate-craft-art-docs.mjs";
import { generateRoleDocs } from "./generate-prompt-role-docs.mjs";
import { ILLUSTRATION_PROMPT_RULE } from "./illustration-rule.mjs";
import {
  loadPromptCatalog,
  readPromptDataJson,
} from "./prompt-data-files.mjs";

const SECTIONS = ["context", "action", "format", "target"];
let schemaValidatorPromise;
let artPackValidatorPromise;

export const loadCatalog = loadPromptCatalog;

function compileSchema(relativePath) {
  return readPromptDataJson(relativePath).then((schema) =>
    new Ajv({ allErrors: true, strict: true }).compile(schema),
  );
}

function getSchemaValidator() {
  schemaValidatorPromise ??= compileSchema("prompt-catalog.schema.json");
  return schemaValidatorPromise;
}

function getArtPackValidator() {
  artPackValidatorPromise ??= compileSchema("art-themes/art-pack.schema.json");
  return artPackValidatorPromise;
}

function schemaErrors(validationErrors = []) {
  return validationErrors.map(
    (error) =>
      `Schema ${error.instancePath || "/"} ${error.message ?? "failed"}`,
  );
}

function duplicateErrors(items, label, key = "id") {
  const seen = new Set();
  const errors = [];

  for (const item of items) {
    const value = item[key];
    if (seen.has(value)) {
      errors.push(`Duplicate ${label} ${key}: ${value}`);
    }
    seen.add(value);
  }

  return errors;
}

function addReferenceError(errors, valid, message) {
  if (!valid) {
    errors.push(message);
  }
}

function createIndexes(catalog) {
  const roles = catalog.roles.roles;
  const definitions = catalog.tracks.definitions;
  const formats = catalog.formats.formats;
  const cards = catalog.cards.cards;

  return {
    roleIds: new Set(roles.map((role) => role.id)),
    roleCategories: new Set(roles.map((role) => role.category)),
    trackDefinitions: new Map(
      definitions.map((definition) => [definition.id, definition]),
    ),
    formatCodes: new Set(formats.map((format) => format.code)),
    formatValues: new Set(formats.map((format) => format.value)),
    cardsById: new Map(cards.map((card) => [card.id, card])),
  };
}

function validateUniqueIds(catalog) {
  return [
    ...duplicateErrors(catalog.roles.roles, "role"),
    ...duplicateErrors(catalog.tracks.definitions, "track"),
    ...duplicateErrors(catalog.formats.formats, "format", "code"),
    ...duplicateErrors(catalog.formats.formats, "format", "value"),
    ...duplicateErrors(catalog.cards.cards, "card"),
    ...duplicateErrors(catalog.cards.cards, "card", "code"),
    ...duplicateErrors(catalog.archetypes.archetypes, "archetype"),
    ...duplicateErrors(catalog.archetypes.archetypes, "archetype", "code"),
    ...duplicateErrors(
      catalog.proofScenarios.scenarios,
      "proof scenario",
    ),
  ];
}

function validateTrackValues(errors, values, owner, trackDefinitions) {
  for (const [trackId, value] of Object.entries(values)) {
    const definition = trackDefinitions.get(trackId);
    if (!definition) {
      errors.push(`${owner} references unknown track ${trackId}`);
    } else if (value >= definition.points.length) {
      errors.push(
        `${owner}.${trackId} uses snap ${value}, but the track ends at ${
          definition.points.length - 1
        }`,
      );
    }
  }
}

function validateTracks(catalog, indexes) {
  const errors = [];
  const { tracks, formats } = catalog;
  const { trackDefinitions, formatCodes } = indexes;

  for (const section of SECTIONS) {
    for (const trackId of tracks.sectionTracks[section]) {
      addReferenceError(
        errors,
        trackDefinitions.has(trackId),
        `${section} references unknown track ${trackId}`,
      );
    }
  }

  validateTrackValues(
    errors,
    tracks.defaultValues,
    "tracks.defaultValues",
    trackDefinitions,
  );

  for (const [formatCode, values] of Object.entries(
    formats.recommendedTracks,
  )) {
    addReferenceError(
      errors,
      formatCodes.has(formatCode),
      `Recommended tracks reference unknown format ${formatCode}`,
    );
    validateTrackValues(
      errors,
      values,
      `formats.recommendedTracks.${formatCode}`,
      trackDefinitions,
    );
  }

  for (const formatCode of formatCodes) {
    addReferenceError(
      errors,
      Boolean(formats.recommendedTracks[formatCode]),
      `Format ${formatCode} has no recommended track values`,
    );
  }

  for (const [formatCode, vocabulary] of Object.entries(tracks.vocabulary)) {
    addReferenceError(
      errors,
      formatCodes.has(formatCode),
      `Vocabulary references unknown format ${formatCode}`,
    );

    for (const [trackId, points] of Object.entries(vocabulary)) {
      const definition = trackDefinitions.get(trackId);
      if (!definition) {
        errors.push(
          `Vocabulary ${formatCode} references unknown track ${trackId}`,
        );
      } else if (points.length !== definition.points.length) {
        errors.push(
          `Vocabulary ${formatCode}.${trackId} has ${points.length} points; expected ${definition.points.length}`,
        );
      }
    }
  }

  return errors;
}

function validateCards(catalog, indexes) {
  const errors = [];
  const { tracks } = catalog;
  const { trackDefinitions } = indexes;

  for (const card of catalog.cards.cards) {
    const driver = trackDefinitions.get(card.driver);
    if (!driver) {
      errors.push(`Card ${card.id} references unknown driver ${card.driver}`);
    } else {
      addReferenceError(
        errors,
        tracks.sectionTracks[card.section].includes(card.driver),
        `Card ${card.id} driver ${card.driver} does not belong to ${card.section}`,
      );

      if (card.grades.length !== driver.points.length) {
        errors.push(
          `Card ${card.id} has ${card.grades.length} grades; expected ${driver.points.length}`,
        );
      }
    }

    for (const [trackId, range] of Object.entries(card.affinity ?? {})) {
      const definition = trackDefinitions.get(trackId);
      if (!definition) {
        errors.push(
          `Card ${card.id} affinity references unknown track ${trackId}`,
        );
        continue;
      }
      if (range[0] > range[1]) {
        errors.push(
          `Card ${card.id} has a reversed affinity range for ${trackId}`,
        );
      }
      if (range[1] >= definition.points.length) {
        errors.push(
          `Card ${card.id} affinity for ${trackId} ends beyond its final snap point`,
        );
      }
    }
  }

  return errors;
}

// Art lives in packs now, not in the catalog. What the catalog still owes the
// pack is the LIST of cards; `generateCraftArtDocs({check:true})` below is
// what fails when a pack falls behind that list. This validates the pack's own
// shape, so a hand-edited pack fails the build the way a hand-edited catalog
// does rather than surfacing as a missing image at runtime.
// One pack, in memory, against the pack schema. Exported so the Card Studio
// can check a pack it has just built BEFORE writing it — the same
// validate-then-write discipline `saveCard` applies to the catalog.
export async function artPackShapeErrors(pack) {
  const validatePack = await getArtPackValidator();
  return validatePack(pack) ? [] : schemaErrors(validatePack.errors);
}

async function validateArtPacks() {
  const validatePack = await getArtPackValidator();
  const errors = [];

  for (const themeId of installedArtPackIds()) {
    const pack = await loadArtTheme(themeId);
    if (!validatePack(pack)) {
      errors.push(
        ...schemaErrors(validatePack.errors).map(
          (message) => `art-themes/${themeId}.json: ${message}`,
        ),
      );
      continue;
    }
    if (pack.theme.id !== themeId) {
      errors.push(
        `art-themes/${themeId}.json declares theme id "${pack.theme.id}"`,
      );
    }
    // Pack free text ends up between ``` fences in the generated art docs,
    // so a backtick anywhere in it could close a fence early. No string has
    // a legitimate use for one; refuse them all rather than count runs.
    const withBackticks = [];
    const scanText = (label, value) => {
      if (typeof value === "string" && value.includes("\u0060")) {
        withBackticks.push(label);
      }
    };
    scanText("theme.style", pack.theme.style);
    for (const group of ["craft", "roles", "lineages", "archetypes", "shared"]) {
      for (const [id, entry] of Object.entries(pack[group] ?? {})) {
        scanText(`${group}.${id}.prompt`, entry.prompt);
        scanText(`${group}.${id}.alt`, entry.alt);
        scanText(`${group}.${id}.bio`, entry.bio);
      }
    }
    for (const [lineageId, slots] of Object.entries(pack.grades ?? {})) {
      slots.forEach((slot, index) => {
        scanText(`grades.${lineageId}[${index}].prompt`, slot.prompt);
        scanText(`grades.${lineageId}[${index}].alt`, slot.alt);
      });
    }
    if (withBackticks.length > 0) {
      errors.push(
        `art-themes/${themeId}.json has backticks in free text (breaks the generated doc's fences): ${withBackticks.join(", ")}`,
      );
    }
    // The pack's shared paragraph opens every prompt in it, so this one check
    // covers all 226 briefs at once. A draft pack has not written one yet.
    if (
      !pack.theme.draft &&
      !pack.theme.style.toLowerCase().includes(ILLUSTRATION_PROMPT_RULE)
    ) {
      errors.push(
        `art-themes/${themeId}.json style paragraph is missing the image-only no-text rule`,
      );
    }
  }

  return errors;
}

function validateSuggestions(catalog, indexes) {
  const errors = [];
  const { suggestions } = catalog;
  const { roleIds, roleCategories } = indexes;

  for (const roleId of Object.keys(suggestions.roleActions)) {
    addReferenceError(
      errors,
      roleIds.has(roleId),
      `Role action suggestions reference unknown role ${roleId}`,
    );
  }
  for (const category of Object.keys(suggestions.categoryActions)) {
    addReferenceError(
      errors,
      roleCategories.has(category),
      `Category action suggestions reference unknown category ${category}`,
    );
  }

  return errors;
}

function validateBuilder(catalog, indexes) {
  const errors = [];
  const { builder } = catalog;
  const { roleIds, formatValues } = indexes;

  for (const roleId of builder.exampleDraft.roleIds) {
    addReferenceError(
      errors,
      roleIds.has(roleId),
      `Example draft references unknown role ${roleId}`,
    );
  }
  addReferenceError(
    errors,
    formatValues.has(builder.emptyDraft.format),
    "Empty draft references an unknown format value",
  );
  addReferenceError(
    errors,
    formatValues.has(builder.exampleDraft.format),
    "Example draft references an unknown format value",
  );

  return errors;
}

function validateArchetypes(catalog, indexes) {
  const errors = [];
  const { tracks, archetypes } = catalog;
  const { roleIds, trackDefinitions, formatCodes, cardsById } = indexes;

  for (const archetype of archetypes.archetypes) {
    addReferenceError(
      errors,
      formatCodes.has(archetype.formatCode),
      `Archetype ${archetype.id} references unknown format ${archetype.formatCode}`,
    );

    for (const roleId of archetype.roleIds) {
      addReferenceError(
        errors,
        roleIds.has(roleId),
        `Archetype ${archetype.id} references unknown role ${roleId}`,
      );
    }

    validateTrackValues(
      errors,
      archetype.tracks,
      `archetype ${archetype.id}`,
      trackDefinitions,
    );

    for (const [section, cardIds] of Object.entries(
      archetype.equipped ?? {},
    )) {
      validateScenarioCardReferences(
        errors,
        archetype,
        section,
        cardIds,
        tracks.slotBudgets,
        cardsById,
        "Archetype",
      );
    }
  }

  return errors;
}

function validateScenarioCardReferences(
  errors,
  owner,
  section,
  cardIds,
  slotBudgets,
  cardsById,
  ownerLabel = "Scenario",
) {
  if (cardIds.length > slotBudgets[section]) {
    errors.push(`${ownerLabel} ${owner.id} exceeds the ${section} slot budget`);
  }

  for (const cardId of cardIds) {
    const card = cardsById.get(cardId);
    if (!card) {
      errors.push(`${ownerLabel} ${owner.id} references unknown card ${cardId}`);
    } else if (card.section !== section) {
      errors.push(
        `${ownerLabel} ${owner.id} places ${cardId} in the wrong section`,
      );
    }
  }
}

function validateScenarios(catalog, indexes) {
  const errors = [];
  const { tracks, proofScenarios } = catalog;
  const { roleIds, trackDefinitions, formatCodes, cardsById } = indexes;

  for (const scenario of proofScenarios.scenarios) {
    addReferenceError(
      errors,
      formatCodes.has(scenario.formatCode),
      `Scenario ${scenario.id} references unknown format ${scenario.formatCode}`,
    );

    for (const roleId of scenario.roles) {
      addReferenceError(
        errors,
        roleIds.has(roleId),
        `Scenario ${scenario.id} references unknown role ${roleId}`,
      );
    }

    validateTrackValues(
      errors,
      scenario.tracks ?? {},
      `scenario ${scenario.id}`,
      trackDefinitions,
    );

    for (const [section, cardIds] of Object.entries(
      scenario.equipped ?? {},
    )) {
      validateScenarioCardReferences(
        errors,
        scenario,
        section,
        cardIds,
        tracks.slotBudgets,
        cardsById,
      );
    }

    for (const [section, cardId] of Object.entries(
      scenario.suggested ?? {},
    )) {
      const card = cardsById.get(cardId);
      if (!card) {
        errors.push(`Scenario ${scenario.id} suggests unknown card ${cardId}`);
      } else if (card.section !== section) {
        errors.push(
          `Scenario ${scenario.id} suggests ${cardId} in the wrong section`,
        );
      }
    }
  }

  return errors;
}

export async function validateCatalog(catalog, { checkDocs = false } = {}) {
  const validateSchema = await getSchemaValidator();
  if (!validateSchema(catalog)) {
    throw new Error(
      `Prompt data validation failed:\n- ${schemaErrors(
        validateSchema.errors,
      ).join("\n- ")}`,
    );
  }

  const indexes = createIndexes(catalog);
  const errors = [
    ...validateUniqueIds(catalog),
    ...validateTracks(catalog, indexes),
    ...validateCards(catalog, indexes),
    ...validateSuggestions(catalog, indexes),
    ...validateBuilder(catalog, indexes),
    ...validateArchetypes(catalog, indexes),
    ...validateScenarios(catalog, indexes),
  ];

  if (errors.length > 0) {
    throw new Error(`Prompt data validation failed:\n- ${errors.join("\n- ")}`);
  }

  if (checkDocs) {
    await generateRoleDocs({ check: true });
    // Also fails when an art pack is missing a card or carries an orphan
    // entry, so a pack can never silently fall behind the catalog.
    await generateCraftArtDocs({ check: true });
  }
}

export async function validatePromptData(options = {}) {
  await validateCatalog(await loadCatalog(), options);

  // Deliberately outside validateCatalog: that function must stay a pure
  // check of the catalog it is handed, because the Card Studio runs it against
  // an unsaved candidate to decide whether an edit is allowed to land. Packs
  // are a separate file with a separate lifecycle.
  const errors = await validateArtPacks();
  if (errors.length > 0) {
    throw new Error(`Art pack validation failed:\n- ${errors.join("\n- ")}`);
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  validatePromptData({ checkDocs: true })
    .then(() => {
      console.log("Prompt data is valid.");
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
