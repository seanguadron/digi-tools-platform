"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PictureDeckHeader } from "@/components/picture-deck-header";
import { PictureFlowPanels } from "@/components/picture-flow-panels";
import type { PictureDictationField } from "@/components/picture-flow-panels";
import type { DictationApi } from "@/components/prompt-builder-ui";
import { PromptOutputDock } from "@/components/prompt-output-dock";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePictureDeckHistory } from "@/hooks/use-picture-deck-history";
import { usePictureDeckPersistence } from "@/hooks/use-picture-deck-persistence";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { usePromptDictation } from "@/hooks/use-prompt-dictation";
import { useFlowNavigation } from "@/hooks/use-flow-navigation";
import { downloadTextFile, slugifyFilename } from "@/lib/browser-download";
import {
  getEquippedFragments,
  pictureCardEngine,
} from "@/lib/picture-card-system";
import {
  createPictureCardSystem,
  draftTail,
  EMPTY_PICTURE_DRAFT,
  EXAMPLE_PICTURE_DRAFT,
  isPictureFieldComplete,
  PICTURE_PARTS,
  PICTURE_REQUIRED_FIELDS,
  withPictureDraftText,
} from "@/lib/picture-deck-state";
import {
  getNextIncompletePicturePanel,
  getPictureStepIndexForPanel,
  getPictureStepPanel,
  PICTURE_PANEL_COUNT,
  PICTURE_PANEL_INDEX,
} from "@/lib/picture-navigation";
import {
  buildPicturePrompt,
  buildPictureSections,
  PICTURE_SECTIONS,
} from "@/lib/picture-prompt";
import type { PictureSection } from "@/lib/picture-prompt";
import type {
  PictureCardSystemState,
  PictureDraft,
  PictureDraftTextField,
  PictureTrackId,
} from "@/lib/picture-types";
import { PHONE_MEDIA_QUERY } from "@/lib/tool-registry";

