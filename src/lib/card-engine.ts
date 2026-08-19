// Generic card-deck engine: affinity-filtered decks, grade-by-driver-track
// selection, slot-budgeted equip reducers, snap-memory reconciliation, and
// stored-state sanitization. Both deck tools (CRAFT, PICTURE) instantiate it
// through createCardEngine with their own catalog; the logic here carries no
// knowledge of any catalog.
//
// Kept free of path aliases and JSON imports so the scripts/*.test.mjs runner
// can load it directly (same constraint as prompt-defaults.ts). That includes
// insertIntoSlots: the engine carries a private twin of src/lib/slot-order.ts
// rather than importing it — keep the two in sync.

export type CardIllustration = {
  src: string;
  alt: string;
  motif: string;
  prompt: string;
  status: "planned" | "generated";
};

export type CardGradeOf = {
  name: string;
  description: string;
  instruction: string;
  illustration?: CardIllustration;
};

export type CardLineageOf<S extends string, T extends string> = {
  id: string;
  code: string;
  section: S;
  driver: T;
  goals: readonly string[];
  grades: readonly CardGradeOf[];
  // Optional because a deck can keep its art in an art pack instead (the
  // CRAFT deck does; the PICTURE deck still carries its own inline).
  illustration?: CardIllustration;
  affinity?: Partial<Record<T, readonly [number, number]>>;
};

export type TrackDefinitionOf<T extends string> = {
  id: T;
  label: string;
  description: string;
  points: readonly string[];
};

export type TrackValuesOf<T extends string> = Record<T, number>;
export type EquippedCardsOf<S extends string> = Record<S, string[]>;
export type SnapMemoryOf<S extends string> = Record<S, Record<string, string[]>>;
export type SuggestedCardsOf<S extends string> = Record<S, string | null>;

export type CardSystemStateOf<S extends string, T extends string> = {
  tracks: TrackValuesOf<T>;
  equipped: EquippedCardsOf<S>;
  memory: SnapMemoryOf<S>;
  overrides: T[];
  suggested: SuggestedCardsOf<S>;
};

// Which artwork a card face shows. A grade's own art wins ONLY once it has
// actually been generated: a deck ships a placeholder record per grade, so a
// plain `grade ?? lineage` would make lineage art unreachable and leave the
// whole deck on letter placeholders until all 128 grade images existed.
// Falling back on status instead lets one lineage image cover its grades
// today, and each grade upgrades itself the moment its own art lands.
// (PICTURE grades carry no illustration at all, so this returns lineage art
// for them; the CRAFT deck applies the same rule over its art pack in
// `src/lib/art-pack.ts`.)
export function resolveCardIllustration<A extends { status: string }>(
  grade: A | undefined,
  lineage: A | undefined,
): A | undefined {
  return grade?.status === "generated" ? grade : lineage;
}

export type CardEngineConfig<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T> = CardLineageOf<S, T>,
> = {
  sections: readonly S[];
  trackIds: readonly T[];
  cards: readonly L[];
  sectionTracks: Record<S, readonly T[]>;
  slotBudgets: Record<S, number>;
  trackDefinitions: readonly TrackDefinitionOf<T>[];
  defaultTrackValues: TrackValuesOf<T>;
  // Optional per-vocabulary-key overrides for track point labels; CRAFT keys
  // this by format code. Absent keys fall back to the base definition.
  vocabulary?: Record<string, Partial<Record<T, readonly string[]>>>;
  cardFamily: (section: S) => string;
  // Where a card's picture comes from. The seam exists because the two decks
  // answer it differently: CRAFT looks the card up in the active art pack,
  // a deck without them falls back to inline catalog art. Omitted, a deck
  // falls back to whatever its lineage/grade records carry.
  cardArt?: (lineage: L, gradeIndex: number) => CardArtRef | undefined;
  // The card's short character blurb, also a per-world fact and so also the
  // art pack's. Absent for a deck that has not been given one.
  cardBio?: (lineage: L) => string | undefined;
};

// The little a card face needs to know about its picture. Both a pack entry
// and an inline `illustration` satisfy it, which is what lets one card face
// serve both decks.
export type CardArtRef = {
  src: string;
  status: "planned" | "generated";
};

