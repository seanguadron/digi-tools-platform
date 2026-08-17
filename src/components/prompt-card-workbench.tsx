"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CardBio, CardIllustrationFrame } from "@/components/prompt-builder-ui";
import { useCardDeckMotion } from "@/hooks/use-card-deck-motion";
import { usePortalTarget } from "@/hooks/use-portal-target";
import type {
  CardEngine,
  CardLineageOf,
  TrackValuesOf,
} from "@/lib/card-engine";
import { getFloatingPanelPosition } from "@/lib/floating-panel-position";

type ActiveDrag = {
  lineageId: string;
  kind: "card" | "slot";
  fromSlot?: number;
};

function CardFace<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T>,
>({
  engine,
  lineage,
  values,
  selected,
}: {
  engine: CardEngine<S, T, L>;
  lineage: L;
  values: TrackValuesOf<T>;
  selected: boolean;
}) {
  const grade = engine.getCardGrade(lineage, values);

  return (
    <>
      <span className="lineage-card-topline">
        <span>{engine.cardFamily(lineage.section)}</span>
        <span>{lineage.code}</span>
      </span>
      <CardIllustrationFrame
        className="lineage-card-art"
        illustration={engine.getCardArt(lineage, values)}
        fallback={lineage.code.slice(0, 1)}
      />
      <span className="lineage-card-copy" key={grade.name}>
        <strong>{grade.name}</strong>
      </span>
      {selected ? (
        <span className="lineage-card-action" aria-hidden="true">
          Equipped
        </span>
      ) : null}
    </>
  );
}

