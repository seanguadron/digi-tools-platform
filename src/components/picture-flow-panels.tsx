"use client";

import type { ReactNode, RefObject } from "react";
import { PromptCardWorkbench } from "@/components/prompt-card-workbench";
import {
  CraftCard,
  CraftDictationField,
  FieldHeading,
  FlowActions,
  type DictationApi,
  type FieldGuidance,
} from "@/components/prompt-builder-ui";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import { pictureCardEngine } from "@/lib/picture-card-system";
import {
  CHAOS_RANGE,
  PICTURE_ASPECT_RATIOS,
  PICTURE_PARTS,
  STYLIZE_RANGE,
  WEIRD_RANGE,
} from "@/lib/picture-deck-state";
import { PICTURE_PANEL_INDEX } from "@/lib/picture-navigation";
import type { PictureSection } from "@/lib/picture-prompt";
import type {
  PictureCardSystemState,
  PictureDraft,
  PictureDraftTextField,
  PictureRange,
  PictureTrackId,
} from "@/lib/picture-types";

export type PictureDictationField = "subject";

type TailNumberField = "stylize" | "chaos" | "weird";

// Panel guidance, inline (the CRAFT keyed lookup stays CRAFT's).
const PANEL_GUIDANCE: Record<PictureSection, FieldGuidance> = {
  protagonist: {
    title: "Protagonist help",
    body: "Describe who or what the image is about in plain words.",
    points: [
      "Concrete beats vague: 'a fox in a yellow raincoat' over 'an animal'.",
      "Cards can add a companion figure or scale contrast.",
    ],
  },
  illumination: {
    title: "Illumination help",
    body: "Pick the light the scene is built from.",
    points: [
      "One strong light idea reads better than three faint ones.",
      "Slide Intensity to go from a hint to the whole frame.",
    ],
  },
  canvas: {
    title: "Canvas help",
    body: "Choose the medium the image pretends to be.",
    points: [
      "Mediums fight each other; two at most.",
      "Extreme grades make the medium the subject.",
    ],
  },
  tone: {
    title: "Tone help",
    body: "Set the palette and its attitude.",
    points: [
      "Muted and neon pull opposite directions; pick a side.",
      "Tone reads strongest in backgrounds and skies.",
    ],
  },
  universe: {
    title: "Universe help",
    body: "Place the subject in a world, era, or setting.",
    points: [
      "The world card carries weather, place, and period.",
      "Leave it empty for a clean studio-like backdrop.",
    ],
  },
  references: {
    title: "References help",
    body: "Channel artists, movements, and aesthetics.",
    points: [
      "Stack up to four; order does not matter, weight does.",
      "References mix with Canvas: 'ukiyo-e watercolor' is a real look.",
    ],
  },
  execution: {
    title: "Execution help",
    body: "Frame the shot and finish the prompt.",
    points: [
      "Framing cards set camera distance and angle.",
      "The Midjourney tail stays out of the prompt until you enable it.",
    ],
  },
};

const SECTION_LETTERS: Record<PictureSection, string> = {
  protagonist: "P",
  illumination: "I",
  canvas: "C",
  tone: "T",
  universe: "U",
  references: "R",
  execution: "E",
};

function TailRangeRow({
  label,
  flag,
  field,
  range,
  value,
  disabled,
  onSetNumber,
}: {
  label: string;
  flag: string;
  field: TailNumberField;
  range: PictureRange;
  value: number | null;
  disabled: boolean;
  onSetNumber: (field: TailNumberField, value: number | null) => void;
}) {
  const controlId = `picture-tail-${field}`;

  return (
    <div className="picture-deck-range-row">
      <label htmlFor={controlId}>
        <strong>{label}</strong>
        <small>{flag}</small>
      </label>
      <input
        id={controlId}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value ?? range.fallback}
        disabled={disabled}
        onChange={(event) => onSetNumber(field, Number(event.target.value))}
        aria-valuetext={value === null ? "Model default" : String(value)}
      />
      <output htmlFor={controlId}>
        {value === null ? "Auto" : value}
      </output>
      <button
        className="button button-quiet"
        type="button"
        disabled={disabled || value === null}
        onClick={() => onSetNumber(field, null)}
      >
        Auto
      </button>
    </div>
  );
}

