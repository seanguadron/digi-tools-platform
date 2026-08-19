"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ChangeEvent } from "react";
import { FlowNavDock } from "@/components/flow-nav-dock";
import { FlowStepStrip } from "@/components/flow-step-strip";
import { PromptArchetypeToolbar } from "@/components/prompt-archetype-toolbar";
import { PromptBuilderHeader } from "@/components/prompt-builder-header";
import { CraftFlowPanels } from "@/components/prompt-flow-panels";
import type { CraftDictationApi } from "@/components/prompt-builder-ui";
import { PromptLibraryPanel } from "@/components/prompt-library-panel";
import { PromptOutputDock } from "@/components/prompt-output-dock";
import {
  PromptProofLab,
  ProofScenarioStatus,
} from "@/components/prompt-proof-lab";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { usePromptDictation } from "@/hooks/use-prompt-dictation";
import { useCraftFlowNavigation } from "@/hooks/use-craft-flow-navigation";
import { usePromptBuilderHistory } from "@/hooks/use-prompt-builder-history";
import { usePromptBuilderPersistence } from "@/hooks/use-prompt-builder-persistence";
import {
  ART_PACK_OPTIONS,
  getActiveArtPackId,
  isArtPackId,
  setActiveArtPack,
} from "@/lib/art-pack";
import { readStored, writeStored } from "@/lib/prompt-storage";
import { downloadTextFile, slugifyFilename } from "@/lib/browser-download";
import {
  PROMPT_ARCHETYPES,
  type PromptArchetype,
} from "@/lib/prompt-archetypes";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import {
  getEquippedInstructions,
  getFormatCode,
  getRecommendedTrackValues,
  sanitizeCardSystemShape,
  TRACK_IDS,
} from "@/lib/prompt-card-system";
import type { CardSection, TrackId } from "@/lib/prompt-card-system";
import {
  applyRecommendedTracks,
  buildPrompt,
  buildPromptSections,
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
  restoreCardSystem,
  restoreDraft,
  setTrackValue,
  toggleEquippedCard,
  withDraftText,
} from "@/lib/prompt-builder-state";
import {
  FLOW_PANEL_INDEX,
  getCraftStepIndexForPanel,
  getNextIncompletePanel,
} from "@/lib/prompt-navigation";
import type {
  CardSystemState,
  PromptDraft,
  PromptDraftTextField,
} from "@/lib/prompt-builder-state";
import {
  PROOF_SCENARIOS,
  type ProofScenario,
} from "@/lib/prompt-proof-scenarios";
import {
  decodeSessionParam,
  encodeSessionParam,
  restorePromptSession,
  serializePromptSession,
} from "@/lib/prompt-session";
import {
  buildCustomArchetype,
  deleteCustomArchetype,
  listCustomArchetypes,
  saveCustomArchetype,
} from "@/lib/prompt-custom-archetypes";
import {
  deleteFromLibrary,
  listSavedPrompts,
  saveToLibrary,
} from "@/lib/prompt-library";
import type { SavedPrompt } from "@/lib/prompt-library";
import { insertIntoSlots } from "@/lib/slot-order";
import type { PromptRole } from "@/lib/prompt-types";
import { PHONE_MEDIA_QUERY } from "@/lib/tool-registry";

const ART_PACK_STORAGE_KEY = "digitools.prompt-builder.art-pack-v1";

