"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { createPortal } from "react-dom";

type SaveStatus = "restoring" | "saved" | "unavailable";

function getSaveStatusLabel(status: SaveStatus, lastSavedAt: Date | null) {
  if (status === "unavailable") {
    return "Local save unavailable";
  }

  if (status === "restoring") {
    return "Restoring...";
  }

  return lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Saved locally";
}

export function PromptBuilderHeader({
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  completedStepCount,
  continueLabel,
  proofLabOpen,
  onUndo,
  onRedo,
  onContinue,
  onExportSession,
  onImportSession,
  onLoadExample,
  onOpenProofLab,
  onReset,
}: {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  completedStepCount: number;
  continueLabel: string;
  proofLabOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onContinue: () => void;
  onExportSession: () => void;
  onImportSession: (event: ChangeEvent<HTMLInputElement>) => void;
  onLoadExample: () => void;
  onOpenProofLab: () => void;
  onReset: () => void;
}) {
  const toolsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const sessionInputRef = useRef<HTMLInputElement | null>(null);
  const saveStatusLabel = getSaveStatusLabel(saveStatus, lastSavedAt);
  const subbarTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("app-subbar-slot");

  function runTool(action: () => void) {
    action();
    if (toolsMenuRef.current) {
      toolsMenuRef.current.open = false;
    }
  }

  const headerContent = (
    <div className="prompt-subbar" data-component="Header:Tool">
      <div className="prompt-flow-title">
        <span className="tool-kicker">C.R.A.F.T. Prompt Builder</span>
        <h1>Build a prompt.</h1>
        <span
          className={
            saveStatus === "unavailable"
              ? "builder-save-state is-unavailable"
              : "builder-save-state"
          }
          role="status"
        >
          {saveStatusLabel}
        </span>
      </div>
      <div className="prompt-flow-header-actions">
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
          <span>{completedStepCount}/5</span>
        </button>
        <details className="builder-tools-menu" ref={toolsMenuRef}>
          <summary className="button button-quiet">Tools</summary>
          <div>
            <button
              type="button"
              onClick={() => runTool(onExportSession)}
            >
              Export session
            </button>
            <button
              type="button"
              onClick={() => sessionInputRef.current?.click()}
            >
              Import session
            </button>
            <input
              className="sr-only"
              ref={sessionInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                onImportSession(event);
                if (toolsMenuRef.current) {
                  toolsMenuRef.current.open = false;
                }
              }}
            />
            <button type="button" onClick={() => runTool(onLoadExample)}>
              Load example
            </button>
            <button
              type="button"
              onClick={() => runTool(onOpenProofLab)}
              aria-expanded={proofLabOpen}
              aria-controls="prompt-proof-lab"
            >
              Proof Lab
            </button>
            <button type="button" onClick={() => runTool(onReset)}>
              Reset
            </button>
          </div>
        </details>
      </div>
    </div>
  );

  return subbarTarget ? createPortal(headerContent, subbarTarget) : null;
}