export function PictureFlowPanels({
  activePanel,
  registerPanelHeading,
  flowViewportRef,
  draft,
  cardSystem,
  stepComplete,
  attentionTargetId,
  dictation,
  navigateToPanel,
  navigateToPictureStep,
  onUpdateDraft,
  onSetTailEnabled,
  onSelectAspectRatio,
  onSetTailNumber,
  onChangeTrack,
  onToggleCard,
  onDropCard,
  onRemoveCard,
  onClearCards,
  onReviewOutput,
}: {
  activePanel: number;
  registerPanelHeading: (
    panelIndex: number,
    node: HTMLHeadingElement | null,
  ) => void;
  flowViewportRef: RefObject<HTMLDivElement | null>;
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
  stepComplete: readonly boolean[];
  attentionTargetId: string | null;
  dictation: DictationApi<PictureDictationField>;
  navigateToPanel: (panelIndex: number, focusTargetId?: string) => void;
  navigateToPictureStep: (stepIndex: number) => void;
  onUpdateDraft: (field: PictureDraftTextField, value: string) => void;
  onSetTailEnabled: (value: boolean) => void;
  onSelectAspectRatio: (value: string) => void;
  onSetTailNumber: (field: TailNumberField, value: number | null) => void;
  onChangeTrack: (
    section: PictureSection,
    trackId: PictureTrackId,
    value: number,
  ) => void;
  onToggleCard: (section: PictureSection, lineageId: string) => void;
  onDropCard: (
    section: PictureSection,
    slotIndex: number,
    lineageId: string,
  ) => void;
  onRemoveCard: (section: PictureSection, slotIndex: number) => void;
  onClearCards: (section: PictureSection) => void;
  onReviewOutput: () => void;
}) {
  const activeAspectIndex = PICTURE_ASPECT_RATIOS.findIndex(
    (option) => option.value === draft.aspectRatio,
  );
  const aspectGroup = useRovingRadioGroup(
    PICTURE_ASPECT_RATIOS.length,
    activeAspectIndex,
    (index) => {
      const option = PICTURE_ASPECT_RATIOS[index];
      if (option) onSelectAspectRatio(option.value);
    },
  );
  const tailDisabled = !draft.mjTailEnabled;

  function sectionWorkbench(section: PictureSection, controlId: string) {
    return (
      <div id={controlId}>
        <PromptCardWorkbench
          engine={pictureCardEngine}
          section={section}
          vocabularyKey="PICTURE"
          values={cardSystem.tracks}
          equippedIds={cardSystem.equipped[section]}
          suggestedId={cardSystem.suggested[section]}
          onTrackChange={(trackId, value) =>
            onChangeTrack(section, trackId, value)
          }
          onToggleCard={(lineageId) => onToggleCard(section, lineageId)}
          onDropCard={(slotIndex, lineageId) =>
            onDropCard(section, slotIndex, lineageId)
          }
          onRemoveCard={(slotIndex) => onRemoveCard(section, slotIndex)}
          onClearCards={() => onClearCards(section)}
        />
      </div>
    );
  }

  function cardPanel(section: PictureSection, children?: ReactNode) {
    const panelIndex = PICTURE_PANEL_INDEX[section];
    const stepIndex = panelIndex - 1;
    const part = PICTURE_PARTS[stepIndex];
    const isLast = section === "execution";

    return (
      <section
        className="flow-panel"
        aria-hidden={activePanel !== panelIndex}
        inert={activePanel !== panelIndex}
        key={section}
      >
        <div className="flow-panel-heading">
          <span aria-hidden="true">{SECTION_LETTERS[section]}</span>
          <h2
            tabIndex={-1}
            ref={(node) => {
              registerPanelHeading(panelIndex, node);
            }}
          >
            {part.label}
          </h2>
        </div>

        <div className="flow-panel-card">
          <CraftCard
            letter={SECTION_LETTERS[section]}
            complete={stepComplete[stepIndex]}
          >
            <div className="field craft-field">
              <FieldHeading
                guidance={PANEL_GUIDANCE[section]}
                label={`${part.label} cards`}
                controlId={`picture-${section}-workbench`}
                labelControl={false}
              />
              {children}
              {sectionWorkbench(section, `picture-${section}-workbench`)}
            </div>
          </CraftCard>
        </div>

        <FlowActions
          onBack={() => navigateToPanel(panelIndex - 1)}
          onNext={
            isLast ? onReviewOutput : () => navigateToPanel(panelIndex + 1)
          }
          nextLabel={isLast ? "Review output" : "Next"}
        />
      </section>
    );
  }

  return (
    <div className="flow-viewport" ref={flowViewportRef}>
      <div
        className="flow-track"
        style={{
          transform: `translate3d(-${activePanel * 100}%, 0, 0)`,
        }}
      >
        <section
          className="flow-panel flow-intro-panel"
          aria-hidden={activePanel !== PICTURE_PANEL_INDEX.guide}
          inert={activePanel !== PICTURE_PANEL_INDEX.guide}
        >
          <div className="craft-method" aria-labelledby="picture-method-title">
            <div className="craft-method-copy">
              <h2
                id="picture-method-title"
                tabIndex={-1}
                ref={(node) => {
                  registerPanelHeading(PICTURE_PANEL_INDEX.guide, node);
                }}
              >
                Build with P.I.C.T.U.R.E.
              </h2>
              <p>
                Name your subject, then stack light, medium, palette, world,
                references, and framing cards. The image prompt updates as you
                go, with an optional Midjourney tail at the end.
              </p>
            </div>
            <div className="craft-definition" role="list">
              {PICTURE_PARTS.map(({ letter, label, summary }, index) => (
                <button
                  className="craft-definition-card"
                  type="button"
                  role="listitem"
                  onClick={() => navigateToPictureStep(index)}
                  key={letter}
                >
                  <span className="craft-definition-letter">{letter}</span>
                  <strong>{label}</strong>
                  <small>{summary}</small>
                </button>
              ))}
            </div>
            <FlowActions
              onNext={() => navigateToPanel(PICTURE_PANEL_INDEX.protagonist)}
              nextLabel="Start"
            />
          </div>
        </section>

        {cardPanel(
          "protagonist",
          <div className="field">
            <FieldHeading
              guidance={PANEL_GUIDANCE.protagonist}
              label="Subject"
              hint="The one required line: who or what the image is about."
              controlId="picture-subject"
            />
            <CraftDictationField
              id="picture-subject"
              field="subject"
              label="Subject"
              value={draft.subject}
              placeholder="a fox in a yellow raincoat crossing a flooded street"
              rows={3}
              required
              attention={attentionTargetId === "picture-subject"}
              onChange={(value) => onUpdateDraft("subject", value)}
              dictation={dictation}
            />
          </div>,
        )}
        {cardPanel("illumination")}
        {cardPanel("canvas")}
        {cardPanel("tone")}
        {cardPanel("universe")}
        {cardPanel("references")}
        {cardPanel(
          "execution",
          <fieldset className="picture-deck-tail">
            <legend className="sr-only">Midjourney parameter tail</legend>
            <label className="workbench-default-check picture-deck-tail-toggle">
              <input
                type="checkbox"
                checked={draft.mjTailEnabled}
                onChange={(event) => onSetTailEnabled(event.target.checked)}
              />
              <span>
                <strong>Midjourney tail</strong>
                <small>
                  Append --ar, --stylize, --chaos, --weird, and --no to the
                  prompt. Off keeps the prompt model-agnostic.
                </small>
              </span>
            </label>

            <div
              className={
                tailDisabled
                  ? "picture-deck-tail-body is-disabled"
                  : "picture-deck-tail-body"
              }
            >
              <div className="picture-deck-ar-group">
                <span className="picture-deck-tail-label" id="picture-ar-label">
                  Aspect ratio
                </span>
                <div
                  className="picture-deck-ar-row"
                  role="radiogroup"
                  aria-labelledby="picture-ar-label"
                >
                  {PICTURE_ASPECT_RATIOS.map((option, index) => {
                    const selected = draft.aspectRatio === option.value;
                    return (
                      <button
                        className={
                          selected
                            ? "picture-deck-ar-tab is-selected"
                            : "picture-deck-ar-tab"
                        }
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={tailDisabled}
                        onClick={() => onSelectAspectRatio(option.value)}
                        key={option.id}
                        {...aspectGroup.itemProps(index)}
                      >
                        <span>{option.value}</span>
                        <small>{option.label}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <TailRangeRow
                label="Stylize"
                flag="--stylize"
                field="stylize"
                range={STYLIZE_RANGE}
                value={draft.stylize}
                disabled={tailDisabled}
                onSetNumber={onSetTailNumber}
              />
              <TailRangeRow
                label="Chaos"
                flag="--chaos"
                field="chaos"
                range={CHAOS_RANGE}
                value={draft.chaos}
                disabled={tailDisabled}
                onSetNumber={onSetTailNumber}
              />
              <TailRangeRow
                label="Weird"
                flag="--weird"
                field="weird"
                range={WEIRD_RANGE}
                value={draft.weird}
                disabled={tailDisabled}
                onSetNumber={onSetTailNumber}
              />

              <label className="field picture-deck-negative">
                <span>
                  <strong>Exclude</strong>
                  <small>--no</small>
                </span>
                <input
                  type="text"
                  value={draft.negative}
                  disabled={tailDisabled}
                  placeholder="text, watermark, blur"
                  onChange={(event) =>
                    onUpdateDraft("negative", event.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>,
        )}
      </div>
    </div>
  );
}