export function PromptBuilder({ roles }: { roles: PromptRole[] }) {
  const [draft, setDraft] = useState<PromptDraft>(EMPTY_DRAFT);
  const [cardSystem, setCardSystem] =
    useState<CardSystemState>(createCardSystem);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  // "all" is the browse default (owner, 2026-08-19): every role visible,
  // categories acting as filters rather than an obligatory first pick.
  const [activeRoleCategory, setActiveRoleCategory] = useState("all");
  const [roleSelectionMessage, setRoleSelectionMessage] = useState("");
  const [roleWorkbenchVersion, setRoleWorkbenchVersion] = useState(0);
  const [activeArchetypeId, setActiveArchetypeId] = useState<string | null>(
    null,
  );
  // The library name the current draft was loaded from or saved as; feeds the
  // download filename when no archetype is active.
  const [activePromptName, setActivePromptName] = useState<string | null>(
    null,
  );
  // At phone widths the expanded dock overlays the whole workspace, so the
  // default is collapsed there and expanded everywhere else; any explicit
  // choice (toggle, proof scenarios, review actions) wins over the default.
  const phoneWidthDock = useMediaQuery(PHONE_MEDIA_QUERY);
  const [outputExpandedChoice, setOutputExpanded] = useState<boolean | null>(
    null,
  );
  const outputExpanded = outputExpandedChoice ?? !phoneWidthDock;
  const [proofLabOpen, setProofLabOpen] = useState(false);
  const [archetypeSaveOpen, setArchetypeSaveOpen] = useState(false);
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Which world dresses the cards. The pack module owns the actual switch;
  // this state exists to re-render the deck (every face and bio resolves at
  // render time) and to remember the choice across visits.
  const [artPackId, setArtPackId] = useState(getActiveArtPackId());
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [customArchetypes, setCustomArchetypes] = useState<PromptArchetype[]>(
    [],
  );
  const formatCode = getFormatCode(draft.format);
  // The print sheet below portals on FIRST render, so the target must be
  // resolved after hydration — a render-time DOM read here made the client
  // render a portal where the server rendered null, and that mismatch cost
  // the whole route its server HTML and its theme (see use-portal-target).
  const portalTarget = usePortalTarget();
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
      setDraft((current) => withDraftText(current, field, value));
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
  const equippedInstructions = useMemo(
    () => getEquippedInstructions(cardSystem.equipped, cardSystem.tracks),
    [cardSystem.equipped, cardSystem.tracks],
  );
  const activeArchetype = useMemo(
    () =>
      activeArchetypeId
        ? ([...PROMPT_ARCHETYPES, ...customArchetypes].find(
            (archetype) => archetype.id === activeArchetypeId,
          ) ?? null)
        : null,
    [activeArchetypeId, customArchetypes],
  );
  const audienceDefault = activeArchetype?.defaultAudience ?? null;
  // Best available name for exports: archetype, then the library name the
  // draft came from, then the lead role. slugifyFilename falls back to
  // "craft", reproducing the legacy craft-prompt.* / craft-session.json.
  const exportBase = slugifyFilename(
    activeArchetype?.name ?? activePromptName ?? selectedRoles[0]?.name ?? "",
    "craft",
  );
  const promptFileBase = exportBase.endsWith("prompt")
    ? exportBase
    : `${exportBase}-prompt`;
  const prompt = useMemo(
    () => buildPrompt(draft, selectedRoles, equippedInstructions, {
      audienceDefault,
    }),
    [audienceDefault, draft, equippedInstructions, selectedRoles],
  );
  const promptSections = useMemo(
    () => buildPromptSections(draft, selectedRoles, equippedInstructions, {
      audienceDefault,
    }),
    [audienceDefault, draft, equippedInstructions, selectedRoles],
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
  const nav = useCraftFlowNavigation();
  const nextIncompletePanel = getNextIncompletePanel(
    nav.activePanel,
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
  const activeCraftStepIndex = getCraftStepIndexForPanel(nav.activePanel);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedPrompts(listSavedPrompts());
      setCustomArchetypes(listCustomArchetypes());
      // Restore the chosen world. localStorage is user-editable, so the value
      // only counts if it names a pack this build actually ships.
      const storedPack = readStored<unknown>(ART_PACK_STORAGE_KEY, null);
      if (isArtPackId(storedPack) && setActiveArtPack(storedPack)) {
        setArtPackId(storedPack);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function switchArtPack(id: string) {
    if (setActiveArtPack(id)) {
      setArtPackId(id);
      writeStored(ART_PACK_STORAGE_KEY, id);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const shared = new URLSearchParams(window.location.search).get("p");
      if (!shared) {
        return;
      }

      try {
        const { draft: nextDraft, cardSystem: nextCardSystem } =
          decodeSessionParam(shared, roles);
        setDraft(nextDraft);
        setCardSystem(nextCardSystem);
        setActiveRoleCategory("all");
        setRoleWorkbenchVersion((current) => current + 1);
        setActiveArchetypeId(null);
        setActivePromptName(null);
        setSpeechMessage("Shared prompt loaded.");
      } catch {
        setSpeechMessage("That shared link could not be read.");
      } finally {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.hash}`,
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [roles, setSpeechMessage]);

  function focusMissingField(field: string) {
    const missingTargets: Record<string, { panel: number; controlId: string }> =
      {
        context: {
          panel: FLOW_PANEL_INDEX.context,
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
          panel: FLOW_PANEL_INDEX.target,
          controlId: "prompt-target-audience",
        },
      };
    const target = missingTargets[field];

    if (!target) {
      return;
    }

    setOutputExpanded(false);
    nav.navigateToPanel(target.panel, target.controlId);
  }

  function updateDraft(field: PromptDraftTextField, value: string) {
    history.checkpoint();
    if (field !== "context" && field !== "targetAudience") {
      setActiveArchetypeId(null);
    }
    setCopyState("idle");
    setDraft((current) => withDraftText(current, field, value));
  }

  function setUseDefault(
    field: "contextUseDefault" | "targetUseDefault",
    value: boolean,
  ) {
    history.checkpoint();
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
    // Sanitized so custom archetypes saved against an older catalog still apply.
    setCardSystem(
      sanitizeCardSystemShape({
        tracks: { ...archetype.tracks },
        equipped: createEquippedSlots(archetype.equipped),
        memory: createEmptySnapMemory(),
        overrides: [],
        suggested: createEmptySuggestedCards(),
      }),
    );
    setActiveRoleCategory("all");
    setRoleWorkbenchVersion((current) => current + 1);
    setActiveArchetypeId(archetype.id);
    setActiveProofId(null);
    setProofLabOpen(false);
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
    setActiveRoleCategory("all");
    setRoleWorkbenchVersion((current) => current + 1);
    setRoleSelectionMessage("");
    setActiveArchetypeId(null);
    setActivePromptName(null);
    setActiveProofId(null);
    nav.setActivePanel(FLOW_PANEL_INDEX.guide);
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
        target: ["target-language", "target-stance"],
      }),
    });
    setActiveRoleCategory("all");
    setRoleWorkbenchVersion((current) => current + 1);
    setRoleSelectionMessage(
      "Example loaded with UX / UI Advisor as the lead role.",
    );
    setActiveArchetypeId(null);
    setActivePromptName(null);
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
    setActiveRoleCategory("all");
    setRoleWorkbenchVersion((current) => current + 1);
    setRoleSelectionMessage(
      validRoleIds.length > 0
        ? `${scenario.name} loaded with ${validRoleIds.length} role ${
            validRoleIds.length === 1 ? "card" : "cards"
          }.`
        : `${scenario.name} loaded with an empty role loadout.`,
    );
    setActiveArchetypeId(null);
    setActivePromptName(null);
    setActiveProofId(scenario.id);
    setProofLabOpen(false);
    setOutputExpanded(scenario.outputExpanded ?? true);
    setCopyState("idle");
    setSpeechMessage(
      `${scenario.name} proof loaded. Follow the verification checklist.`,
    );
    nav.navigateToPanel(scenario.panel);
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
      setRoleSelectionMessage(`${role.name} removed.`);
      setCopyState("idle");
      return;
    }

    if (draft.roleIds.length >= 3) {
      setRoleSelectionMessage("Loadout full. Remove a role first.");
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

  function downloadSession() {
    downloadTextFile(
      `${exportBase}-session.json`,
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

      history.checkpoint();
      cancelDictation(true);
      setDraft(nextDraft);
      setCardSystem(nextCardSystem);
      setActiveRoleCategory("all");
      setRoleWorkbenchVersion((current) => current + 1);
      setActiveArchetypeId(null);
      setActivePromptName(null);
      setActiveProofId(null);
      setCopyState("idle");
      setSpeechMessage("Session imported.");
    } catch {
      setSpeechMessage("That file is not a valid C.R.A.F.T. session.");
    } finally {
      event.target.value = "";
    }
  }

  function saveCurrentToLibrary(name: string) {
    setSavedPrompts(saveToLibrary(name, draft, cardSystem));
    // Mirror saveToLibrary's fallback so exports pick up the saved name.
    setActivePromptName(name.trim() || "Untitled prompt");
    setSpeechMessage("Saved to your prompt library.");
  }

  function loadSavedPrompt(entry: SavedPrompt) {
    history.checkpoint();
    cancelDictation(true);
    // Restore through the same validators as autosave, URL shares, and
    // session imports: the library store is shape-filtered on read, but the
    // field types inside draft/cardSystem are still unchecked JSON — a
    // hand-edited entry must degrade to defaults, not crash. This also gives
    // pre-boolean entries their use-default fields.
    const nextDraft = restoreDraft(JSON.stringify(entry.draft ?? {}), roles);
    setDraft(nextDraft);
    setCardSystem(
      restoreCardSystem(
        JSON.stringify(entry.cardSystem ?? {}),
        nextDraft.format,
      ),
    );
    setActiveRoleCategory("all");
    setRoleWorkbenchVersion((current) => current + 1);
    setActiveArchetypeId(null);
    setActivePromptName(entry.name);
    setActiveProofId(null);
    setLibraryOpen(false);
    setCopyState("idle");
    setSpeechMessage(`Loaded "${entry.name}".`);
  }

  function removeSavedPrompt(id: string) {
    setSavedPrompts(deleteFromLibrary(id));
  }

  function saveCurrentAsPreset(name: string) {
    const archetype = buildCustomArchetype(
      name,
      formatCode,
      draft.roleIds,
      draft.action,
      draft.formatNotes,
      cardSystem,
    );
    setCustomArchetypes(saveCustomArchetype(archetype));
    setActiveArchetypeId(archetype.id);
    setSpeechMessage(`Saved "${archetype.name}" as a preset.`);
  }

  function removeCustomPreset(id: string) {
    setCustomArchetypes(deleteCustomArchetype(id));
    setActiveArchetypeId((current) => (current === id ? null : current));
  }

  async function copyShareLink() {
    try {
      const param = encodeSessionParam(draft, cardSystem);
      const url = `${window.location.origin}${window.location.pathname}?p=${param}`;
      await navigator.clipboard.writeText(url);
      setSpeechMessage("Share link copied to clipboard.");
    } catch {
      setSpeechMessage("Could not copy the share link.");
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

    nav.navigateToPanel(nextIncompletePanel);
  }

  const dictationApi: CraftDictationApi = {
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
    <div className={"tool-page prompt-flow-page is-craft-flow"}>
      <PromptBuilderHeader
        stepStrip={
          <FlowStepStrip
            parts={CRAFT_PARTS}
            activeIndex={activeCraftStepIndex}
            completion={flowStepComplete}
            guideActive={nav.activePanel === FLOW_PANEL_INDEX.guide}
            onGuide={() => nav.navigateToPanel(FLOW_PANEL_INDEX.guide)}
            onSelect={(index) => nav.navigateToCraftStep(index)}
            ariaLabel="C.R.A.F.T. builder steps"
          />
        }
        saveStatus={persistence.status}
        lastSavedAt={persistence.lastSavedAt}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        completedStepCount={completedStepCount}
        continueLabel={nextIncompletePart ? "Continue" : "Review output"}
        proofLabOpen={proofLabOpen}
        onUndo={undoLastChange}
        onRedo={redoLastChange}
        onContinue={continueBuilding}
        onExportSession={downloadSession}
        onImportSession={importSession}
        onLoadExample={loadExample}
        onOpenLibrary={() => setLibraryOpen(true)}
        onCopyShareLink={copyShareLink}
        onOpenProofLab={() => {
          setProofLabOpen(true);
          setOutputExpanded(false);
        }}
        onSaveArchetypePreset={() => setArchetypeSaveOpen(true)}
        onReset={resetDraft}
      />

      <PromptProofLab
        open={proofLabOpen}
        activeProofId={activeProofId}
        scenarios={PROOF_SCENARIOS}
        onClose={() => setProofLabOpen(false)}
        onLoad={loadProofScenario}
      />

      <PromptLibraryPanel
        open={libraryOpen}
        savedPrompts={savedPrompts}
        onClose={() => setLibraryOpen(false)}
        onSave={saveCurrentToLibrary}
        onLoad={loadSavedPrompt}
        onDelete={removeSavedPrompt}
      />

      <div
        className={
          outputExpanded
            ? "builder-main-layout"
            : "builder-main-layout is-output-collapsed"
        }
      >
        <PromptArchetypeToolbar
          archetypes={PROMPT_ARCHETYPES}
          customArchetypes={customArchetypes}
          roles={roles}
          activeId={activeArchetypeId}
          saveFormOpen={archetypeSaveOpen}
          onSaveFormOpenChange={setArchetypeSaveOpen}
          onApply={applyArchetype}
          onSaveCustom={saveCurrentAsPreset}
          onDeleteCustom={removeCustomPreset}
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
            <CraftFlowPanels
              activePanel={nav.activePanel}
              registerPanelHeading={nav.registerPanelHeading}
              flowViewportRef={nav.flowViewportRef}
              draft={draft}
              formatCode={formatCode}
              cardSystem={cardSystem}
              selectedRoles={selectedRoles}
              roles={roles}
              attentionTargetId={nav.attentionTargetId}
              roleWorkbenchVersion={roleWorkbenchVersion}
              activeRoleCategory={activeRoleCategory}
              roleSelectionMessage={roleSelectionMessage}
              dictation={dictationApi}
              artPackId={artPackId}
              onSelectArtPack={switchArtPack}
              navigateToCraftStep={nav.navigateToCraftStep}
              onSelectOutputType={selectOutputType}
              onUpdateDraft={updateDraft}
              onSetUseDefault={setUseDefault}
              onChangeTrack={changeTrack}
              onToggleCard={toggleWorkbenchCard}
              onDropCard={dropWorkbenchCard}
              onRemoveCard={removeWorkbenchCard}
              onClearCards={clearWorkbenchCards}
              onApplyRecommended={applyRecommendedSetup}
              onSetRoleCategory={setActiveRoleCategory}
              onToggleRole={toggleRole}
              onDropRole={dropRoleIntoSlot}
              onClearRoles={clearRoleLoadout}
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
                  <h1>C.R.A.F.T. prompt</h1>
                  <pre>{prompt}</pre>
                </div>,
                portalTarget,
              )
            : null}

          <FlowNavDock
            onBack={
              nav.activePanel > FLOW_PANEL_INDEX.guide
                ? () => nav.navigateToPanel(nav.activePanel - 1)
                : undefined
            }
            onNext={
              nav.activePanel === FLOW_PANEL_INDEX.target
                ? () => setOutputExpanded(true)
                : () => nav.navigateToPanel(nav.activePanel + 1)
            }
            nextLabel={
              nav.activePanel === FLOW_PANEL_INDEX.guide
                ? "Start"
                : nav.activePanel === FLOW_PANEL_INDEX.target
                  ? "Review"
                  : "Next"
            }
          >
            {/* The world switch. Same cards, same prompt - only art and bios
                change, so it rides with whole-deck navigation, stacked. */}
            <div
              className="art-pack-switch"
              role="group"
              aria-label="Card art world"
            >
              {ART_PACK_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    option.id === artPackId
                      ? "art-pack-switch-option is-active"
                      : "art-pack-switch-option"
                  }
                  aria-pressed={option.id === artPackId}
                  onClick={() => switchArtPack(option.id)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </FlowNavDock>
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
