"use client";

interface HistoryPanelProps {
  depth: number;
  position: number;
  onJump: (target: number) => void;
}

// A visual undo timeline — click a state to jump to it.
export function ImageEditorHistory({
  depth,
  position,
  onJump,
}: HistoryPanelProps) {
  return (
    <aside className="image-editor-history" aria-label="History">
      <div className="image-editor-history-head">
        <span className="image-editor-panel-label">History</span>
      </div>
      <ul className="image-editor-history-list">
        {Array.from({ length: depth }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              className={
                i === position
                  ? "image-editor-history-step is-active"
                  : i > position
                    ? "image-editor-history-step is-future"
                    : "image-editor-history-step"
              }
              aria-current={i === position ? "true" : undefined}
              onClick={() => onJump(i)}
            >
              {i === 0 ? "Base image" : `Edit ${i}`}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
