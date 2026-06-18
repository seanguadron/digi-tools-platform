"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { PromptArchetypeToolbar } from "@/components/prompt-archetype-toolbar";
import { PromptBuilderHeader } from "@/components/prompt-builder-header";
import { PromptCardWorkbench } from "@/components/prompt-card-workbench";
import {
  CraftCard,
  DictationSession,
  FieldHeading,
  FlowActions,
} from "@/components/prompt-builder-ui";
import { PromptOutputDock } from "@/components/prompt-output-dock";
import {
  PromptProofLab,
  ProofScenarioStatus,
} from "@/components/prompt-proof-lab";
import { PromptRoleWorkbench } from "@/components/prompt-role-workbench";
import { usePromptDictation } from "@/hooks/use-prompt-dictation";
import { usePromptBuilderHistory } from "@/hooks/use-prompt-builder-history";
import { usePromptBuilderPersistence } from "@/hooks/use-prompt-builder-persistence";
import { downloadTextFile } from "@/lib/browser-download";
import {
  PROMPT_ARCHETYPES,
  type PromptArchetype,
} from "@/lib/prompt-archetypes";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import {
  getEquippedInstructions,
  getFormatCode,
  getRecommendedTrackValues,
  TRACK_IDS,
} from "@/lib/prompt-card-system";
import type {
  CardSection,
  TrackId,
} from "@/lib/prompt-card-system";
import {
  applyRecommendedTracks,
  buildPrompt,
  CRAFT_PARTS,
  clearEquippedCards,
  createCardSystem,
  createEmptySnapMemory,
  createEmptySuggestedCards,
  createEquippedSlots,
  EMPTY_DRAFT,
  EXAMPLE_DRAFT,
  isFieldComplete,
  placeEquippedCard,
  removeEquippedCard,
  REQUIRED_FIELDS,
  setTrackValue,
  toggleEquippedCard,
} from "@/lib/prompt-builder-state";
import {
  FLOW_PANEL_COUNT,
  FLOW_PANEL_INDEX,
  getCraftStepIndexForPanel,
  getCraftStepPanel,
  getLegacyProofPanel,
  getNextIncompletePanel,
} from "@/lib/prompt-navigation";
import type {
  CardSystemState,
  PromptDraft,
} from "@/lib/prompt-builder-state";
import {
  PROOF_SCENARIOS,
  type ProofScenario,
} from "@/lib/prompt-proof-scenarios";
import {
  restorePromptSession,
  serializePromptSession,
} from "@/lib/prompt-session";
import { insertIntoSlots } from "@/lib/slot-order";
import type { PromptRole } from "@/lib/prompt-types";

function CraftSubpageTabs({
  label,
  active,
  onWrite,
  onCards,
}: {
  label: string;
  active: "write" | "cards";
  onWrite: () => void;
  onCards: () => void;
}) {
  return (
    <div className="flow-subnav" aria-label={`${label} substeps`}>
      <button
        className={active === "write" ? "is-active" : ""}
        type="button"
        onClick={onWrite}
        aria-current={active === "write" ? "step" : undefined}
      >
        Write
      </button>
      <button
        className={active === "cards" ? "is-active" : ""}
        type="button"
        onClick={onCards}
        aria-current={active === "cards" ? "step" : undefined}
      >
        Cards
      </button>
    </div>
  );
}

