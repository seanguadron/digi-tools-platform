import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv from "ajv";
import { generatePictureArtManifest } from "./generate-picture-art-manifest.mjs";
import { ILLUSTRATION_PROMPT_RULE } from "./illustration-rule.mjs";
import {
  loadPictureCatalog,
  readPictureDataJson,
} from "./picture-data-files.mjs";

const SECTIONS = [
  "protagonist",
  "illumination",
  "canvas",
  "tone",
  "universe",
  "references",
  "execution",
];
let schemaValidatorPromise;

export const loadCatalog = loadPictureCatalog;

function getSchemaValidator() {
  schemaValidatorPromise ??= readPictureDataJson(
    "picture-catalog.schema.json",
  ).then((schema) =>
    new Ajv({ allErrors: true, strict: true }).compile(schema),
  );

  return schemaValidatorPromise;
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

function createIndexes(catalog) {
  const cards = catalog.cards.cards;

  return {
    trackDefinitions: new Map(
      catalog.tracks.definitions.map((definition) => [
        definition.id,
        definition,
      ]),
    ),
    cardsById: new Map(cards.map((card) => [card.id, card])),
    aspectRatioValues: new Set(
      catalog.builder.aspectRatios.map((option) => option.value),
    ),
  };
}

function validateUniqueIds(catalog) {
  return [
    ...duplicateErrors(catalog.tracks.definitions, "track"),
    ...duplicateErrors(catalog.cards.cards, "card"),
    ...duplicateErrors(catalog.cards.cards, "card", "code"),
    ...duplicateErrors(catalog.archetypes.archetypes, "archetype"),
    ...duplicateErrors(catalog.archetypes.archetypes, "archetype", "code"),
    ...duplicateErrors(catalog.proofScenarios.scenarios, "proof scenario"),
  ];
}

function validateTrackValues(errors, values, owner, trackDefinitions) {
  for (const [trackId, value] of Object.entries(values ?? {})) {
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
  const { trackDefinitions } = indexes;

  for (const section of SECTIONS) {
    for (const trackId of catalog.tracks.sectionTracks[section]) {
      if (!trackDefinitions.has(trackId)) {
        errors.push(`sectionTracks.${section} references unknown track ${trackId}`);
      }
    }
  }

  validateTrackValues(
    errors,
    catalog.tracks.defaultValues,
    "tracks.defaultValues",
    trackDefinitions,
  );

  return errors;
}

function validateCards(catalog, indexes) {
  const errors = [];
  const { trackDefinitions } = indexes;

  for (const card of catalog.cards.cards) {
    const sectionTrackIds = catalog.tracks.sectionTracks[card.section] ?? [];
    if (!sectionTrackIds.includes(card.driver)) {
      errors.push(
        `Card ${card.id} drives ${card.driver}, which is not a ${card.section} track`,
      );
    }

    const driver = trackDefinitions.get(card.driver);
    if (driver && card.grades.length !== driver.points.length) {
      errors.push(
        `Card ${card.id} has ${card.grades.length} grades for a ${driver.points.length}-point driver`,
      );
    }

    for (const [trackId, range] of Object.entries(card.affinity ?? {})) {
      const definition = trackDefinitions.get(trackId);
      if (!definition) {
        errors.push(`Card ${card.id} affinity references unknown track ${trackId}`);
        continue;
      }
      const [low, high] = range;
      if (low > high) {
        errors.push(`Card ${card.id} affinity ${trackId} range is reversed`);
      }
      if (high >= definition.points.length) {
        errors.push(
          `Card ${card.id} affinity ${trackId} exceeds the track's last snap`,
        );
      }
    }
  }

  return errors;
}

function validateIllustration(errors, illustration, ownerLabel, paths) {
  if (paths.has(illustration.src)) {
    errors.push(`Duplicate illustration path: ${illustration.src}`);
  }
  paths.add(illustration.src);

  if (!illustration.src.startsWith("/card-art/picture/")) {
    errors.push(
      `${ownerLabel} illustration must use /card-art/picture/: ${illustration.src}`,
    );
  }

  if (!illustration.prompt.toLowerCase().includes(ILLUSTRATION_PROMPT_RULE)) {
    errors.push(
      `${ownerLabel} illustration prompt is missing the image-only no-text rule`,
    );
  }
}

function validateIllustrations(catalog) {
  const errors = [];
  const paths = new Set();

  for (const card of catalog.cards.cards) {
    validateIllustration(errors, card.illustration, `Card ${card.id}`, paths);
  }

  for (const archetype of catalog.archetypes.archetypes) {
    validateIllustration(
      errors,
      archetype.illustration,
      `Archetype ${archetype.id}`,
      paths,
    );
  }

  return errors;
}

function isCompatible(card, values) {
  for (const [trackId, range] of Object.entries(card.affinity ?? {})) {
    const value = values?.[trackId];
    if (typeof value === "number" && (value < range[0] || value > range[1])) {
      return false;
    }
  }

  return true;
}

function validateEquippedMap(errors, equipped, owner, catalog, indexes, values) {
  const { cardsById } = indexes;

  for (const [section, ids] of Object.entries(equipped ?? {})) {
    const budget = catalog.tracks.slotBudgets[section];
    if (ids.length > budget) {
      errors.push(
        `${owner} equips ${ids.length} ${section} cards over the budget of ${budget}`,
      );
    }

    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) {
        errors.push(`${owner} equips ${section} card ${id} twice`);
      }
      seen.add(id);

      const card = cardsById.get(id);
      if (!card) {
        errors.push(`${owner} equips unknown card ${id}`);
        continue;
      }
      if (card.section !== section) {
        errors.push(
          `${owner} equips ${id} into ${section}, but it is a ${card.section} card`,
        );
      }
      if (values && !isCompatible(card, values)) {
        errors.push(
          `${owner} equips ${id}, which is outside its affinity at those track values`,
        );
      }
    }
  }
}

