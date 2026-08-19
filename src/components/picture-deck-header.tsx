"use client";

import { useRef } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  ToolSaveStateChip,
  ToolSubbar,
  ToolSubbarActions,
  ToolSubbarTitle,
} from "@/components/tool-subbar";
import { isSaveStateUnavailable, type SaveStatus } from "@/lib/save-status";

export function PictureDeckHeader({
  stepStrip,
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  completedStepCount,
  continueLabel,
  onUndo,
  onRedo,
  onContinue,
  proofLabOpen,
  onExportSession,
  onImportSession,
  onLoadExample,
  onOpenLibrary,
  onCopyShareLink,
  onOpenProofLab,
  onSaveArchetypePreset,
  onReset,
}: {
  // The compact P.I.C.T.U.R.E. step navigation, composed by the deck root.
  stepStrip: ReactNode;
  // Save state surfaces ONLY on failure (owner call, 2026-08-19).
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  completedStepCount: number;
  continueLabel: string;
  onUndo: () => void;
  onRedo: () => void;
  onContinue: () => void;
  proofLabOpen: boolean;
  onExportSession: () => void;
  onImportSession: (event: ChangeEvent<HTMLInputElement>) => void;
  onLoadExample: () => void;
  onOpenLibrary: () => void;
  onCopyShareLink: () => void;
  onOpenProofLab: () => void;
  onSaveArchetypePreset: () => void;
  onReset: () => void;
}) {
  const toolsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const sessionInputRef = useRef<HTMLInputElement | null>(null);

  function runTool(action: () => void) {
    action();
    if (toolsMenuRef.current) {
      toolsMenuRef.current.open = false;
    }
  }

  return (
    <ToolSubbar className="picture-deck-subbar">
      <ToolSubbarTitle
        kicker="PICTURE Deck"
        heading="Build an image prompt."
        headingHidden
      >
        {isSaveStateUnavailable(saveStatus) ? (
          <ToolSaveStateChip status={saveStatus} lastSavedAt={lastSavedAt} />
        ) : null}
      </ToolSubbarTitle>
      {stepStrip}
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
            <button type="button" onClick={() => runTool(onExportSession)}>
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
            <button type="button" onClick={() => runTool(onOpenLibrary)}>
              Saved prompts
            </button>
            <button
              type="button"
              onClick={() => runTool(onSaveArchetypePreset)}
            >
              Save archetype preset
            </button>
            <button type="button" onClick={() => runTool(onCopyShareLink)}>
              Copy share link
            </button>
            <button
              type="button"
              onClick={() => runTool(onOpenProofLab)}
              aria-expanded={proofLabOpen}
              aria-controls="picture-proof-lab"
            >
              Proof Lab
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
