"use client";

import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";
import { CardIllustrationFrame } from "@/components/prompt-builder-ui";
import { useCardDeckMotion } from "@/hooks/use-card-deck-motion";
import { attachCardDragPreview } from "@/lib/card-motion";
import {
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

const CARD_DRAG_TYPE = "application/x-digitools-card";
const FLOATING_PANEL_WIDTH = 390;
const FLOATING_PANEL_GAP = 12;
const FLOATING_PANEL_MARGIN = 16;
const FLOATING_PANEL_MAX_HEIGHT = 480;

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

  return {
    left,
    top,
  };
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
        <span>{lineage.family}</span>
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
  const [dragging, setDragging] = useState(false);
  const dragPreviewCleanupRef = useRef<null | (() => void)>(null);

  function beginDrag(event: DragEvent<HTMLButtonElement>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(CARD_DRAG_TYPE, lineage.id);
    event.dataTransfer.setData("text/plain", lineage.id);
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = attachCardDragPreview(
      event.currentTarget,
      event.dataTransfer,
      event.clientX,
      event.clientY,
    );
    setDragging(true);
  }

  function endDrag() {
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = null;
    setDragging(false);
    onClearPreview();
  }

  return (
    <button
      className={[
        "lineage-card",
        selected ? "is-selected" : "",
        suggested ? "is-compatible-suggestion" : "",
        dragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      draggable
      data-motion-card
      onDragStart={beginDrag}
      onDragEnd={endDrag}
      onClick={onToggle}
      onMouseEnter={(event) => onPreview(event.currentTarget)}
      onMouseLeave={onClearPreview}
      onFocus={(event) => onPreview(event.currentTarget)}
      onBlur={onClearPreview}
      aria-pressed={selected}
      aria-label={`${selected ? "Remove" : "Equip"} ${grade.name}. ${grade.description}`}
    >
      <CardFace lineage={lineage} values={values} selected={selected} />
    </button>
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
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [settlingSlot, setSettlingSlot] = useState({
    index: -1,
    token: 0,
  });
  const slotDragCleanupRef = useRef<null | (() => void)>(null);
  const deckMotion = useCardDeckMotion();
  const slotMotion = useCardDeckMotion();
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
        lineage.family,
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

  function previewCard(lineageId: string, element: HTMLElement) {
    setPreviewId(lineageId);
    setPreviewAnchor(getFloatingPanelPosition(element));
  }

  function clearPreview() {
    setPreviewId(null);
    setPreviewAnchor(null);
  }

  function acceptDrop(event: DragEvent<HTMLDivElement>, slotIndex: number) {
    event.preventDefault();
    const lineageId =
      event.dataTransfer.getData(CARD_DRAG_TYPE) ||
      event.dataTransfer.getData("text/plain");
    const lineage = deck.find((candidate) => candidate.id === lineageId);

    if (lineage) {
      onDropCard(slotIndex, lineage.id);
      clearPreview();
      setSettlingSlot((current) => ({
        index: slotIndex,
        token: current.token + 1,
      }));
    }
  }

  function beginSlotDrag(
    event: DragEvent<HTMLDivElement>,
    lineageId: string,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(CARD_DRAG_TYPE, lineageId);
    event.dataTransfer.setData("text/plain", lineageId);
    slotDragCleanupRef.current?.();
    slotDragCleanupRef.current = attachCardDragPreview(
      event.currentTarget,
      event.dataTransfer,
      event.clientX,
      event.clientY,
    );
    setDraggingSlotId(lineageId);
  }

  function endSlotDrag() {
    slotDragCleanupRef.current?.();
    slotDragCleanupRef.current = null;
    setDraggingSlotId(null);
    clearPreview();
  }

  return (
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
          {Array.from({ length: slotBudget }, (_, slotIndex) => {
            const lineage = getLineage(equippedIds[slotIndex] ?? "");
            const grade = lineage ? getCardGrade(lineage, values) : null;

            return (
              <div
                className={lineage ? "card-slot is-filled" : "card-slot"}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => acceptDrop(event, slotIndex)}
                key={slotIndex}
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
                    <div
                      className={[
                        "lineage-card slot-card is-selected",
                        draggingSlotId === lineage.id ? "is-dragging" : "",
                        settlingSlot.index === slotIndex ? "is-settling" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      draggable
                      data-motion-card
                      tabIndex={0}
                      onDragStart={(event) =>
                        beginSlotDrag(event, lineage.id)
                      }
                      onDragEnd={endSlotDrag}
                      onMouseEnter={(event) =>
                        previewCard(lineage.id, event.currentTarget)
                      }
                      onMouseLeave={clearPreview}
                      onFocus={(event) =>
                        previewCard(lineage.id, event.currentTarget)
                      }
                      onBlur={clearPreview}
                      aria-label={`Move ${grade.name} from slot ${slotIndex + 1}`}
                      key={`${lineage.id}-${settlingSlot.index === slotIndex ? settlingSlot.token : 0}`}
                    >
                      <CardFace
                        lineage={lineage}
                        values={values}
                        selected
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveCard(slotIndex)}
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
                    <span className="sr-only">
                      Empty. Drop a compatible card here.
                    </span>
                  </>
                )}
              </div>
            );
          })}
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

      <section className="category-deck" aria-label="Category card deck">
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
      </section>

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

      {portalTarget && previewLineage && previewGrade && previewAnchor
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
                <span>{previewLineage.code} / {previewLineage.family}</span>
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
  );
}