export function PromptBuilder({ roles }: { roles: PromptRole[] }) {
  const [draft, setDraft] = useState<PromptDraft>(EMPTY_DRAFT);
  const [cardSystem, setCardSystem] =
    useState<CardSystemState>(createCardSystem);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [activeRoleCategory, setActiveRoleCategory] = useState(
    () => roles[0]?.category ?? "",
  );
  const [roleSelectionMessage, setRoleSelectionMessage] = useState("");
  const [roleWorkbenchVersion, setRoleWorkbenchVersion] = useState(0);
  const [activeArchetypeId, setActiveArchetypeId] = useState<string | null>(
    null,
  );
  const [activePanel, setActivePanel] = useState(0);
  const [attentionTargetId, setAttentionTargetId] = useState<string | null>(
    null,
  );
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [proofLabOpen, setProofLabOpen] = useState(false);
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  const panelHeadingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const flowViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusPanelRef = useRef(false);
  const pendingFocusTargetRef = useRef<string | null>(null);
  const lastContextPanelRef = useRef<number>(FLOW_PANEL_INDEX.contextCards);
  const lastTargetPanelRef = useRef<number>(FLOW_PANEL_INDEX.targetCards);
  const formatCode = getFormatCode(draft.format);
  const activeProof = PROOF_SCENARIOS.find(
    (scenario) => scenario.id === activeProofId,
  );
  const persistence = usePromptBuilderPersistence({
    roles,
    draft,
    cardSystem,
    setDraft,
    setCardSystem,
    setActiveRoleCategory,
  });
  const history = usePromptBuilderHistory({
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
  } = usePromptDictation({
    draft,
    onApply: (field, value) => {
      history.checkpoint();
      setDraft((current) => ({ ...current, [field]: value }));
      setCopyState("idle");
    },
  });
  const selectedRoles = useMemo(
    () =>
      draft.roleIds
        .map((roleId) => roles.find((role) => role.id === roleId))
        .filter((role): role is PromptRole => Boolean(role)),
    [draft.roleIds, roles],
  );
  const categories = useMemo(
    () => Array.from(new Set(roles.map((role) => role.category))),
    [roles],
  );
  const equippedInstructions = useMemo(
    () =>
      getEquippedInstructions(cardSystem.equipped, cardSystem.tracks),
    [cardSystem.equipped, cardSystem.tracks],
  );
  const prompt = useMemo(
    () => buildPrompt(draft, selectedRoles, equippedInstructions),
    [draft, equippedInstructions, selectedRoles],
  );
  const missingFields = REQUIRED_FIELDS.filter(({ field }) => {
    if (field === "action") {
      return (
        !isFieldComplete(draft, field) &&
        !cardSystem.equipped.action.some(Boolean)
      );
    }

    return !isFieldComplete(draft, field);
  });
  const missingItems = missingFields.map(({ field, label }) => ({
    field,
    label,
  }));
  const isComplete = missingFields.length === 0;
  const flowStepComplete = [
    isFieldComplete(draft, "context"),
    selectedRoles.length > 0,
    isFieldComplete(draft, "action") ||
      cardSystem.equipped.action.some(Boolean),
    isFieldComplete(draft, "format"),
    isFieldComplete(draft, "targetAudience"),
  ];
  const completedStepCount = flowStepComplete.filter(Boolean).length;
  const nextIncompletePanel = getNextIncompletePanel(
    activePanel,
    flowStepComplete,
  );
  const nextIncompleteStepIndex =
    nextIncompletePanel === null
      ? -1
      : getCraftStepIndexForPanel(nextIncompletePanel);
  const nextIncompletePart =
    nextIncompleteStepIndex < 0
      ? null
      : CRAFT_PARTS[nextIncompleteStepIndex];
  const activeCraftStepIndex = getCraftStepIndexForPanel(activePanel);

  useEffect(() => {
    if (
      activePanel === FLOW_PANEL_INDEX.contextWrite ||
      activePanel === FLOW_PANEL_INDEX.contextCards
    ) {
      lastContextPanelRef.current = activePanel;
    }

    if (
      activePanel === FLOW_PANEL_INDEX.targetWrite ||
      activePanel === FLOW_PANEL_INDEX.targetCards
    ) {
      lastTargetPanelRef.current = activePanel;
    }
  }, [activePanel]);

  useEffect(() => {
    const focusTargetId = pendingFocusTargetRef.current;

    if (!shouldFocusPanelRef.current && !focusTargetId) {
      return;
    }

    shouldFocusPanelRef.current = false;
    pendingFocusTargetRef.current = null;

    window.requestAnimationFrame(() => {
      if (flowViewportRef.current) {
        flowViewportRef.current.scrollLeft = 0;
      }

      if (!focusTargetId) {
        panelHeadingRefs.current[activePanel]?.focus({ preventScroll: true });
        return;
      }

      focusControl(focusTargetId);
    });
  }, [activePanel]);

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

  function focusControl(controlId: string) {
    window.setTimeout(() => {
      const target = document.getElementById(controlId);

      target?.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
      target?.focus({ preventScroll: true });
      setAttentionTargetId(controlId);
      window.setTimeout(() => {
        setAttentionTargetId((current) =>
          current === controlId ? null : current,
        );
      }, 1200);
    }, 280);
  }

  function navigateToPanel(panelIndex: number, focusTargetId?: string) {
    const boundedPanel = Math.max(0, Math.min(panelIndex, FLOW_PANEL_COUNT - 1));
    pendingFocusTargetRef.current = focusTargetId ?? null;
    shouldFocusPanelRef.current = !focusTargetId;
    setActivePanel(boundedPanel);

    if (focusTargetId && boundedPanel === activePanel) {
      pendingFocusTargetRef.current = null;
      focusControl(focusTargetId);
    }
  }

  function navigateToCraftStep(stepIndex: number) {
    const preferredPanel =
      stepIndex === 0
        ? lastContextPanelRef.current
        : stepIndex === 4
          ? lastTargetPanelRef.current
          : undefined;

    navigateToPanel(
      getCraftStepPanel(stepIndex, flowStepComplete, preferredPanel),
    );
  }

  function focusMissingField(field: string) {
    const missingTargets: Record<string, { panel: number; controlId: string }> =
      {
        context: {
          panel: FLOW_PANEL_INDEX.contextWrite,
          controlId: "prompt-context",
        },
        roleIds: {
          panel: FLOW_PANEL_INDEX.role,
          controlId: "role-loadout-target",
        },
        action: {
          panel: FLOW_PANEL_INDEX.action,
          controlId: "prompt-action",
        },
        format: {
          panel: FLOW_PANEL_INDEX.format,
          controlId: "prompt-format-options",
        },
        targetAudience: {
          panel: FLOW_PANEL_INDEX.targetWrite,
          controlId: "prompt-target-audience",
        },
      };
    const target = missingTargets[field];

    if (!target) {
      return;
    }

    setOutputExpanded(false);
    navigateToPanel(target.panel, target.controlId);
  }

  function updateDraft(
    field: Exclude<keyof PromptDraft, "roleIds">,
    value: string,
  ) {
    history.checkpoint();
    if (field !== "context" && field !== "targetAudience") {
      setActiveArchetypeId(null);
    }
    setCopyState("idle");
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function selectOutputType(value: string) {
    const nextFormatCode = getFormatCode(value);
    const recommended = getRecommendedTrackValues(nextFormatCode);

    history.checkpoint();
    setActiveArchetypeId(null);
    setDraft((current) => ({ ...current, format: value }));
    setCardSystem((current) =>
      applyRecommendedTracks(current, recommended, true),
    );
    setCopyState("idle");
  }

  function applyArchetype(archetype: PromptArchetype) {
    const formatOption = FORMAT_OPTIONS.find(
      (option) => option.code === archetype.formatCode,
    );
    const validRoleIds = archetype.roleIds.filter((roleId) =>
      roles.some((role) => role.id === roleId),
    );
    const leadRole = roles.find((role) => role.id === validRoleIds[0]);

    if (!formatOption) {
      setSpeechMessage(`${archetype.name} uses an unavailable output type.`);
      return;
    }

    history.checkpoint();
    cancelDictation(true);
    setDraft((current) => ({
      ...current,
      roleIds: validRoleIds,
      action: archetype.action ?? "",
      format: formatOption.value,
      formatNotes: archetype.formatNotes ?? "",
      context: current.context,
      targetAudience: current.targetAudience,
    }));
    setCardSystem({
      tracks: { ...archetype.tracks },
      equipped: createEquippedSlots(archetype.equipped),
      memory: createEmptySnapMemory(),
      overrides: [],
      suggested: createEmptySuggestedCards(),
    });
    setActiveRoleCategory(leadRole?.category ?? categories[0] ?? "");
    setRoleWorkbenchVersion((current) => current + 1);
    setActiveArchetypeId(archetype.id);
    setActiveProofId(null);
    setProofLabOpen(false);
    setOutputExpanded(false);
    setCopyState("idle");
    setSpeechMessage(
      `${archetype.name} archetype applied. Your current section stayed in place.`,
    );
  }

  function applyRecommendedSetup() {
    const recommended = getRecommendedTrackValues(formatCode);
    history.checkpoint();
    setActiveArchetypeId(null);
    setCardSystem((current) =>
      applyRecommendedTracks(current, recommended, false),
    );
    setSpeechMessage(`${formatCode} recommended setup applied.`);
    setCopyState("idle");
  }

  function changeTrack(trackId: TrackId, value: number) {
    history.checkpoint();
    setActiveArchetypeId(null);
    setCardSystem((current) => setTrackValue(current, trackId, value));
    setCopyState("idle");
  }

  function toggleWorkbenchCard(section: CardSection, lineageId: string) {
    history.checkpoint();
    setActiveArchetypeId(null);
    setCardSystem((current) =>
      toggleEquippedCard(current, section, lineageId),
    );
    setCopyState("idle");
  }

  function dropWorkbenchCard(
    section: CardSection,
    slotIndex: number,
    lineageId: string,
  ) {
    history.checkpoint();
    setActiveArchetypeId(null);
    setCardSystem((current) =>
      placeEquippedCard(current, section, slotIndex, lineageId),
    );
    setCopyState("idle");
  }

  function removeWorkbenchCard(section: CardSection, slotIndex: number) {
    history.checkpoint();
    setActiveArchetypeId(null);
    setCardSystem((current) =>
      removeEquippedCard(current, section, slotIndex),
    );
    setCopyState("idle");
  }

  function clearWorkbenchCards(section: CardSection) {
    history.checkpoint();
    setActiveArchetypeId(null);
    setCardSystem((current) => clearEquippedCards(current, section));
    setCopyState("idle");
  }

  function resetDraft() {
    history.checkpoint();
    cancelDictation(true);
    setDraft(EMPTY_DRAFT);
    setCardSystem(createCardSystem());
    setActiveRoleCategory(categories[0] ?? "");
    setRoleWorkbenchVersion((current) => current + 1);
    setRoleSelectionMessage("");
    setActiveArchetypeId(null);
    setActiveProofId(null);
    setActivePanel(FLOW_PANEL_INDEX.guide);
    setCopyState("idle");
    setSpeechMessage("");
  }

  function loadExample() {
    history.checkpoint();
    cancelDictation(true);
    setDraft(EXAMPLE_DRAFT);
    setCardSystem({
      ...createCardSystem(EXAMPLE_DRAFT.format),
      equipped: createEquippedSlots({
        context: ["context-scope", "context-constraints"],
        action: ["action-inspect", "action-analyze", "action-recommend"],
        format: ["format-sections", "format-next"],
        target: ["target-language", "target-direct"],
      }),
    });
    const exampleRole = roles.find(
      (role) => role.id === EXAMPLE_DRAFT.roleIds[0],
    );
    if (exampleRole) {
      setActiveRoleCategory(exampleRole.category);
    }
    setRoleWorkbenchVersion((current) => current + 1);
    setRoleSelectionMessage(
      "Example loaded with UX / UI Advisor as the lead role.",
    );
    setActiveArchetypeId(null);
    setCopyState("idle");
    setSpeechMessage("");
    setActiveProofId(null);
  }

  function loadProofScenario(scenario: ProofScenario) {
    history.checkpoint();
    cancelDictation(true);
    const formatOption =
      FORMAT_OPTIONS.find((option) => option.code === scenario.formatCode) ??
      FORMAT_OPTIONS[0];
    const recommendedTracks = getRecommendedTrackValues(formatOption.code);
    const nextTracks = { ...recommendedTracks, ...scenario.tracks };
    const validRoleIds = scenario.roles.filter((roleId) =>
      roles.some((role) => role.id === roleId),
    );

    setDraft({
      ...EMPTY_DRAFT,
      ...scenario.draft,
      format: formatOption.value,
      roleIds: validRoleIds,
    });
    setCardSystem({
      tracks: nextTracks,
      equipped: createEquippedSlots(scenario.equipped),
      memory: createEmptySnapMemory(),
      overrides: TRACK_IDS.filter(
        (trackId) => scenario.tracks?.[trackId] !== undefined,
      ),
      suggested: {
        ...createEmptySuggestedCards(),
        ...scenario.suggested,
      },
    });
    const leadRole = roles.find((role) => role.id === validRoleIds[0]);
    if (leadRole) {
      setActiveRoleCategory(leadRole.category);
    } else {
      setActiveRoleCategory(categories[0] ?? "");
    }
    setRoleWorkbenchVersion((current) => current + 1);
    setRoleSelectionMessage(
      validRoleIds.length > 0
        ? `${scenario.name} loaded with ${validRoleIds.length} role ${
            validRoleIds.length === 1 ? "card" : "cards"
          }.`
        : `${scenario.name} loaded with an empty role loadout.`,
    );
    setActiveArchetypeId(null);
    setActiveProofId(scenario.id);
    setProofLabOpen(false);
    setOutputExpanded(scenario.outputExpanded ?? true);
    setCopyState("idle");
    setSpeechMessage(
      `${scenario.name} proof loaded. Follow the verification checklist.`,
    );
    navigateToPanel(getLegacyProofPanel(scenario.panel));
  }

  function toggleRole(role: PromptRole) {
    const selectedIndex = draft.roleIds.indexOf(role.id);

    if (selectedIndex >= 0) {
      history.checkpoint();
      setActiveArchetypeId(null);
      setDraft((current) => ({
        ...current,
        roleIds: current.roleIds.filter((roleId) => roleId !== role.id),
      }));
      setRoleSelectionMessage(
        `${role.name} removed.`,
      );
      setCopyState("idle");
      return;
    }

    if (draft.roleIds.length >= 3) {
      setRoleSelectionMessage(
        "Loadout full. Remove a role first.",
      );
      return;
    }

    history.checkpoint();
    setActiveArchetypeId(null);
    setDraft((current) => ({
      ...current,
      roleIds: [...current.roleIds, role.id],
    }));
    setRoleSelectionMessage(
      draft.roleIds.length === 0
        ? `${role.name} set as lead.`
        : `${role.name} added to support ${draft.roleIds.length}.`,
    );
    setCopyState("idle");
    setActiveRoleCategory(role.category);
  }

  function dropRoleIntoSlot(slotIndex: number, roleId: string) {
    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) {
      return;
    }

    history.checkpoint();
    setActiveArchetypeId(null);
    setDraft((current) => {
      const nextRoleIds = insertIntoSlots(
        current.roleIds,
        slotIndex,
        roleId,
        3,
      ).filter(Boolean);
      return { ...current, roleIds: nextRoleIds };
    });
    setActiveRoleCategory(role.category);
    setRoleSelectionMessage(
      `${role.name} moved to ${
        slotIndex === 0 ? "lead" : `support ${slotIndex}`
      }.`,
    );
    setCopyState("idle");
  }

  function clearRoleLoadout() {
    history.checkpoint();
    setActiveArchetypeId(null);
    setDraft((current) => ({ ...current, roleIds: [] }));
    setRoleSelectionMessage("Role loadout cleared.");
    setCopyState("idle");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function downloadPrompt() {
    downloadTextFile(
      "craft-prompt.md",
      `${prompt}\n`,
      "text/markdown;charset=utf-8",
    );
  }

  function downloadSession() {
    downloadTextFile(
      "craft-session.json",
      serializePromptSession(draft, cardSystem),
      "application/json;charset=utf-8",
    );
    setSpeechMessage("Session exported as JSON.");
  }

  async function importSession(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const {
        draft: nextDraft,
        cardSystem: nextCardSystem,
      } = restorePromptSession(await file.text(), roles);
      const leadRole = roles.find(
        (role) => role.id === nextDraft.roleIds[0],
      );

      history.checkpoint();
      cancelDictation(true);
      setDraft(nextDraft);
      setCardSystem(nextCardSystem);
      setActiveRoleCategory(leadRole?.category ?? categories[0] ?? "");
      setRoleWorkbenchVersion((current) => current + 1);
      setActiveArchetypeId(null);
      setActiveProofId(null);
      setCopyState("idle");
      setSpeechMessage("Session imported.");
    } catch {
      setSpeechMessage("That file is not a valid C.R.A.F.T. session.");
    } finally {
      event.target.value = "";
    }
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

    navigateToPanel(nextIncompletePanel);
  }

  return (
    <div
      className={
        outputExpanded
          ? "tool-page prompt-flow-page is-output-expanded"
          : "tool-page prompt-flow-page"
      }
    >
      <PromptBuilderHeader
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
        proofLabOpen={proofLabOpen}
        onUndo={undoLastChange}
        onRedo={redoLastChange}
        onContinue={continueBuilding}
        onExportSession={downloadSession}
        onImportSession={importSession}
        onLoadExample={loadExample}
        onOpenProofLab={() => {
          setProofLabOpen(true);
          setOutputExpanded(false);
        }}
        onReset={resetDraft}
      />

      <PromptProofLab
        open={proofLabOpen}
        activeProofId={activeProofId}
        onClose={() => setProofLabOpen(false)}
        onLoad={loadProofScenario}
      />

      <nav className="flow-stepper" aria-label="C.R.A.F.T. builder steps">
        <button
          className={
            activePanel === FLOW_PANEL_INDEX.guide
              ? "flow-overview-button is-active"
              : "flow-overview-button"
          }
          type="button"
          onClick={() => navigateToPanel(FLOW_PANEL_INDEX.guide)}
          aria-current={
            activePanel === FLOW_PANEL_INDEX.guide ? "step" : undefined
          }
        >
          Guide
        </button>
        <div className="flow-step-list">
          {CRAFT_PARTS.map(({ letter, label }, index) => {
            const active = activeCraftStepIndex === index;
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
                onClick={() => navigateToCraftStep(index)}
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

      <div className="builder-main-layout">
        <PromptArchetypeToolbar
          archetypes={PROMPT_ARCHETYPES}
          roles={roles}
          activeId={activeArchetypeId}
          onApply={applyArchetype}
        />

        <div className="flow-workspace">
        <ProofScenarioStatus
          scenario={activeProof}
          onDismiss={() => setActiveProofId(null)}
        />
        <form
          className="builder-form flow-form"
          aria-label="C.R.A.F.T. prompt brief"
        >
          <div className="flow-viewport" ref={flowViewportRef}>
            <div
              className="flow-track"
              style={{
                transform: `translate3d(-${activePanel * 100}%, 0, 0)`,
              }}
            >
              <section
                className="flow-panel flow-intro-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.guide}
                inert={activePanel !== FLOW_PANEL_INDEX.guide}
              >
                <div className="craft-method" aria-labelledby="craft-method-title">
                  <div className="craft-method-copy">
                    <h2
                      id="craft-method-title"
                      tabIndex={-1}
                      ref={(node) => {
                        panelHeadingRefs.current[FLOW_PANEL_INDEX.guide] = node;
                      }}
                    >
                      Build with C.R.A.F.T.
                    </h2>
                    <p>
                      Set the context, role, actions, format, and audience. Your
                      prompt updates as you go.
                    </p>
                  </div>
                  <section
                    className="output-type-setup"
                    aria-labelledby="output-type-setup-title"
                  >
                    <div className="workbench-section-heading">
                      <div>
                        <strong id="output-type-setup-title">Output type</strong>
                      </div>
                       <small>{formatCode}</small>
                    </div>
                    <div className="output-type-card-row" role="radiogroup">
                      {FORMAT_OPTIONS.map((option) => {
                        const selected = draft.format === option.value;
                        return (
                          <button
                            className={
                              selected
                                ? "output-type-card is-selected"
                                : "output-type-card"
                            }
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => selectOutputType(option.value)}
                            key={option.code}
                          >
                            <span>{option.code}</span>
                            <strong>{option.name}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <div className="craft-definition" role="list">
                    {CRAFT_PARTS.map(
                      ({ letter, label, summary }, index) => (
                        <button
                          className="craft-definition-card"
                          type="button"
                          role="listitem"
                          onClick={() => navigateToCraftStep(index)}
                          key={letter}
                        >
                          <span className="craft-definition-letter">
                            {letter}
                          </span>
                          <strong>{label}</strong>
                          <small>{summary}</small>
                        </button>
                      ),
                    )}
                  </div>
                  <FlowActions
                    onNext={() => navigateToPanel(FLOW_PANEL_INDEX.contextWrite)}
                    nextLabel="Start"
                  />
                </div>
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.contextWrite}
                inert={activePanel !== FLOW_PANEL_INDEX.contextWrite}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">C</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[
                        FLOW_PANEL_INDEX.contextWrite
                      ] = node;
                    }}
                  >
                    Context
                  </h2>
                </div>
                <CraftSubpageTabs
                  label="Context"
                  active="write"
                  onWrite={() => navigateToPanel(FLOW_PANEL_INDEX.contextWrite)}
                  onCards={() => navigateToPanel(FLOW_PANEL_INDEX.contextCards)}
                />

                <div className="flow-panel-card">
                  <CraftCard
                    letter="C"
                    complete={isFieldComplete(draft, "context")}
                  >
                    <div className="field craft-field">
                      <FieldHeading
                        field="context"
                        label="What are you working on?"
                        controlId="prompt-context"
                        hint="Give the model the topic, goal, source material, constraints, exclusions, and uncertainty."
                      />
                      <div className="brief-next-card">
                        <strong>Cards come next</strong>
                        <p>
                          After this, context cards tune scope, constraints,
                          evidence, and assumptions.
                        </p>
                      </div>
                      <span className="dictation-control">
                        <textarea
                          id="prompt-context"
                          className={
                            attentionTargetId === "prompt-context"
                              ? "is-attention-target"
                              : undefined
                          }
                          value={draft.context}
                          onChange={(event) =>
                            updateDraft("context", event.target.value)
                          }
                          placeholder="Describe the raw situation: goal, facts, source material, constraints, exclusions, uncertainty."
                          rows={8}
                          required
                        />
                        <button
                          className={
                            listeningField === "context" &&
                            dictationPhase === "recording"
                              ? "mic-button is-listening"
                              : "mic-button"
                          }
                          type="button"
                          onClick={() => startDictation("context", "Context")}
                          aria-pressed={
                            listeningField === "context" &&
                            dictationPhase === "recording"
                          }
                          aria-label={
                            listeningField === "context" &&
                            dictationPhase === "recording"
                              ? "Stop dictating context"
                              : "Dictate context"
                          }
                        >
                          {listeningField === "context" &&
                          dictationPhase === "recording"
                            ? "Stop"
                            : "Mic"}
                        </button>
                      </span>
                      <DictationSession
                        activeField={listeningField}
                        field="context"
                        label="Context"
                        phase={dictationPhase}
                        transcript={dictationTranscript}
                        waveformRef={waveformRef}
                        onCancel={() => cancelDictation()}
                        onStop={stopDictation}
                        onSubmit={submitDictation}
                      />
                    </div>
                  </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.guide)}
                  onNext={() => navigateToPanel(FLOW_PANEL_INDEX.contextCards)}
                  nextLabel="Next: context cards"
                />
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.contextCards}
                inert={activePanel !== FLOW_PANEL_INDEX.contextCards}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">C</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[
                        FLOW_PANEL_INDEX.contextCards
                      ] = node;
                    }}
                  >
                    Context cards
                  </h2>
                </div>
                <CraftSubpageTabs
                  label="Context"
                  active="cards"
                  onWrite={() => navigateToPanel(FLOW_PANEL_INDEX.contextWrite)}
                  onCards={() => navigateToPanel(FLOW_PANEL_INDEX.contextCards)}
                />

                <div className="flow-panel-card">
                  <CraftCard
                    letter="C"
                    complete={isFieldComplete(draft, "context")}
                  >
                    <div className="field craft-field">
                      <FieldHeading
                        field="context"
                        label="Context modifiers"
                        controlId="context-card-workbench"
                        labelControl={false}
                      />
                      <div id="context-card-workbench">
                        <PromptCardWorkbench
                          section="context"
                          formatCode={formatCode}
                          values={cardSystem.tracks}
                          equippedIds={cardSystem.equipped.context}
                          suggestedId={cardSystem.suggested.context}
                          onTrackChange={changeTrack}
                          onToggleCard={(lineageId) =>
                            toggleWorkbenchCard("context", lineageId)
                          }
                          onDropCard={(slotIndex, lineageId) =>
                            dropWorkbenchCard("context", slotIndex, lineageId)
                          }
                          onRemoveCard={(slotIndex) =>
                            removeWorkbenchCard("context", slotIndex)
                          }
                          onClearCards={() => clearWorkbenchCards("context")}
                        />
                      </div>
                    </div>
                  </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.contextWrite)}
                  onNext={() => navigateToPanel(FLOW_PANEL_INDEX.role)}
                />
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.role}
                inert={activePanel !== FLOW_PANEL_INDEX.role}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">R</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[FLOW_PANEL_INDEX.role] = node;
                    }}
                  >
                    Roles
                  </h2>
                </div>

                <div className="flow-panel-card">
          <CraftCard letter="R" complete={selectedRoles.length > 0}>
            <div className="field craft-field role-loadout">
              <FieldHeading
                 field="role"
                 label="Role"
                 controlId="role-loadout-target"
                labelControl={false}
              />

              <div
                id="role-loadout-target"
                tabIndex={-1}
                data-attention={
                  attentionTargetId === "role-loadout-target"
                    ? "true"
                    : undefined
                }
              >
                <PromptRoleWorkbench
                  key={roleWorkbenchVersion}
                  roles={roles}
                  selectedRoleIds={draft.roleIds}
                  activeCategory={activeRoleCategory}
                  selectionMessage={roleSelectionMessage}
                  onCategoryChange={setActiveRoleCategory}
                  onToggleRole={toggleRole}
                  onDropRole={dropRoleIntoSlot}
                  onClearRoles={clearRoleLoadout}
                />
              </div>
            </div>
          </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.contextCards)}
                  onNext={() => navigateToPanel(FLOW_PANEL_INDEX.action)}
                />
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.action}
                inert={activePanel !== FLOW_PANEL_INDEX.action}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">A</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[FLOW_PANEL_INDEX.action] = node;
                    }}
                  >
                    Actions
                  </h2>
                </div>

                <div className="flow-panel-card">
          <CraftCard
            letter="A"
            complete={
              isFieldComplete(draft, "action") ||
              cardSystem.equipped.action.some(Boolean)
            }
          >
            <div className="field craft-field">
              <FieldHeading
                 field="action"
                 label="Action"
                 controlId="prompt-action"
              />
              <PromptCardWorkbench
                section="action"
                formatCode={formatCode}
                values={cardSystem.tracks}
                equippedIds={cardSystem.equipped.action}
                suggestedId={cardSystem.suggested.action}
                onTrackChange={changeTrack}
                onToggleCard={(lineageId) =>
                  toggleWorkbenchCard("action", lineageId)
                }
                onDropCard={(slotIndex, lineageId) =>
                  dropWorkbenchCard("action", slotIndex, lineageId)
                }
                onRemoveCard={(slotIndex) =>
                  removeWorkbenchCard("action", slotIndex)
                }
                onClearCards={() => clearWorkbenchCards("action")}
              />
              <label className="workbench-text-label" htmlFor="prompt-action">
                Optional custom steps
              </label>
              <span className="dictation-control">
                <textarea
                  id="prompt-action"
                  className={
                    attentionTargetId === "prompt-action"
                      ? "is-attention-target"
                      : undefined
                  }
                  value={draft.action}
                  onChange={(event) => updateDraft("action", event.target.value)}
                  placeholder={
                    "Add any steps the cards do not cover."
                  }
                  rows={7}
                  required
                />
                <button
                  className={
                    listeningField === "action" &&
                    dictationPhase === "recording"
                      ? "mic-button is-listening"
                      : "mic-button"
                  }
                  type="button"
                  onClick={() => startDictation("action", "Action")}
                  aria-pressed={
                    listeningField === "action" &&
                    dictationPhase === "recording"
                  }
                  aria-label={
                    listeningField === "action" &&
                    dictationPhase === "recording"
                      ? "Stop dictating action"
                      : "Dictate action"
                  }
                >
                  {listeningField === "action" &&
                  dictationPhase === "recording"
                    ? "Stop"
                    : "Mic"}
                </button>
              </span>
              <DictationSession
                activeField={listeningField}
                field="action"
                label="Action"
                phase={dictationPhase}
                transcript={dictationTranscript}
                waveformRef={waveformRef}
                onCancel={() => cancelDictation()}
                onStop={stopDictation}
                onSubmit={submitDictation}
              />
            </div>
          </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.role)}
                  onNext={() => navigateToPanel(FLOW_PANEL_INDEX.format)}
                />
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.format}
                inert={activePanel !== FLOW_PANEL_INDEX.format}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">F</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[FLOW_PANEL_INDEX.format] = node;
                    }}
                  >
                    Format
                  </h2>
                </div>

                <div className="flow-panel-card">
          <CraftCard letter="F" complete={isFieldComplete(draft, "format")}>
            <div className="field craft-field">
              <FieldHeading
                 field="format"
                 label="Format"
                 controlId="prompt-format-options"
                labelControl={false}
              />
              <PromptCardWorkbench
                section="format"
                formatCode={formatCode}
                values={cardSystem.tracks}
                equippedIds={cardSystem.equipped.format}
                suggestedId={cardSystem.suggested.format}
                onTrackChange={changeTrack}
                onToggleCard={(lineageId) =>
                  toggleWorkbenchCard("format", lineageId)
                }
                onDropCard={(slotIndex, lineageId) =>
                  dropWorkbenchCard("format", slotIndex, lineageId)
                }
                onRemoveCard={(slotIndex) =>
                  removeWorkbenchCard("format", slotIndex)
                }
                onClearCards={() => clearWorkbenchCards("format")}
              />

              <section
                className="format-filter-section"
                aria-labelledby="output-type-filter-label"
              >
                <div className="workbench-section-heading">
                  <strong id="output-type-filter-label">Output type</strong>
                  <small>{formatCode}</small>
                </div>
                <div
                  className="format-filter-tabs"
                  id="prompt-format-options"
                  role="radiogroup"
                  data-attention={
                    attentionTargetId === "prompt-format-options"
                      ? "true"
                      : undefined
                  }
                >
                  {FORMAT_OPTIONS.map((option) => {
                    const selected = draft.format === option.value;

                    return (
                      <button
                        className={
                          selected
                            ? "format-filter-tab is-active"
                            : "format-filter-tab"
                        }
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => selectOutputType(option.value)}
                        key={option.value}
                      >
                        <span>{option.code}</span>
                        <strong>{option.name}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>

              {cardSystem.overrides.length > 0 ? (
                <div className="recommended-setup-notice">
                  <span>
                    {cardSystem.overrides.length} track{" "}
                    {cardSystem.overrides.length === 1 ? "override" : "overrides"}
                  </span>
                  <button type="button" onClick={applyRecommendedSetup}>
                    Use recommended
                  </button>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="prompt-format-notes">
                  Optional format notes
                </label>
                <span className="dictation-control">
                  <textarea
                    id="prompt-format-notes"
                    value={draft.formatNotes}
                    onChange={(event) =>
                      updateDraft("formatNotes", event.target.value)
                    }
                    placeholder="Length, sections, citations, or other requirements."
                    rows={4}
                  />
                  <button
                    className={
                      listeningField === "formatNotes" &&
                      dictationPhase === "recording"
                        ? "mic-button is-listening"
                        : "mic-button"
                    }
                    type="button"
                    onClick={() =>
                      startDictation("formatNotes", "Format requirements")
                    }
                    aria-pressed={
                      listeningField === "formatNotes" &&
                      dictationPhase === "recording"
                    }
                    aria-label={
                      listeningField === "formatNotes" &&
                      dictationPhase === "recording"
                        ? "Stop dictating format requirements"
                        : "Dictate format requirements"
                    }
                  >
                    {listeningField === "formatNotes" &&
                    dictationPhase === "recording"
                      ? "Stop"
                      : "Mic"}
                  </button>
                </span>
                <DictationSession
                  activeField={listeningField}
                  field="formatNotes"
                  label="Format requirements"
                  phase={dictationPhase}
                  transcript={dictationTranscript}
                  waveformRef={waveformRef}
                  onCancel={() => cancelDictation()}
                  onStop={stopDictation}
                  onSubmit={submitDictation}
                />
              </div>
            </div>
          </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.action)}
                  onNext={() => navigateToPanel(FLOW_PANEL_INDEX.targetWrite)}
                />
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.targetWrite}
                inert={activePanel !== FLOW_PANEL_INDEX.targetWrite}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">T</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[
                        FLOW_PANEL_INDEX.targetWrite
                      ] = node;
                    }}
                  >
                    Target audience
                  </h2>
                </div>
                <CraftSubpageTabs
                  label="Target audience"
                  active="write"
                  onWrite={() => navigateToPanel(FLOW_PANEL_INDEX.targetWrite)}
                  onCards={() => navigateToPanel(FLOW_PANEL_INDEX.targetCards)}
                />

                <div className="flow-panel-card">
                  <CraftCard
                    letter="T"
                    complete={isFieldComplete(draft, "targetAudience")}
                  >
                    <div className="field craft-field">
                      <FieldHeading
                        field="targetAudience"
                        label="Who exactly are you targeting?"
                        controlId="prompt-target-audience"
                        hint="Name the audience, knowledge level, decision context, tone sensitivity, and desired outcome."
                      />
                      <div className="brief-next-card">
                        <strong>Cards come next</strong>
                        <p>
                          After this, audience cards tune expertise, tone,
                          language, and delivery rules.
                        </p>
                      </div>
                      <span className="dictation-control">
                        <textarea
                          id="prompt-target-audience"
                          className={
                            attentionTargetId === "prompt-target-audience"
                              ? "is-attention-target"
                              : undefined
                          }
                          value={draft.targetAudience}
                          onChange={(event) =>
                            updateDraft("targetAudience", event.target.value)
                          }
                          placeholder="Describe the real reader: role, knowledge level, goal, constraints, and what they need to do next."
                          rows={7}
                          required
                        />
                        <button
                          className={
                            listeningField === "targetAudience" &&
                            dictationPhase === "recording"
                              ? "mic-button is-listening"
                              : "mic-button"
                          }
                          type="button"
                          onClick={() =>
                            startDictation("targetAudience", "Target audience")
                          }
                          aria-pressed={
                            listeningField === "targetAudience" &&
                            dictationPhase === "recording"
                          }
                          aria-label={
                            listeningField === "targetAudience" &&
                            dictationPhase === "recording"
                              ? "Stop dictating target audience"
                              : "Dictate target audience"
                          }
                        >
                          {listeningField === "targetAudience" &&
                          dictationPhase === "recording"
                            ? "Stop"
                            : "Mic"}
                        </button>
                      </span>
                      <DictationSession
                        activeField={listeningField}
                        field="targetAudience"
                        label="Target audience"
                        phase={dictationPhase}
                        transcript={dictationTranscript}
                        waveformRef={waveformRef}
                        onCancel={() => cancelDictation()}
                        onStop={stopDictation}
                        onSubmit={submitDictation}
                      />
                    </div>
                  </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.format)}
                  onNext={() => navigateToPanel(FLOW_PANEL_INDEX.targetCards)}
                  nextLabel="Next: audience cards"
                />
              </section>

              <section
                className="flow-panel"
                aria-hidden={activePanel !== FLOW_PANEL_INDEX.targetCards}
                inert={activePanel !== FLOW_PANEL_INDEX.targetCards}
              >
                <div className="flow-panel-heading">
                  <span aria-hidden="true">T</span>
                  <h2
                    tabIndex={-1}
                    ref={(node) => {
                      panelHeadingRefs.current[
                        FLOW_PANEL_INDEX.targetCards
                      ] = node;
                    }}
                  >
                    Audience cards
                  </h2>
                </div>
                <CraftSubpageTabs
                  label="Target audience"
                  active="cards"
                  onWrite={() => navigateToPanel(FLOW_PANEL_INDEX.targetWrite)}
                  onCards={() => navigateToPanel(FLOW_PANEL_INDEX.targetCards)}
                />

                <div className="flow-panel-card">
                  <CraftCard
                    letter="T"
                    complete={isFieldComplete(draft, "targetAudience")}
                  >
                    <div className="field craft-field">
                      <FieldHeading
                        field="targetAudience"
                        label="Audience modifiers"
                        controlId="target-card-workbench"
                        labelControl={false}
                      />
                      <div id="target-card-workbench">
                        <PromptCardWorkbench
                          section="target"
                          formatCode={formatCode}
                          values={cardSystem.tracks}
                          equippedIds={cardSystem.equipped.target}
                          suggestedId={cardSystem.suggested.target}
                          onTrackChange={changeTrack}
                          onToggleCard={(lineageId) =>
                            toggleWorkbenchCard("target", lineageId)
                          }
                          onDropCard={(slotIndex, lineageId) =>
                            dropWorkbenchCard("target", slotIndex, lineageId)
                          }
                          onRemoveCard={(slotIndex) =>
                            removeWorkbenchCard("target", slotIndex)
                          }
                          onClearCards={() => clearWorkbenchCards("target")}
                        />
                      </div>
                    </div>
                  </CraftCard>
                </div>
                <FlowActions
                  onBack={() => navigateToPanel(FLOW_PANEL_INDEX.targetWrite)}
                  onNext={() => setOutputExpanded(true)}
                  nextLabel="Review output"
                  onSecondary={resetDraft}
                  secondaryLabel="Clear all"
                />
              </section>
            </div>
          </div>

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

        <PromptOutputDock
          expanded={outputExpanded}
          complete={isComplete}
          missingItems={missingItems}
          prompt={prompt}
          copyState={copyState}
          onToggle={() => setOutputExpanded((current) => !current)}
          onMissingSelect={focusMissingField}
          onCopy={copyPrompt}
          onDownload={downloadPrompt}
        />
        </div>
      </div>
    </div>
  );
}
