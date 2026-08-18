"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import {
  ToolSaveStateChip,
  ToolSubbar,
  ToolSubbarActions,
  ToolSubbarTitle,
} from "@/components/tool-subbar";
import { ART_PACK_OPTIONS } from "@/lib/art-pack";
import type { SaveStatus } from "@/lib/save-status";

export function PromptBuilderHeader({
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  completedStepCount,
  continueLabel,
  proofLabOpen,
  artPackId,
  onSwitchArtPack,
  onUndo,
  onRedo,
  onContinue,
  onExportSession,
  onImportSession,
  onLoadExample,
  onOpenLibrary,
  onCopyShareLink,
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
  artPackId: string;
  onSwitchArtPack: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onContinue: () => void;
  onExportSession: () => void;
  onImportSession: (event: ChangeEvent<HTMLInputElement>) => void;
  onLoadExample: () => void;
  onOpenLibrary: () => void;
  onCopyShareLink: () => void;
  onOpenProofLab: () => void;
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
    <ToolSubbar className="prompt-builder-subbar">
      <ToolSubbarTitle kicker="C.R.A.F.T. Prompt Deck" heading="Build a prompt.">
        <ToolSaveStateChip status={saveStatus} lastSavedAt={lastSavedAt} />
      </ToolSubbarTitle>
      {/* The world switch. Same cards, same prompt - only the art and the
          bios change, so it lives with the other whole-deck controls rather
          than inside any one C.R.A.F.T. section. */}
      <div className="art-pack-switch" role="group" aria-label="Card art world">
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
            onClick={() => onSwitchArtPack(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
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
            <button type="button" onClick={() => runTool(onOpenLibrary)}>
              Saved prompts
            </button>
            <button type="button" onClick={() => runTool(onCopyShareLink)}>
              Copy share link
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
      </ToolSubbarActions>
    </ToolSubbar>
  );
}
