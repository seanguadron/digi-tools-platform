"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { SavedPrompt } from "@/lib/prompt-library";

export function PromptLibraryPanel({
  open,
  savedPrompts,
  onClose,
  onSave,
  onLoad,
  onDelete,
}: {
  open: boolean;
  savedPrompts: SavedPrompt[];
  onClose: () => void;
  onSave: (name: string) => void;
  onLoad: (entry: SavedPrompt) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const portalTarget =
    typeof document === "undefined" ? null : document.body;

  if (!open || !portalTarget) {
    return null;
  }

  function handleSave() {
    onSave(name);
    setName("");
  }

  return createPortal(
    <>
      <button
        className="prompt-library-backdrop"
        type="button"
        aria-label="Close prompt library"
        onClick={onClose}
      />
      <aside
        className="prompt-library-panel"
        id="prompt-library-panel"
        aria-labelledby="prompt-library-title"
      >
        <div className="prompt-library-header">
          <strong id="prompt-library-title">Saved prompts</strong>
          <button type="button" onClick={onClose} aria-label="Close library">
            x
          </button>
        </div>

        <div className="prompt-library-save">
          <input
            type="text"
            value={name}
            placeholder="Name this prompt"
            aria-label="Prompt name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
          />
          <button
            className="button button-primary"
            type="button"
            onClick={handleSave}
          >
            Save current
          </button>
        </div>

        {savedPrompts.length === 0 ? (
          <p className="prompt-library-empty">
            No saved prompts yet. Save the current build to reuse it later.
          </p>
        ) : (
          <ul className="prompt-library-list">
            {savedPrompts.map((entry) => (
              <li key={entry.id}>
                <div className="prompt-library-row-info">
                  <strong>{entry.name}</strong>
                  <small>
                    {new Date(entry.savedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
                <div className="prompt-library-row-actions">
                  <button type="button" onClick={() => onLoad(entry)}>
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(entry.id)}
                    aria-label={`Delete ${entry.name}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>,
    portalTarget,
  );
}
