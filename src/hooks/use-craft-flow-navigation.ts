"use client";

import { useEffect, useRef, useState } from "react";
import { FLOW_PANEL_COUNT, getCraftStepPanel } from "@/lib/prompt-navigation";

/**
 * Owns the horizontal CRAFT panel slider: which panel is active, the refs used
 * to focus a panel heading or a specific control after navigation, and the
 * "attention" highlight. Extracted from PromptBuilder so the orchestrator only
 * has to call navigateToPanel / navigateToCraftStep.
 */
export function useCraftFlowNavigation() {
  const [activePanel, setActivePanel] = useState(0);
  const [attentionTargetId, setAttentionTargetId] = useState<string | null>(
    null,
  );
  const panelHeadingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const flowViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldFocusPanelRef = useRef(false);
  const pendingFocusTargetRef = useRef<string | null>(null);

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
    navigateToPanel(getCraftStepPanel(stepIndex));
  }

  function registerPanelHeading(
    panelIndex: number,
    node: HTMLHeadingElement | null,
  ) {
    panelHeadingRefs.current[panelIndex] = node;
  }

  return {
    activePanel,
    setActivePanel,
    attentionTargetId,
    flowViewportRef,
    registerPanelHeading,
    navigateToPanel,
    navigateToCraftStep,
  };
}
