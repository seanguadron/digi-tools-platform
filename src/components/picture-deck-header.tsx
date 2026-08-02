"use client";

import { useRef } from "react";
import {
  ToolSaveStateChip,
  ToolSubbar,
  ToolSubbarActions,
  ToolSubbarTitle,
} from "@/components/tool-subbar";
import type { SaveStatus } from "@/lib/save-status";

export function PictureDeckHeader({
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  completedStepCount,
  continueLabel,
  onUndo,
  onRedo,
  onContinue,
  onLoadExample,
  onReset,
}: {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  completedStepCount: number;
  continueLabel: string;
  onUndo: () => void;
  onRedo: () => void;
  onContinue: () => void;
  onLoadExample: () => void;
  onReset: () => void;
}) {
  const toolsMenuRef = useRef<HTMLDetailsElement | null>(null);

  function runTool(action: () => void) {
    action();
    if (toolsMenuRef.current) {
      toolsMenuRef.current.open = false;
    }
  }

  return (
    <ToolSubbar>
      <ToolSubbarTitle
        kicker="P.I.C.T.U.R.E. Image Deck"
        heading="Build an image prompt."
      >
        <ToolSaveStateChip status={saveStatus} lastSavedAt={lastSavedAt} />
      </ToolSubbarTitle>
      <ToolSubbarActions>
        <div className="history-actions" aria-label="Edit history">
          <button
            className="button button-quiet"
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>
        </div>
        <button
          className="button button-primary builder-continue-button"
          type="button"
          onClick={onContinue}
        >
          {continueLabel}
          <span>{completedStepCount}/7</span>
        </button>
        <details className="builder-tools-menu" ref={toolsMenuRef}>
          <summary className="button button-quiet">Tools</summary>
          <div>
            <button type="button" onClick={() => runTool(onLoadExample)}>
              Load example
            </button>
            <button type="button" onClick={() => runTool(onReset)}>
              Reset
            </button>
          </div>
        </details>
      </ToolSubbarActions>
    </ToolSubbar>
  );
}
