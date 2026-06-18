export const FLOW_PANEL_INDEX = {
  guide: 0,
  contextWrite: 1,
  contextCards: 2,
  role: 3,
  action: 4,
  format: 5,
  targetWrite: 6,
  targetCards: 7,
} as const;

export type FlowPanelIndex =
  (typeof FLOW_PANEL_INDEX)[keyof typeof FLOW_PANEL_INDEX];

const CRAFT_STEP_ENTRY_PANELS = [
  FLOW_PANEL_INDEX.contextWrite,
  FLOW_PANEL_INDEX.role,
  FLOW_PANEL_INDEX.action,
  FLOW_PANEL_INDEX.format,
  FLOW_PANEL_INDEX.targetWrite,
] as const;

const CRAFT_STEP_CARD_PANELS = [
  FLOW_PANEL_INDEX.contextCards,
  FLOW_PANEL_INDEX.role,
  FLOW_PANEL_INDEX.action,
  FLOW_PANEL_INDEX.format,
  FLOW_PANEL_INDEX.targetCards,
] as const;

export const FLOW_PANEL_COUNT = Object.keys(FLOW_PANEL_INDEX).length;

export function getCraftStepIndexForPanel(activePanel: number) {
  if (
    activePanel === FLOW_PANEL_INDEX.contextWrite ||
    activePanel === FLOW_PANEL_INDEX.contextCards
  ) {
    return 0;
  }

  if (activePanel === FLOW_PANEL_INDEX.role) {
    return 1;
  }

  if (activePanel === FLOW_PANEL_INDEX.action) {
    return 2;
  }

  if (activePanel === FLOW_PANEL_INDEX.format) {
    return 3;
  }

  if (
    activePanel === FLOW_PANEL_INDEX.targetWrite ||
    activePanel === FLOW_PANEL_INDEX.targetCards
  ) {
    return 4;
  }

  return -1;
}

export function getCraftStepPanel(
  stepIndex: number,
  completeSteps: readonly boolean[],
  preferredPanel?: number,
) {
  if (
    preferredPanel !== undefined &&
    getCraftStepIndexForPanel(preferredPanel) === stepIndex
  ) {
    return preferredPanel;
  }

  if (!completeSteps[stepIndex]) {
    return CRAFT_STEP_ENTRY_PANELS[stepIndex] ?? FLOW_PANEL_INDEX.guide;
  }

  return CRAFT_STEP_CARD_PANELS[stepIndex] ?? FLOW_PANEL_INDEX.guide;
}

export function getLegacyProofPanel(panel: number) {
  switch (panel) {
    case 0:
      return FLOW_PANEL_INDEX.guide;
    case 1:
      return FLOW_PANEL_INDEX.contextCards;
    case 2:
      return FLOW_PANEL_INDEX.role;
    case 3:
      return FLOW_PANEL_INDEX.action;
    case 4:
      return FLOW_PANEL_INDEX.format;
    case 5:
      return FLOW_PANEL_INDEX.targetCards;
    default:
      return FLOW_PANEL_INDEX.guide;
  }
}

export function getNextIncompletePanel(
  activePanel: number,
  completeSteps: readonly boolean[],
) {
  if (completeSteps.every(Boolean)) {
    return null;
  }

  const activeStepIndex = getCraftStepIndexForPanel(activePanel);
  for (let offset = 1; offset <= completeSteps.length; offset += 1) {
    const stepIndex = (activeStepIndex + offset) % completeSteps.length;
    if (!completeSteps[stepIndex]) {
      return CRAFT_STEP_ENTRY_PANELS[stepIndex] ?? FLOW_PANEL_INDEX.guide;
    }
  }

  return null;
}
