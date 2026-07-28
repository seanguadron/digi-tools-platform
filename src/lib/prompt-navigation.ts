export const FLOW_PANEL_INDEX = {
  guide: 0,
  context: 1,
  role: 2,
  action: 3,
  format: 4,
  target: 5,
} as const;

export type FlowPanelIndex =
  (typeof FLOW_PANEL_INDEX)[keyof typeof FLOW_PANEL_INDEX];

// One panel per C.R.A.F.T. step, in step order. Proof scenarios address
// panels by these indices via their "panel" field.
const CRAFT_STEP_PANELS: readonly number[] = [
  FLOW_PANEL_INDEX.context,
  FLOW_PANEL_INDEX.role,
  FLOW_PANEL_INDEX.action,
  FLOW_PANEL_INDEX.format,
  FLOW_PANEL_INDEX.target,
];

export const FLOW_PANEL_COUNT = Object.keys(FLOW_PANEL_INDEX).length;

export function getCraftStepIndexForPanel(activePanel: number) {
  return CRAFT_STEP_PANELS.indexOf(activePanel);
}

export function getCraftStepPanel(stepIndex: number) {
  return CRAFT_STEP_PANELS[stepIndex] ?? FLOW_PANEL_INDEX.guide;
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
      return getCraftStepPanel(stepIndex);
    }
  }

  return null;
}
