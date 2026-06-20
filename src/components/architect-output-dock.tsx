"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function ArchitectOutputDock({
  open,
  markdown,
  json,
  copyState,
  onClose,
  onCopy,
  onDownloadMarkdown,
  onDownloadJson,
}: {
  open: boolean;
  markdown: string;
  json: string;
  copyState: "idle" | "copied" | "error";
  onClose: () => void;
  onCopy: () => void;
  onDownloadMarkdown: () => void;
  onDownloadJson: () => void;
}) {
  const [format, setFormat] = useState<"markdown" | "json">("markdown");
  const portalTarget =
    typeof document === "undefined" ? null : document.body;

  if (!open || !portalTarget) {
    return null;
  }

  const body = format === "markdown" ? markdown : json;

  return createPortal(
    <>
      <button
        className="architect-modal-backdrop"
        type="button"
        aria-label="Close output"
        onClick={onClose}
      />
      <aside
        className="architect-modal architect-output"
        aria-labelledby="architect-output-title"
      >
        <div className="architect-modal-header">
          <strong id="architect-output-title">Build brief</strong>
          <button type="button" onClick={onClose} aria-label="Close output">
            x
          </button>
        </div>

        <div className="architect-output-toggle" role="group" aria-label="Preview format">
          <button
            type="button"
            className={format === "markdown" ? "is-active" : ""}
            aria-pressed={format === "markdown"}
            onClick={() => setFormat("markdown")}
          >
            Markdown
          </button>
          <button
            type="button"
            className={format === "json" ? "is-active" : ""}
            aria-pressed={format === "json"}
            onClick={() => setFormat("json")}
          >
            JSON
          </button>
        </div>

        <pre className="architect-output-preview" aria-live="polite">
          <code>{body}</code>
        </pre>

        <div className="architect-modal-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={onCopy}
          >
            {copyState === "copied" ? "Copied" : "Copy Markdown"}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={onDownloadMarkdown}
          >
            Download .md
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={onDownloadJson}
          >
            Download .json
          </button>
        </div>

        {copyState === "error" ? (
          <p className="inline-error" role="alert">
            Clipboard access was blocked. Download the file instead.
          </p>
        ) : null}
      </aside>
    </>,
    portalTarget,
  );
}