function SnapTrack<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T>,
>({
  engine,
  trackId,
  value,
  vocabularyKey,
  onChange,
}: {
  engine: CardEngine<S, T, L>;
  trackId: T;
  value: number;
  vocabularyKey: string;
  onChange: (value: number) => void;
}) {
  const definition = engine.getTrackDefinition(trackId, vocabularyKey);
  const activeLabel =
    definition.points[value] ?? definition.points[definition.points.length - 1];

  return (
    <div className="tuning-track">
      <div className="tuning-track-heading">
        <strong>{definition.label}</strong>
        <span>{activeLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={definition.points.length - 1}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={definition.label}
        aria-valuetext={activeLabel}
      />
      <div
        className="tuning-track-points"
        style={{
          gridTemplateColumns: `repeat(${definition.points.length}, minmax(0, 1fr))`,
        }}
      >
        {definition.points.map((point, index) => (
          <button
            className={index === value ? "is-active" : ""}
            type="button"
            onClick={() => onChange(index)}
            aria-pressed={index === value}
            key={point}
          >
            <span aria-hidden="true" />
            {point}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkbenchCard<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T>,
>({
  engine,
  lineage,
  values,
  selected,
  suggested,
  onToggle,
  onPreview,
  onClearPreview,
}: {
  engine: CardEngine<S, T, L>;
  lineage: L;
  values: TrackValuesOf<T>;
  selected: boolean;
  suggested: boolean;
  onToggle: () => void;
  onPreview: (element: HTMLElement) => void;
  onClearPreview: () => void;
}) {
  const grade = engine.getCardGrade(lineage, values);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card:${lineage.id}`,
    data: { lineageId: lineage.id, kind: "card" } satisfies ActiveDrag,
  });

  return (
    <button
      ref={setNodeRef}
      className={[
        "lineage-card",
        selected ? "is-selected" : "",
        suggested ? "is-compatible-suggestion" : "",
        isDragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      data-motion-card
      onClick={onToggle}
      onMouseEnter={(event) => onPreview(event.currentTarget)}
      onMouseLeave={onClearPreview}
      onFocus={(event) => onPreview(event.currentTarget)}
      onBlur={onClearPreview}
      aria-label={`${selected ? "Remove" : "Equip"} ${grade.name}. ${grade.description}`}
      {...listeners}
      {...attributes}
      aria-pressed={selected}
    >
      <CardFace
        engine={engine}
        lineage={lineage}
        values={values}
        selected={selected}
      />
    </button>
  );
}

function SlotCard<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T>,
>({
  engine,
  lineage,
  values,
  slotIndex,
  settling,
  onPreview,
  onClearPreview,
}: {
  engine: CardEngine<S, T, L>;
  lineage: L;
  values: TrackValuesOf<T>;
  slotIndex: number;
  settling: boolean;
  onPreview: (element: HTMLElement) => void;
  onClearPreview: () => void;
}) {
  const grade = engine.getCardGrade(lineage, values);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slot:${slotIndex}`,
    data: {
      lineageId: lineage.id,
      kind: "slot",
      fromSlot: slotIndex,
    } satisfies ActiveDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "lineage-card slot-card is-selected",
        isDragging ? "is-dragging" : "",
        settling ? "is-settling" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={(event) => onPreview(event.currentTarget)}
      onMouseLeave={onClearPreview}
      onFocus={(event) => onPreview(event.currentTarget)}
      onBlur={onClearPreview}
      aria-label={`Move ${grade.name} from slot ${slotIndex + 1}`}
      {...listeners}
      {...attributes}
    >
      <CardFace engine={engine} lineage={lineage} values={values} selected />
    </div>
  );
}

function CardSlot<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T>,
>({
  engine,
  slotIndex,
  lineage,
  values,
  settling,
  onRemove,
  onPreview,
  onClearPreview,
}: {
  engine: CardEngine<S, T, L>;
  slotIndex: number;
  lineage: L | null;
  values: TrackValuesOf<T>;
  settling: boolean;
  onRemove: (slotIndex: number) => void;
  onPreview: (element: HTMLElement) => void;
  onClearPreview: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropslot:${slotIndex}`,
    data: { slotIndex, kind: "slot" },
  });
  const grade = lineage ? engine.getCardGrade(lineage, values) : null;

  return (
    <div
      ref={setNodeRef}
      className={[
        "card-slot",
        lineage ? "is-filled" : "",
        isOver ? "is-drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={
        lineage && grade
          ? `Slot ${slotIndex + 1}: ${grade.name}`
          : `Slot ${slotIndex + 1}: empty`
      }
    >
      <span>Slot {slotIndex + 1}</span>
      {lineage && grade ? (
        <>
          <SlotCard
            engine={engine}
            lineage={lineage}
            values={values}
            slotIndex={slotIndex}
            settling={settling}
            onPreview={onPreview}
            onClearPreview={onClearPreview}
          />
          <button
            type="button"
            onClick={() => onRemove(slotIndex)}
            aria-label={`Remove ${grade.name} from slot ${slotIndex + 1}`}
          >
            <span aria-hidden="true">x</span>
          </button>
        </>
      ) : (
        <>
          <strong className="card-slot-empty-mark" aria-hidden="true">
            +
          </strong>
          <span className="sr-only">Empty. Drop a compatible card here.</span>
        </>
      )}
    </div>
  );
}

function DeckDropZone({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "deck",
    data: { kind: "deck" },
  });

  return (
    <section
      ref={setNodeRef}
      className={
        isOver && active ? "category-deck is-remove-target" : "category-deck"
      }
      aria-label="Category card deck"
    >
      {children}
    </section>
  );
}

export function PromptCardWorkbench<
  S extends string,
  T extends string,
  L extends CardLineageOf<S, T>,
>({
  engine,
  section,
  vocabularyKey,
  values,
  equippedIds,
  suggestedId,
  onTrackChange,
  onToggleCard,
  onDropCard,
  onRemoveCard,
  onClearCards,
}: {
  engine: CardEngine<S, T, L>;
  section: S;
  vocabularyKey: string;
  values: TrackValuesOf<T>;
  equippedIds: string[];
  suggestedId: string | null;
  onTrackChange: (trackId: T, value: number) => void;
  onToggleCard: (lineageId: string) => void;
  onDropCard: (slotIndex: number, lineageId: string) => void;
  onRemoveCard: (slotIndex: number) => void;
  onClearCards: () => void;
}) {
  const deck = useMemo(
    () => engine.getSectionDeck(section, values),
    [engine, section, values],
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [settlingSlot, setSettlingSlot] = useState({ index: -1, token: 0 });
  const deckMotion = useCardDeckMotion();
  const slotMotion = useCardDeckMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [previewAnchor, setPreviewAnchor] = useState<ReturnType<
    typeof getFloatingPanelPosition
  > | null>(null);
  const portalTarget = usePortalTarget();
  const visibleDeck = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return deck;
    }

    return deck.filter((lineage) => {
      const grade = engine.getCardGrade(lineage, values);
      return [
        lineage.code,
        engine.cardFamily(lineage.section),
        grade.name,
        grade.description,
        ...lineage.goals,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [deck, engine, searchQuery, values]);
  const previewLineage = engine.getLineage(previewId ?? "");
  const previewGrade = previewLineage
    ? engine.getCardGrade(previewLineage, values)
    : null;
  const slotBudget = engine.slotBudgets[section];
  const dragLineage = activeDrag
    ? engine.getLineage(activeDrag.lineageId)
    : null;

  function previewCard(lineageId: string, element: HTMLElement) {
    setPreviewId(lineageId);
    setPreviewAnchor(getFloatingPanelPosition(element));
  }

  function clearPreview() {
    setPreviewId(null);
    setPreviewAnchor(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ActiveDrag | undefined;
    if (data) {
      setActiveDrag(data);
    }
    clearPreview();
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as ActiveDrag | undefined;
    setActiveDrag(null);
    const overData = event.over?.data.current as
      | { kind?: string; slotIndex?: number }
      | undefined;

    if (!data || !overData) {
      return;
    }

    if (overData.kind === "slot" && typeof overData.slotIndex === "number") {
      onDropCard(overData.slotIndex, data.lineageId);
      setSettlingSlot((current) => ({
        index: overData.slotIndex as number,
        token: current.token + 1,
      }));
    } else if (overData.kind === "deck" && data.kind === "slot") {
      if (typeof data.fromSlot === "number") {
        onRemoveCard(data.fromSlot);
      }
    }
  }

  return (
    <DndContext
      id={`workbench-${section}`}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className={`card-workbench card-workbench--${section}`}>
        <section className="card-slot-board" aria-label="Equipped card slots">
          <div className="workbench-section-heading">
            <strong>Loadout</strong>
            <small>
              {equippedIds.filter(Boolean).length}/{slotBudget}
            </small>
          </div>
          <div
            className="card-slot-grid"
            onPointerMove={slotMotion.onPointerMove}
            onPointerLeave={slotMotion.onPointerLeave}
          >
            {Array.from({ length: slotBudget }, (_, slotIndex) => (
              <CardSlot
                engine={engine}
                slotIndex={slotIndex}
                lineage={engine.getLineage(equippedIds[slotIndex] ?? "") ?? null}
                values={values}
                settling={settlingSlot.index === slotIndex}
                onRemove={onRemoveCard}
                onPreview={(element) =>
                  previewCard(equippedIds[slotIndex] ?? "", element)
                }
                onClearPreview={clearPreview}
                key={`${slotIndex}-${equippedIds[slotIndex] ?? "empty"}-${
                  settlingSlot.index === slotIndex ? settlingSlot.token : 0
                }`}
              />
            ))}
          </div>
          <button
            className="loadout-clear-button"
            type="button"
            onClick={onClearCards}
            disabled={!equippedIds.some(Boolean)}
          >
            Clear
          </button>
        </section>

        <DeckDropZone active={activeDrag?.kind === "slot"}>
          <div className="workbench-section-heading">
            <strong>Cards</strong>
            <small>
              {searchQuery ? `${visibleDeck.length}/${deck.length}` : deck.length}
            </small>
          </div>
          <div
            className="lineage-card-grid"
            onPointerMove={deckMotion.onPointerMove}
            onPointerLeave={deckMotion.onPointerLeave}
          >
            {visibleDeck.map((lineage) => (
              <WorkbenchCard
                engine={engine}
                lineage={lineage}
                values={values}
                selected={equippedIds.includes(lineage.id)}
                suggested={suggestedId === lineage.id}
                onToggle={() => onToggleCard(lineage.id)}
                onPreview={(element) => previewCard(lineage.id, element)}
                onClearPreview={clearPreview}
                key={lineage.id}
              />
            ))}
            {visibleDeck.length === 0 ? (
              <p className="deck-empty-state">No matching cards.</p>
            ) : null}
          </div>
          <label className="deck-search">
            <span className="sr-only">Search cards</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Find cards"
            />
            <small>{visibleDeck.length} shown</small>
          </label>
        </DeckDropZone>

        <section className="tuning-console" aria-label="Tuning tracks">
          <div className="workbench-section-heading">
            <strong>Tuning</strong>
            <small>{engine.sectionTracks[section].length}</small>
          </div>
          <div className="tuning-track-list">
            {engine.sectionTracks[section].map((trackId) => (
              <SnapTrack
                engine={engine}
                trackId={trackId}
                value={values[trackId]}
                vocabularyKey={vocabularyKey}
                onChange={(value) => onTrackChange(trackId, value)}
                key={trackId}
              />
            ))}
          </div>
        </section>

        {portalTarget && previewLineage && previewGrade && previewAnchor && !activeDrag
          ? createPortal(
              <aside
                className="floating-card-panel"
                style={previewAnchor}
                aria-live="polite"
              >
                <CardIllustrationFrame
                  className="floating-card-art"
                  illustration={engine.getCardArt(previewLineage, values)}
                  fallback={previewLineage.code.slice(0, 1)}
                />
                <div className="floating-card-panel-identity">
                  <span>{previewLineage.code} / {engine.cardFamily(previewLineage.section)}</span>
                  <strong>{previewGrade.name}</strong>
                  <p>{previewGrade.description}</p>
                </div>
                <CardBio text={engine.getCardBio(previewLineage)} />
                <div className="ability-guidance">
                  <span>What this adds</span>
                  <ul>
                    {previewLineage.goals.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                </div>
                <code>
                  {previewGrade.instruction} Focus on these outcomes:{" "}
                  {previewLineage.goals.join(" ")}
                </code>
              </aside>,
              portalTarget,
            )
          : null}
      </div>

      {portalTarget
        ? createPortal(
            <DragOverlay dropAnimation={null} zIndex={120}>
              {dragLineage ? (
                <div className="lineage-card card-drag-overlay is-selected">
                  <CardFace
                    engine={engine}
                    lineage={dragLineage}
                    values={values}
                    selected
                  />
                </div>
              ) : null}
            </DragOverlay>,
            portalTarget,
          )
        : null}
    </DndContext>
  );
}
