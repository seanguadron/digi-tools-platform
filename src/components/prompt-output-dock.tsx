"use client";

type CopyState = "idle" | "copied" | "error";

export type MissingPromptItem = {
  field: string;
  label: string;
};

export function PromptOutputDock({
  expanded,
  complete,
  missingItems,
  prompt,
  copyState,
  onToggle,
  onMissingSelect,
  onCopy,
  onDownload,
}: {
  expanded: boolean;
  complete: boolean;
  missingItems: MissingPromptItem[];
  prompt: string;
  copyState: CopyState;
  onToggle: () => void;
  onMissingSelect: (field: string) => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const wordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const estimatedTokens = Math.ceil(prompt.length / 4);

  return (
    <>
      {expanded ? (
        <button
          className="output-dock-backdrop"
          type="button"
          onClick={onToggle}
          aria-label="Close live output"
        />
      ) : null}

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
              <h2 id="preview-title">craft-prompt.md</h2>
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
              onClick={onDownload}
              disabled={!complete}
            >
              Download .md
            </button>
          </div>

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
    </>
  );
}