// Private twin of src/lib/slot-order.ts insertIntoSlots (see header comment).
function insertIntoSlots(
  slots: readonly string[],
  targetIndex: number,
  itemId: string,
  slotCount: number,
) {
  const normalizedSlots = Array.from(
    { length: slotCount },
    (_, index) => slots[index] ?? "",
  );
  const nextSlots = normalizedSlots.filter(
    (currentItemId) => currentItemId !== itemId,
  );
  const boundedIndex = Math.max(0, Math.min(targetIndex, slotCount - 1));

  nextSlots.splice(boundedIndex, 0, itemId);
  return nextSlots.slice(0, slotCount);
}

export function createCardEngine<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T> = CardLineageOf<S, T>,
>(config: CardEngineConfig<S, T, L>) {
  const {
    sections,
    trackIds,
    cards,
    sectionTracks,
    slotBudgets,
    defaultTrackValues,
    vocabulary,
    cardFamily,
    cardArt,
    cardBio,
  } = config;
  const trackDefinitions = new Map<T, TrackDefinitionOf<T>>(
    config.trackDefinitions.map((definition) => [definition.id, definition]),
  );

  function getTrackDefinition(trackId: T, vocabularyKey: string) {
    const definition = trackDefinitions.get(trackId);
    if (!definition) {
      throw new Error(`Unknown card track: ${trackId}`);
    }

    const points = vocabulary?.[vocabularyKey]?.[trackId];

    return points ? { ...definition, points } : definition;
  }

  function getTrackMax(trackId: T) {
    return (trackDefinitions.get(trackId)?.points.length ?? 4) - 1;
  }

  function getSectionConfigurationKey(section: S, values: TrackValuesOf<T>) {
    return sectionTracks[section]
      .map((trackId) => `${trackId}:${values[trackId]}`)
      .join("|");
  }

  function isLineageCompatible(lineage: L, values: TrackValuesOf<T>) {
    return trackIds.every((trackId) => {
      const range = lineage.affinity?.[trackId];
      return (
        !range || (values[trackId] >= range[0] && values[trackId] <= range[1])
      );
    });
  }

  function getSectionDeck(section: S, values: TrackValuesOf<T>) {
    return cards.filter(
      (lineage) =>
        lineage.section === section && isLineageCompatible(lineage, values),
    );
  }

  function getCardGradeIndex(lineage: L, values: TrackValuesOf<T>) {
    return Math.min(values[lineage.driver], lineage.grades.length - 1);
  }

  function getCardGrade(lineage: L, values: TrackValuesOf<T>) {
    return lineage.grades[
      getCardGradeIndex(lineage, values)
    ] as L["grades"][number];
  }

  // The art a card face should show at these track values, resolved through
  // whichever source the deck configured.
  function getCardArt(lineage: L, values: TrackValuesOf<T>) {
    const gradeIndex = getCardGradeIndex(lineage, values);
    if (cardArt) {
      return cardArt(lineage, gradeIndex);
    }
    return resolveCardIllustration(
      lineage.grades[gradeIndex]?.illustration,
      lineage.illustration,
    );
  }

  function getCardBio(lineage: L) {
    return cardBio?.(lineage);
  }

  function getLineage(lineageId: string) {
    return cards.find((lineage) => lineage.id === lineageId);
  }

  function getEquippedInstructions(
    equipped: Record<S, string[]>,
    values: TrackValuesOf<T>,
  ) {
    const instructions = {} as Record<S, string[]>;
    for (const section of sections) {
      instructions[section] = equipped[section]
        .map((lineageId) => getLineage(lineageId))
        .filter((lineage): lineage is L => Boolean(lineage))
        .map((lineage) => getCardGrade(lineage, values).instruction);
    }

    return instructions;
  }

  // Drops anything a stored card-system state may carry that the current
  // catalog no longer recognizes: unknown or wrong-section card ids,
  // over-budget slots, removed tracks, and out-of-range track values. Old
  // saves, share links, and custom archetypes degrade gracefully instead of
  // leaving ghost slots.
  function sanitizeCardSystemShape<
    Shape extends {
      tracks: TrackValuesOf<T>;
      equipped: Record<S, string[]>;
      overrides: T[];
    },
  >(state: Shape | null | undefined): Shape {
    const tracks = {} as TrackValuesOf<T>;
    for (const trackId of trackIds) {
      const raw = state?.tracks?.[trackId];
      const max = getTrackMax(trackId);
      tracks[trackId] =
        typeof raw === "number" && Number.isFinite(raw)
          ? Math.min(Math.max(Math.round(raw), 0), max)
          : Math.min(defaultTrackValues[trackId], max);
    }

    const equipped = {} as Record<S, string[]>;
    for (const section of sections) {
      const candidate = state?.equipped?.[section];
      const ids = Array.isArray(candidate) ? candidate : [];
      equipped[section] = ids
        .filter(
          (id, index) =>
            getLineage(id)?.section === section && ids.indexOf(id) === index,
        )
        .slice(0, slotBudgets[section]);
    }

    const overrideList = state?.overrides;
    const overrides = Array.isArray(overrideList)
      ? overrideList.filter((trackId) => trackIds.includes(trackId))
      : [];

    // A null state degrades to the three sanitized keys; every in-repo caller
    // passes a full object, so the cast only covers that degraded path.
    return { ...(state ?? ({} as Shape)), tracks, equipped, overrides };
  }

  function createEmptyEquippedCards(): EquippedCardsOf<S> {
    const equipped = {} as EquippedCardsOf<S>;
    for (const section of sections) {
      equipped[section] = [];
    }

    return equipped;
  }

  function createEmptySnapMemory(): SnapMemoryOf<S> {
    const memory = {} as SnapMemoryOf<S>;
    for (const section of sections) {
      memory[section] = {};
    }

    return memory;
  }

  function createEmptySuggestedCards(): SuggestedCardsOf<S> {
    const suggested = {} as SuggestedCardsOf<S>;
    for (const section of sections) {
      suggested[section] = null;
    }

    return suggested;
  }

  function createEquippedSlots(
    values: Partial<Record<S, readonly string[]>> | null = {},
  ): EquippedCardsOf<S> {
    // ?? {} rather than a default parameter: stored presets are user-editable
    // JSON, so a literal null must degrade like undefined instead of throwing
    // one expression before the sanitizer gets to run.
    const source: Partial<Record<S, readonly string[]>> = values ?? {};
    return sections.reduce((result, section) => {
      result[section] = Array.from(
        { length: slotBudgets[section] },
        (_, slotIndex) => source[section]?.[slotIndex] ?? "",
      );
      return result;
    }, createEmptyEquippedCards());
  }

  function createCardSystem(
    initialTracks: TrackValuesOf<T> = { ...defaultTrackValues },
  ): CardSystemStateOf<S, T> {
    return {
      tracks: { ...initialTracks },
      equipped: createEmptyEquippedCards(),
      memory: createEmptySnapMemory(),
      overrides: [],
      suggested: createEmptySuggestedCards(),
    };
  }

  function reconcileCardSystem(
    current: CardSystemStateOf<S, T>,
    nextTracks: TrackValuesOf<T>,
    nextOverrides = current.overrides,
  ): CardSystemStateOf<S, T> {
    const nextMemory = {} as SnapMemoryOf<S>;
    const nextEquipped = {} as EquippedCardsOf<S>;
    for (const section of sections) {
      nextMemory[section] = { ...current.memory[section] };
      nextEquipped[section] = [...current.equipped[section]];
    }
    const nextSuggested = createEmptySuggestedCards();

    sections.forEach((section) => {
      const oldKey = getSectionConfigurationKey(section, current.tracks);
      const newKey = getSectionConfigurationKey(section, nextTracks);

      if (oldKey === newKey) {
        nextSuggested[section] = current.suggested[section];
        return;
      }

      const sectionMemory: Record<string, string[]> = nextMemory[section];
      sectionMemory[oldKey] = current.equipped[section];
      const memoryKeys = Object.keys(sectionMemory);
      if (memoryKeys.length > 12) {
        delete sectionMemory[memoryKeys[0]];
      }

      const deckIds = getSectionDeck(section, nextTracks).map(
        (lineage) => lineage.id,
      );
      const sourceSlots = sectionMemory[newKey] ?? current.equipped[section];
      const restored = Array.from(
        { length: slotBudgets[section] },
        (_, slotIndex) => {
          const lineageId = sourceSlots[slotIndex] ?? "";
          return deckIds.includes(lineageId) ? lineageId : "";
        },
      );
      const removedIndex = current.equipped[section].findIndex(
        (lineageId, slotIndex) =>
          Boolean(lineageId) && restored[slotIndex] !== lineageId,
      );
      const restoredIds = restored.filter(Boolean);
      const replacement =
        removedIndex >= 0
          ? deckIds.find(
              (lineageId, index) =>
                index >= removedIndex && !restoredIds.includes(lineageId),
            ) ??
            deckIds.find((lineageId) => !restoredIds.includes(lineageId)) ??
            null
          : null;

      nextEquipped[section] = restored;
      nextSuggested[section] = replacement;
    });

    return {
      tracks: nextTracks,
      equipped: nextEquipped,
      memory: nextMemory,
      overrides: nextOverrides,
      suggested: nextSuggested,
    };
  }

  function applyRecommendedTracks(
    current: CardSystemStateOf<S, T>,
    recommended: TrackValuesOf<T>,
    preserveOverrides: boolean,
  ) {
    if (!preserveOverrides) {
      return reconcileCardSystem(current, recommended, []);
    }

    const nextTracks = { ...current.tracks };
    trackIds.forEach((trackId) => {
      if (!current.overrides.includes(trackId)) {
        nextTracks[trackId] = recommended[trackId];
      }
    });

    return reconcileCardSystem(current, nextTracks);
  }

  function setTrackValue(
    current: CardSystemStateOf<S, T>,
    trackId: T,
    value: number,
  ) {
    if (current.tracks[trackId] === value) {
      return current;
    }

    const nextOverrides = current.overrides.includes(trackId)
      ? current.overrides
      : [...current.overrides, trackId];

    return reconcileCardSystem(
      current,
      { ...current.tracks, [trackId]: value },
      nextOverrides,
    );
  }

  function toggleEquippedCard(
    current: CardSystemStateOf<S, T>,
    section: S,
    lineageId: string,
  ): CardSystemStateOf<S, T> {
    const nextCards = Array.from(
      { length: slotBudgets[section] },
      (_, slotIndex) => current.equipped[section][slotIndex] ?? "",
    );
    const selectedIndex = nextCards.indexOf(lineageId);

    if (selectedIndex >= 0) {
      nextCards[selectedIndex] = "";
    } else {
      const emptyIndex = nextCards.indexOf("");
      if (emptyIndex >= 0) {
        nextCards[emptyIndex] = lineageId;
      }
    }

    return {
      ...current,
      equipped: { ...current.equipped, [section]: nextCards },
      suggested: { ...current.suggested, [section]: null },
    };
  }

  function placeEquippedCard(
    current: CardSystemStateOf<S, T>,
    section: S,
    slotIndex: number,
    lineageId: string,
  ): CardSystemStateOf<S, T> {
    const nextCards = insertIntoSlots(
      current.equipped[section],
      slotIndex,
      lineageId,
      slotBudgets[section],
    );

    return {
      ...current,
      equipped: { ...current.equipped, [section]: nextCards },
      suggested: { ...current.suggested, [section]: null },
    };
  }

  function clearEquippedCards(
    current: CardSystemStateOf<S, T>,
    section: S,
  ): CardSystemStateOf<S, T> {
    return {
      ...current,
      equipped: {
        ...current.equipped,
        [section]: Array.from({ length: slotBudgets[section] }, () => ""),
      },
      suggested: { ...current.suggested, [section]: null },
    };
  }

  function removeEquippedCard(
    current: CardSystemStateOf<S, T>,
    section: S,
    slotIndex: number,
  ): CardSystemStateOf<S, T> {
    const nextCards = Array.from(
      { length: slotBudgets[section] },
      (_, index) => current.equipped[section][index] ?? "",
    );
    nextCards[slotIndex] = "";

    return {
      ...current,
      equipped: { ...current.equipped, [section]: nextCards },
    };
  }

  return {
    sections,
    trackIds,
    sectionTracks,
    slotBudgets,
    defaultTrackValues,
    cardFamily,
    getTrackDefinition,
    getTrackMax,
    getSectionConfigurationKey,
    isLineageCompatible,
    getSectionDeck,
    getCardGrade,
    getCardGradeIndex,
    getCardArt,
    getCardBio,
    getLineage,
    getEquippedInstructions,
    sanitizeCardSystemShape,
    createEmptyEquippedCards,
    createEmptySnapMemory,
    createEmptySuggestedCards,
    createEquippedSlots,
    createCardSystem,
    reconcileCardSystem,
    applyRecommendedTracks,
    setTrackValue,
    toggleEquippedCard,
    placeEquippedCard,
    clearEquippedCards,
    removeEquippedCard,
  };
}

export type CardEngine<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T> = CardLineageOf<S, T>,
> = ReturnType<typeof createCardEngine<S, T, L>>;
