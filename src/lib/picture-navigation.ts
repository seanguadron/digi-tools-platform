// Panel index map for the PICTURE Deck's 8-panel slider (guide + the seven
// P.I.C.T.U.R.E. steps). Proof scenarios address panels by these indices via
// their "panel" field.
//
// Kept free of path aliases and JSON imports so the scripts/*.test.mjs runner
// can load it directly.

export const PICTURE_PANEL_INDEX = {
  guide: 0,
  protagonist: 1,
  illumination: 2,
  canvas: 3,
  tone: 4,
  universe: 5,
  references: 6,
  execution: 7,
} as const;

export type PicturePanelIndex =
  (typeof PICTURE_PANEL_INDEX)[keyof typeof PICTURE_PANEL_INDEX];

// One panel per P.I.C.T.U.R.E. step, in step order.
const PICTURE_STEP_PANELS: readonly number[] = [
  PICTURE_PANEL_INDEX.protagonist,
  PICTURE_PANEL_INDEX.illumination,
  PICTURE_PANEL_INDEX.canvas,
  PICTURE_PANEL_INDEX.tone,
  PICTURE_PANEL_INDEX.universe,
  PICTURE_PANEL_INDEX.references,
  PICTURE_PANEL_INDEX.execution,
];

export const PICTURE_PANEL_COUNT = Object.keys(PICTURE_PANEL_INDEX).length;

export function getPictureStepIndexForPanel(activePanel: number) {
  return PICTURE_STEP_PANELS.indexOf(activePanel);
}

export function getPictureStepPanel(stepIndex: number) {
  return PICTURE_STEP_PANELS[stepIndex] ?? PICTURE_PANEL_INDEX.guide;
}

export function getNextIncompletePicturePanel(
  activePanel: number,
  completeSteps: readonly boolean[],
) {
  if (completeSteps.every(Boolean)) {
    return null;
  }

  const activeStepIndex = getPictureStepIndexForPanel(activePanel);
  for (let offset = 1; offset <= completeSteps.length; offset += 1) {
    const stepIndex = (activeStepIndex + offset) % completeSteps.length;
    if (!completeSteps[stepIndex]) {
      return getPictureStepPanel(stepIndex);
    }
  }

  return null;
}
