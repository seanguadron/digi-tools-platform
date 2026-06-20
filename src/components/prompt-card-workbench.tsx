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
import { CardIllustrationFrame } from "@/components/prompt-builder-ui";
import { useCardDeckMotion } from "@/hooks/use-card-deck-motion";
import {
  getCardFamily,
  getCardGrade,
  getLineage,
  getSectionDeck,
  getTrackDefinition,
  SECTION_SLOT_BUDGETS,
  SECTION_TRACKS,
} from "@/lib/prompt-card-system";
import type {
  CardLineage,
  CardSection,
  TrackId,
  TrackValues,
} from "@/lib/prompt-card-system";

const FLOATING_PANEL_WIDTH = 390;
const FLOATING_PANEL_GAP = 12;
const FLOATING_PANEL_MARGIN = 16;
const FLOATING_PANEL_MAX_HEIGHT = 480;

type ActiveDrag = {
  lineageId: string;
  kind: "card" | "slot";
  fromSlot?: number;
};

function getFloatingPanelPosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const rightSideLeft = rect.right + FLOATING_PANEL_GAP;
  const leftSideLeft = rect.left - FLOATING_PANEL_WIDTH - FLOATING_PANEL_GAP;
  const fitsRight =
    rightSideLeft + FLOATING_PANEL_WIDTH <=
    window.innerWidth - FLOATING_PANEL_MARGIN;
  const left = fitsRight
    ? rightSideLeft
    : Math.max(FLOATING_PANEL_MARGIN, leftSideLeft);
  const top = Math.min(
    Math.max(FLOATING_PANEL_MARGIN, rect.top),
    Math.max(
      FLOATING_PANEL_MARGIN,
      window.innerHeight - FLOATING_PANEL_MAX_HEIGHT - FLOATING_PANEL_MARGIN,
    ),
  );

  return { left, top };
}

function CardFace({
  lineage,
  values,
  selected,
}: {
  lineage: CardLineage;
  values: TrackValues;
  selected: boolean;
}) {
  const grade = getCardGrade(lineage, values);

  return (
    <>
      <span className="lineage-card-topline">
        <span>{getCardFamily(lineage.section)}</span>
        <span>{lineage.code}</span>
      </span>
      <CardIllustrationFrame
        className="lineage-card-art"
        illustration={grade.illustration ?? lineage.illustration}
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

function SnapTrack({
  trackId,
  value,
  formatCode,
  onChange,
}: {
  trackId: TrackId;
  value: number;
  formatCode: string;
  onChange: (value: number) => void;
}) {
  const definition = getTrackDefinition(trackId, formatCode);
  const activeLabel = definition.points[value];

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

function WorkbenchCard({
  lineage,
  values,
  selected,
  suggested,
  onToggle,
  onPreview,
  onClearPreview,
}: {
  lineage: CardLineage;
  values: TrackValues;
  selected: boolean;
  suggested: boolean;
  onToggle: () => void;
  onPreview: (element: HTMLElement) => void;
  onClearPreview: () => void;
}) {
  const grade = getCardGrade(lineage, values);
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
      <CardFace lineage={lineage} values={values} selected={selected} />
    </button>
  );
}

function SlotCard({
  lineage,
  values,
  slotIndex,
  settling,
  onPreview,
  onClearPreview,
}: {
  lineage: CardLineage;
  values: TrackValues;
  slotIndex: number;
  settling: boolean;
  onPreview: (element: HTMLElement) => void;
  onClearPreview: () => void;
}) {
  const grade = getCardGrade(lineage, values);
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
      <CardFace lineage={lineage} values={values} selected />
    </div>
  );
}

function CardSlot({
  slotIndex,
  lineage,
  values,
  settling,
  onRemove,
  onPreview,
  onClearPreview,
}: {
  slotIndex: number;
  lineage: CardLineage | null;
  values: TrackValues;
  settling: boolean;
  onRemove: (slotIndex: number) => void;
  onPreview: (element: HTMLElement) => void;
  onClearPreview: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropslot:${slotIndex}`,
    data: { slotIndex, kind: "slot" },
  });
  const grade = lineage ? getCardGrade(lineage, values) : null;

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

export function PromptCardWorkbench({
  section,
  formatCode,
  values,
  equippedIds,
  suggestedId,
  onTrackChange,
  onToggleCard,
  onDropCard,
  onRemoveCard,
  onClearCards,
}: {
  section: CardSection;
  formatCode: string;
  values: TrackValues;
  equippedIds: string[];
  suggestedId: string | null;
  onTrackChange: (trackId: TrackId, value: number) => void;
  onToggleCard: (lineageId: string) => void;
  onDropCard: (slotIndex: number, lineageId: string) => void;
  onRemoveCard: (slotIndex: number) => void;
  onClearCards: () => void;
}) {
  const deck = useMemo(
    () => getSectionDeck(section, values),
    [section, values],
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
  const [previewAnchor, setPreviewAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const portalTarget =
    typeof document === "undefined" ? null : document.body;
  const visibleDeck = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return deck;
    }

    return deck.filter((lineage) => {
      const grade = getCardGrade(lineage, values);
      return [
        lineage.code,
        getCardFamily(lineage.section),
        grade.name,
        grade.description,
        ...lineage.goals,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [deck, searchQuery, values]);
  const previewLineage = getLineage(previewId ?? "");
  const previewGrade = previewLineage
    ? getCardGrade(previewLineage, values)
    : null;
  const slotBudget = SECTION_SLOT_BUDGETS[section];
  const dragLineage = activeDrag ? getLineage(activeDrag.lineageId) : null;

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
                slotIndex={slotIndex}
                lineage={getLineage(equippedIds[slotIndex] ?? "") ?? null}
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
            <small>{SECTION_TRACKS[section].length}</small>
          </div>
          <div className="tuning-track-list">
            {SECTION_TRACKS[section].map((trackId) => (
              <SnapTrack
                trackId={trackId}
                value={values[trackId]}
                formatCode={formatCode}
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
                  illustration={
                    previewGrade.illustration ?? previewLineage.illustration
                  }
                  fallback={previewLineage.code.slice(0, 1)}
                />
                <div className="floating-card-panel-identity">
                  <span>{previewLineage.code} / {getCardFamily(previewLineage.section)}</span>
                  <strong>{previewGrade.name}</strong>
                  <p>{previewGrade.description}</p>
                </div>
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
                  <CardFace lineage={dragLineage} values={values} selected />
                </div>
              ) : null}
            </DragOverlay>,
            portalTarget,
          )
        : null}
    </DndContext>
  );
}