function validateArchetypes(catalog, indexes) {
  const errors = [];

  for (const archetype of catalog.archetypes.archetypes) {
    validateTrackValues(
      errors,
      archetype.tracks,
      `Archetype ${archetype.id}`,
      indexes.trackDefinitions,
    );
    validateEquippedMap(
      errors,
      archetype.equipped,
      `Archetype ${archetype.id}`,
      catalog,
      indexes,
      archetype.tracks,
    );

    if (
      archetype.mjTail?.aspectRatio &&
      !indexes.aspectRatioValues.has(archetype.mjTail.aspectRatio)
    ) {
      errors.push(
        `Archetype ${archetype.id} tail aspect ratio ${archetype.mjTail.aspectRatio} is not a builder preset`,
      );
    }
  }

  return errors;
}

function validateRange(errors, range, owner) {
  if (range.min >= range.max) {
    errors.push(`${owner} range min must be below max`);
  }
  if (range.fallback < range.min || range.fallback > range.max) {
    errors.push(`${owner} fallback sits outside its own range`);
  }
}

function validateDraftNumbers(errors, draft, owner, builder) {
  const rangeFor = {
    stylize: builder.stylizeRange,
    chaos: builder.chaosRange,
    weird: builder.weirdRange,
  };

  for (const [key, range] of Object.entries(rangeFor)) {
    const value = draft?.[key];
    if (typeof value === "number" && (value < range.min || value > range.max)) {
      errors.push(`${owner}.${key} ${value} sits outside ${range.min}-${range.max}`);
    }
  }
}

function validateBuilder(catalog, indexes) {
  const errors = [];
  const { builder } = catalog;

  validateRange(errors, builder.stylizeRange, "builder.stylizeRange");
  validateRange(errors, builder.chaosRange, "builder.chaosRange");
  validateRange(errors, builder.weirdRange, "builder.weirdRange");

  for (const [name, draft] of [
    ["builder.emptyDraft", builder.emptyDraft],
    ["builder.exampleDraft", builder.exampleDraft],
  ]) {
    if (!indexes.aspectRatioValues.has(draft.aspectRatio)) {
      errors.push(`${name} aspect ratio ${draft.aspectRatio} is not a preset`);
    }
    validateDraftNumbers(errors, draft, name, builder);
  }

  return errors;
}

function validateScenarios(catalog, indexes) {
  const errors = [];
  const { proofScenarios, builder } = catalog;

  validateDraftNumbers(
    errors,
    proofScenarios.baseDraft,
    "proofScenarios.baseDraft",
    builder,
  );

  for (const scenario of proofScenarios.scenarios) {
    validateTrackValues(
      errors,
      scenario.tracks ?? {},
      `Scenario ${scenario.id}`,
      indexes.trackDefinitions,
    );
    validateEquippedMap(
      errors,
      scenario.equipped,
      `Scenario ${scenario.id}`,
      catalog,
      indexes,
      { ...catalog.tracks.defaultValues, ...scenario.tracks },
    );

    if (
      scenario.draft?.aspectRatio &&
      !indexes.aspectRatioValues.has(scenario.draft.aspectRatio)
    ) {
      errors.push(
        `Scenario ${scenario.id} aspect ratio ${scenario.draft.aspectRatio} is not a preset`,
      );
    }
    validateDraftNumbers(
      errors,
      scenario.draft,
      `Scenario ${scenario.id}`,
      builder,
    );
  }

  return errors;
}

export async function validateCatalog(catalog, { checkDocs = false } = {}) {
  const validateSchema = await getSchemaValidator();
  if (!validateSchema(catalog)) {
    throw new Error(
      `Picture data validation failed:\n- ${schemaErrors(
        validateSchema.errors,
      ).join("\n- ")}`,
    );
  }

  const indexes = createIndexes(catalog);
  const errors = [
    ...validateUniqueIds(catalog),
    ...validateTracks(catalog, indexes),
    ...validateCards(catalog, indexes),
    ...validateIllustrations(catalog),
    ...validateArchetypes(catalog, indexes),
    ...validateBuilder(catalog, indexes),
    ...validateScenarios(catalog, indexes),
  ];

  if (errors.length > 0) {
    throw new Error(
      `Picture data validation failed:\n- ${errors.join("\n- ")}`,
    );
  }

  if (checkDocs) {
    await generatePictureArtManifest({ check: true });
  }
}

export async function validatePictureData(options = {}) {
  await validateCatalog(await loadCatalog(), options);
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  validatePictureData({ checkDocs: true })
    .then(() => {
      console.log("Picture data is valid.");
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
