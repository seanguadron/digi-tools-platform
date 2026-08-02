"use client";

import { useFlowNavigation } from "@/hooks/use-flow-navigation";
import { FLOW_PANEL_COUNT, getCraftStepPanel } from "@/lib/prompt-navigation";

/**
 * The CRAFT deck's binding of the shared flow-navigation hook: its panel
 * count plus the step->panel map behind navigateToCraftStep. Extracted from
 * PromptBuilder so the orchestrator only has to call navigateToPanel /
 * navigateToCraftStep.
 */
export function useCraftFlowNavigation() {
  const navigation = useFlowNavigation({ panelCount: FLOW_PANEL_COUNT });

  function navigateToCraftStep(stepIndex: number) {
    navigation.navigateToPanel(getCraftStepPanel(stepIndex));
  }

  return {
    ...navigation,
    navigateToCraftStep,
  };
}
