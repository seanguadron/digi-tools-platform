"use client";

// The deck's step navigation, compacted to live inside the 42px subbar: a
// Guide button plus one letter tile per step. This replaced the full-width
// .flow-stepper row under the subbar - labels ride along as title/aria text
// only, the same trade the old stepper's phone tier already made.
export interface FlowStepStripPart {
  letter: string;
  label: string;
}

export function FlowStepStrip({
  parts,
  activeIndex,
  completion,
  guideActive,
  onGuide,
  onSelect,
  ariaLabel,
}: {
  parts: readonly FlowStepStripPart[];
  // Index into parts, or -1 when a non-step panel (the guide) is active.
  activeIndex: number;
  completion: readonly boolean[];
  guideActive: boolean;
  onGuide: () => void;
  onSelect: (index: number) => void;
  ariaLabel: string;
}) {
  return (
    <nav className="flow-step-strip" aria-label={ariaLabel}>
      <button
        className={
          guideActive ? "flow-strip-guide is-active" : "flow-strip-guide"
        }
        type="button"
        onClick={onGuide}
        aria-current={guideActive ? "step" : undefined}
      >
        Guide
      </button>
      {parts.map(({ letter, label }, index) => {
        const active = index === activeIndex;
        const complete = Boolean(completion[index]);

        return (
          <button
            className={[
              "flow-strip-step",
              active ? "is-active" : "",
              complete ? "is-complete" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={active ? "step" : undefined}
            aria-label={`${label}${complete ? ", complete" : ""}`}
            title={label}
            key={letter}
          >
            {letter}
          </button>
        );
      })}
    </nav>
  );
}
