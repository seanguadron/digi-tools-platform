"use client";

import type { ReactNode } from "react";

// The deck's corner nav: a small card pinned to the workspace's bottom-right
// (the image-editor minimap idiom), owning Back/Next so the panels no longer
// carry their own sticky action bars. `children` is an optional extra control
// block above the nav row - the CRAFT deck stacks its world switcher there.
export function FlowNavDock({
  onBack,
  onNext,
  nextLabel,
  children,
}: {
  // Omitted on the first panel - the Back button renders disabled.
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flow-nav-dock" data-component="Dock:FlowNav">
      {children}
      <div className="flow-nav-dock-row">
        <button
          className="button button-secondary"
          type="button"
          onClick={onBack}
          disabled={!onBack}
        >
          Back
        </button>
        <button className="button button-primary" type="button" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
