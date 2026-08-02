"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "error";

// Structural section shape so both decks' section types fit (their key
// unions differ; the dock only renders and copies them).
type PromptSection = {
  key: string;
  heading: string;
  label: string;
  body: string;
};

export type MissingPromptItem = {
  field: string;
  label: string;
};

export function PromptOutputDock({
  expanded,
  complete,
  missingItems,
  prompt,
  sections,
  copyState,
  onToggle,
  onMissingSelect,
  onCopy,
  onDownload,
  onPrint,
}: {
  expanded: boolean;
  complete: boolean;
  missingItems: MissingPromptItem[];
  prompt: string;
  sections: PromptSection[] | null;
  copyState: CopyState;
  onToggle: () => void;
  onMissingSelect: (field: string) => void;
  onCopy: () => void;
  onDownload: (format: "md" | "txt" | "json") => void;
  onPrint: () => void;
}) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const wordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const estimatedTokens = Math.ceil(prompt.length / 4);

  async function copySection(section: PromptSection) {
    try {
      await navigator.clipboard.writeText(`${section.heading}\n${section.body}`);
      setCopiedSection(section.key);
      window.setTimeout(() => {
        setCopiedSection((current) =>
          current === section.key ? null : current,
        );
      }, 1200);
    } catch {
      setCopiedSection(null);
    }
  }

  return (
    <aside
      id="prompt-output-dock"
      className={
        expanded ? "prompt-output-dock is-expanded" : "prompt-output-dock"
      }
      aria-labelledby="preview-title"
      data-component="Panel:PromptPreview"
    >
        <button
          className="output-dock-toggle"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="prompt-output-content"
          aria-label={expanded ? "Collapse live output" : "Expand live output"}
        >
          <span aria-hidden="true">{expanded ? ">" : "<"}</span>
          <strong>Output</strong>
          <small>{complete ? "Ready" : missingItems.length}</small>
        </button>

        <div
          className="output-dock-content"
          id="prompt-output-content"
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <div className="preview-header">
            <div>
              <h2 id="preview-title">Assembled prompt</h2>
            </div>
            <span className={complete ? "preview-state is-ready" : "preview-state"}>
              {complete ? "Ready" : `${missingItems.length} missing`}
            </span>
          </div>

          <pre aria-live="polite">
            <code>{prompt}</code>
          </pre>

          <dl className="prompt-stats" aria-label="Prompt statistics">
            <div>
              <dt>Words</dt>
              <dd>{wordCount}</dd>
            </div>
            <div>
              <dt>Est. tokens</dt>
              <dd>{estimatedTokens}</dd>
            </div>
            <div>
              <dt>Characters</dt>
              <dd>{prompt.length}</dd>
            </div>
          </dl>

          <div className="preview-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={onCopy}
              disabled={!complete}
            >
              {copyState === "copied" ? "Copied" : "Copy prompt"}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onPrint}
              disabled={!complete}
            >
              Print / PDF
            </button>
          </div>

          <div className="preview-export" role="group" aria-label="Download prompt">
            <span>Download</span>
            <button
              type="button"
              onClick={() => onDownload("md")}
              disabled={!complete}
            >
              .md
            </button>
            <button
              type="button"
              onClick={() => onDownload("txt")}
              disabled={!complete}
            >
              .txt
            </button>
            <button
              type="button"
              onClick={() => onDownload("json")}
              disabled={!complete}
            >
              .json
            </button>
          </div>

          {complete && sections ? (
            <div
              className="preview-section-copy"
              role="group"
              aria-label="Copy a single section"
            >
              <span>Copy section</span>
              {sections.map((section) => (
                <button
                  type="button"
                  onClick={() => copySection(section)}
                  key={section.key}
                >
                  {copiedSection === section.key ? "Copied" : section.label}
                </button>
              ))}
            </div>
          ) : null}

          {!complete ? (
            <div className="missing-fields">
              <span>Missing</span>
              <div className="missing-field-list">
                {missingItems.map((item) => (
                  <button
                    type="button"
                    onClick={() => onMissingSelect(item.field)}
                    key={item.field}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {copyState === "error" ? (
            <p className="inline-error" role="alert">
              Clipboard access was blocked. Download the file instead.
            </p>
          ) : null}
        </div>
    </aside>
  );
}
