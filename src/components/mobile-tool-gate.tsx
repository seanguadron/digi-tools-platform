"use client";

import Link from "next/link";
import type { ToolDescriptor } from "@/lib/tool-registry";

// The mobile gate (docs/ARCHITECTURE.md §2): below 768px the shell hides a
// gated tool's stage content and portaled chrome and shows this explainer
// instead. Both branches render into the stage on every gated route;
// visibility is decided entirely by CSS (.is-mobile-gated / .is-mobile-preview
// under the 768px media query), so desktop renders are byte-identical with or
// without the gate and hydration never mismatches.
export function MobileToolGate({
  tool,
  overridden,
  onOverride,
}: {
  tool: ToolDescriptor;
  overridden: boolean;
  onOverride: () => void;
}) {
  if (overridden) {
    return (
      <div className="mobile-preview-chip" role="status">
        <span className="status-dot" aria-hidden="true" />
        <span>
          Squeeze-in preview — {tool.shortName} is built for tablet and desktop
          widths.
        </span>
      </div>
    );
  }

  return (
    <section className="mobile-tool-gate" aria-labelledby="mobile-gate-title">
      <span className="tool-kicker">Desktop cockpit</span>
      <h1 id="mobile-gate-title">{tool.name}</h1>
      <p className="mobile-gate-tagline">{tool.tagline}</p>
      {tool.mobileGateNotes ? (
        <ul className="mobile-gate-notes">
          {tool.mobileGateNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <p className="mobile-gate-advice">
        This cockpit needs room — card decks, drag interactions, and side docks
        don&apos;t fit a phone screen. Open it on a tablet or desktop for the
        real thing.
      </p>
      <div className="mobile-gate-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onOverride}
        >
          Preview anyway
        </button>
        <Link className="button button-quiet" href="/">
          Back to Welcome
        </Link>
      </div>
    </section>
  );
}