export function PictureDeck() {
  const [draft, setDraft] = useState<PictureDraft>(EMPTY_PICTURE_DRAFT);
  const [cardSystem, setCardSystem] = useState<PictureCardSystemState>(
    createPictureCardSystem,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  // At phone widths the expanded dock overlays the whole workspace, so the
  // default is collapsed there and expanded everywhere else; any explicit
  // choice wins over the default.
  const phoneWidthDock = useMediaQuery(PHONE_MEDIA_QUERY);
  const [outputExpandedChoice, setOutputExpanded] = useState<boolean | null>(
    null,
  );
  const outputExpanded = outputExpandedChoice ?? !phoneWidthDock;
  // The portal below renders on FIRST render, so the target must be resolved
  // after hydration (see use-portal-target).
  const portalTarget = usePortalTarget();
  const persistence = usePictureDeckPersistence({
    draft,
    cardSystem,
    setDraft,
    setCardSystem,
  });
  const history = usePictureDeckHistory({
    enabled: persistence.ready,
    draft,
    cardSystem,
    setDraft,
    setCardSystem,
  });
  const {
    listeningField,
    phase: dictationPhase,
    transcript: dictationTranscript,
    message: speechMessage,
    setMessage: setSpeechMessage,
    waveformRef,
    start: startDictation,
    cancel: cancelDictation,
    stop: stopDictation,
    submit: submitDictation,
  } = usePromptDictation<PictureDictationField>({
    draft,
    onApply: (field, value) => {
      history.checkpoint();
      setDraft((current) => withPictureDraftText(current, field, value));
      setCopyState("idle");
    },
  });

  const equippedFragments = useMemo(
    () => getEquippedFragments(cardSystem.equipped, cardSystem.tracks),
    [cardSystem.equipped, cardSystem.tracks],
  );
  const tail = useMemo(() => draftTail(draft), [draft]);
  const prompt = useMemo(
    () => buildPicturePrompt(draft.subject, equippedFragments, tail),
    [draft.subject, equippedFragments, tail],
  );
  const promptSections = useMemo(
    () => buildPictureSections(draft.subject, equippedFragments, tail),
    [draft.subject, equippedFragments, tail],
  );

  const missingFields = PICTURE_REQUIRED_FIELDS.filter(({ field }) => {
    if (field === "subject") {
      return (
        !isPictureFieldComplete(draft, field) &&
        !cardSystem.equipped.protagonist.some(Boolean)
      );
    }

    return !isPictureFieldComplete(draft, field);
  });
  const missingItems = missingFields.map(({ field, label }) => ({
    field,
    label,
  }));
  const isComplete = missingFields.length === 0;
  // A step is "complete" when its panel contributes to the prompt: subject
  // text (or a protagonist card) for P, an equipped card for the middle
  // panels, a card or the enabled tail for Execution.
  const flowStepComplete = PICTURE_SECTIONS.map((section) => {
    if (section === "protagonist") {
      return (
        isPictureFieldComplete(draft, "subject") ||
        cardSystem.equipped.protagonist.some(Boolean)
      );
    }
    if (section === "execution") {
      return (
        cardSystem.equipped.execution.some(Boolean) || draft.mjTailEnabled
      );
    }

    return cardSystem.equipped[section].some(Boolean);
  });
  const completedStepCount = flowStepComplete.filter(Boolean).length;
  const nav = useFlowNavigation({ panelCount: PICTURE_PANEL_COUNT });
  const nextIncompletePanel = getNextIncompletePicturePanel(
    nav.activePanel,
    flowStepComplete,
  );
  const nextIncompleteStepIndex =
    nextIncompletePanel === null
      ? -1
      : getPictureStepIndexForPanel(nextIncompletePanel);
  const nextIncompletePart =
    nextIncompleteStepIndex < 0 ? null : PICTURE_PARTS[nextIncompleteStepIndex];
  const activeStepIndex = getPictureStepIndexForPanel(nav.activePanel);
  const exportBase = slugifyFilename(draft.subject, "picture");
  const promptFileBase = exportBase.endsWith("prompt")
    ? exportBase
    : `${exportBase}-prompt`;

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);

      if (!wantsUndo && !wantsRedo) {
        return;
      }

      event.preventDefault();
      const changed = wantsUndo ? history.undo() : history.redo();
      if (changed) {
        setCopyState("idle");
        setSpeechMessage(wantsUndo ? "Last change undone." : "Change restored.");
      }
    }

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [history, setSpeechMessage]);

  function navigateToPictureStep(stepIndex: number) {
    nav.navigateToPanel(getPictureStepPanel(stepIndex));
  }

  function focusMissingField(field: string) {
    if (field !== "subject") {
      return;
    }

    setOutputExpanded(false);
    nav.navigateToPanel(PICTURE_PANEL_INDEX.protagonist, "picture-subject");
  }

  function updateDraft(field: PictureDraftTextField, value: string) {
    history.checkpoint();
    setCopyState("idle");
    setDraft((current) => withPictureDraftText(current, field, value));
  }

  function setTailEnabled(value: boolean) {
    history.checkpoint();
    setCopyState("idle");
    setDraft((current) => ({ ...current, mjTailEnabled: value }));
  }

  function selectAspectRatio(value: string) {
    history.checkpoint();
    setCopyState("idle");
    setDraft((current) => ({ ...current, aspectRatio: value }));
  }

  function setTailNumber(
    field: "stylize" | "chaos" | "weird",
    value: number | null,
  ) {
    history.checkpoint();
    setCopyState("idle");
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeTrack(
    _section: PictureSection,
    trackId: PictureTrackId,
    value: number,
  ) {
    history.checkpoint();
    setCardSystem((current) =>
      pictureCardEngine.setTrackValue(current, trackId, value),
    );
    setCopyState("idle");
  }

  function toggleWorkbenchCard(section: PictureSection, lineageId: string) {
    history.checkpoint();
    setCardSystem((current) =>
      pictureCardEngine.toggleEquippedCard(current, section, lineageId),
    );
    setCopyState("idle");
  }

  function dropWorkbenchCard(
    section: PictureSection,
    slotIndex: number,
    lineageId: string,
  ) {
    history.checkpoint();
    setCardSystem((current) =>
      pictureCardEngine.placeEquippedCard(
        current,
        section,
        slotIndex,
        lineageId,
      ),
    );
    setCopyState("idle");
  }

  function removeWorkbenchCard(section: PictureSection, slotIndex: number) {
    history.checkpoint();
    setCardSystem((current) =>
      pictureCardEngine.removeEquippedCard(current, section, slotIndex),
    );
    setCopyState("idle");
  }

  function clearWorkbenchCards(section: PictureSection) {
    history.checkpoint();
    setCardSystem((current) =>
      pictureCardEngine.clearEquippedCards(current, section),
    );
    setCopyState("idle");
  }

  function resetDeck() {
    history.checkpoint();
    cancelDictation(true);
    setDraft(EMPTY_PICTURE_DRAFT);
    setCardSystem(createPictureCardSystem());
    nav.setActivePanel(PICTURE_PANEL_INDEX.guide);
    setCopyState("idle");
    setSpeechMessage("");
  }

  function loadExample() {
    history.checkpoint();
    cancelDictation(true);
    setDraft(EXAMPLE_PICTURE_DRAFT);
    setCardSystem({
      ...createPictureCardSystem(),
      equipped: pictureCardEngine.createEquippedSlots({
        illumination: ["golden-hour"],
        canvas: ["oil-painting"],
        tone: ["muted-palette"],
        universe: ["rainswept-city"],
        execution: ["wide-establishing"],
      }),
    });
    setCopyState("idle");
    setSpeechMessage("Example loaded: a lighthouse keeper, five cards, tail on.");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function downloadPrompt(format: "md" | "txt" | "json") {
    if (format === "json") {
      const data = promptSections
        ? Object.fromEntries(
            promptSections.map((section) => [section.key, section.body]),
          )
        : {};
      downloadTextFile(
        `${promptFileBase}.json`,
        `${JSON.stringify(data, null, 2)}\n`,
        "application/json;charset=utf-8",
      );
      return;
    }

    downloadTextFile(
      `${promptFileBase}.${format}`,
      `${prompt}\n`,
      format === "txt"
        ? "text/plain;charset=utf-8"
        : "text/markdown;charset=utf-8",
    );
  }

  function printPrompt() {
    window.print();
  }

  function undoLastChange() {
    if (history.undo()) {
      setCopyState("idle");
      setSpeechMessage("Last change undone.");
    }
  }

  function redoLastChange() {
    if (history.redo()) {
      setCopyState("idle");
      setSpeechMessage("Change restored.");
    }
  }

  function continueBuilding() {
    if (nextIncompletePanel === null) {
      setOutputExpanded(true);
      return;
    }

    nav.navigateToPanel(nextIncompletePanel);
  }

  const dictationApi: DictationApi<PictureDictationField> = {
    activeField: listeningField,
    phase: dictationPhase,
    transcript: dictationTranscript,
    waveformRef,
    start: startDictation,
    cancel: () => cancelDictation(),
    stop: stopDictation,
    submit: submitDictation,
  };

  return (
    <div className="tool-page prompt-flow-page picture-deck-page">
      <PictureDeckHeader
        saveStatus={persistence.status}
        lastSavedAt={persistence.lastSavedAt}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        completedStepCount={completedStepCount}
        continueLabel={
          nextIncompletePart
            ? `Continue: ${nextIncompletePart.label}`
            : "Review output"
        }
        onUndo={undoLastChange}
        onRedo={redoLastChange}
        onContinue={continueBuilding}
        onLoadExample={loadExample}
        onReset={resetDeck}
      />

      <nav className="flow-stepper" aria-label="P.I.C.T.U.R.E. builder steps">
        <button
          className={
            nav.activePanel === PICTURE_PANEL_INDEX.guide
              ? "flow-overview-button is-active"
              : "flow-overview-button"
          }
          type="button"
          onClick={() => nav.navigateToPanel(PICTURE_PANEL_INDEX.guide)}
          aria-current={
            nav.activePanel === PICTURE_PANEL_INDEX.guide ? "step" : undefined
          }
        >
          Guide
        </button>
        <div className="flow-step-list">
          {PICTURE_PARTS.map(({ letter, label }, index) => {
            const active = activeStepIndex === index;
            const complete = flowStepComplete[index];

            return (
              <button
                className={[
                  "flow-step-button",
                  active ? "is-active" : "",
                  complete ? "is-complete" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                onClick={() => navigateToPictureStep(index)}
                aria-current={active ? "step" : undefined}
                aria-label={`${label}${complete ? ", complete" : ""}`}
                key={letter}
              >
                <span>{letter}</span>
                <strong>{label}</strong>
              </button>
            );
          })}
        </div>
      </nav>

      <div
        className={
          outputExpanded
            ? "builder-main-layout picture-deck-layout"
            : "builder-main-layout picture-deck-layout is-output-collapsed"
        }
      >
        <div className="flow-workspace">
          <form
            className="builder-form flow-form"
            aria-label="P.I.C.T.U.R.E. image prompt brief"
          >
            <PictureFlowPanels
              activePanel={nav.activePanel}
              registerPanelHeading={nav.registerPanelHeading}
              flowViewportRef={nav.flowViewportRef}
              draft={draft}
              cardSystem={cardSystem}
              stepComplete={flowStepComplete}
              attentionTargetId={nav.attentionTargetId}
              dictation={dictationApi}
              navigateToPanel={nav.navigateToPanel}
              navigateToPictureStep={navigateToPictureStep}
              onUpdateDraft={updateDraft}
              onSetTailEnabled={setTailEnabled}
              onSelectAspectRatio={selectAspectRatio}
              onSetTailNumber={setTailNumber}
              onChangeTrack={changeTrack}
              onToggleCard={toggleWorkbenchCard}
              onDropCard={dropWorkbenchCard}
              onRemoveCard={removeWorkbenchCard}
              onClearCards={clearWorkbenchCards}
              onReviewOutput={() => setOutputExpanded(true)}
            />

            {speechMessage ? (
              <p
                className="speech-status flow-speech-status"
                role="status"
                aria-live="polite"
              >
                {speechMessage}
              </p>
            ) : null}
          </form>

          {portalTarget
            ? createPortal(
                <div className="print-sheet" aria-hidden="true">
                  <h1>P.I.C.T.U.R.E. image prompt</h1>
                  <pre>{prompt}</pre>
                </div>,
                portalTarget,
              )
            : null}
        </div>

        <PromptOutputDock
          expanded={outputExpanded}
          complete={isComplete}
          missingItems={missingItems}
          prompt={prompt}
          sections={promptSections}
          copyState={copyState}
          onToggle={() => setOutputExpanded(!outputExpanded)}
          onMissingSelect={focusMissingField}
          onCopy={copyPrompt}
          onDownload={downloadPrompt}
          onPrint={printPrompt}
        />
      </div>
    </div>
  );
}
