---
gate: design
date: 2026-08-19
surface: "UI consolidation pass (top bar, deck subbars, corner dock, panels, archetype toolbars, cards, hover panel) - commit 013843c"
result: FAIL -> fixed same session (3 High + 2 Medium applied; 1 Low queued as amendment)
findings: 3 High, 2 Medium, 1 Low
---

# Design gate - UI consolidation

## Findings and dispositions

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | High | The save-status chip was removed from both deck subbars entirely, against DESIGN_DIRECTION's "quiet local-save status beside the builder title; storage failure stated plainly." | **Fixed as failure-only display**: both headers re-take saveStatus/lastSavedAt and render ToolSaveStateChip only when `isSaveStateUnavailable` - the happy path stays silent (the owner's explicit declutter request), failures surface plainly. DESIGN_DIRECTION 166-167 amended to record the owner's call (2026-08-19). |
| 2 | High | Subbar overflow risk at 768-1080px: strip and actions had no shrink/scroll path above the phone tier, and `Continue: Target audience` inflated the bar. | **Fixed**: new ≤1080px tier lets `.flow-step-strip` and `.prompt-flow-header-actions` scroll internally with hidden scrollbars and tightens bar gap; `continueLabel` shortened to "Continue" (the step strip already names the position). |
| 3 | High | The corner dock floats over panel bottoms - Context/Action/Target textareas and their resize handles could sit beneath it (also an SC 2.4.11 focus-obscured risk). | **Fixed**: `.flow-panel` reserves bottom clearance via `--dock-clearance` set per deck (`.is-craft-flow` 196px for the dock+world switch, `.is-picture-flow` 92px), so scrolling to a panel's end clears the dock. |
| 4 | Medium | "Review output" cannot fit the dock's 192px Next track (`white-space: nowrap`). | **Fixed**: dock label shortened to "Review" in both decks (the subbar's wide Continue button keeps the full phrase). |
| 5 | Medium | `.brand.is-active` was applied in JSX but no CSS existed - Home had no visual current-page state. | **Fixed**: `.brand.is-active` tints the wordmark `--brand-cyan-text` and thickens the mark's plate stroke to full cyan - not color alone. |
| 6 | Low | `.flow-strip-*` transitions use color/background/border-color against the Motion section's "opacity or transform only" - matching several pre-existing, previously-reviewed controls. | **Queued as amendment** (owner consent): permit short color-family transitions on compact controls, since the letter of the rule already diverges from accepted practice and the sitewide reduced-motion override neutralizes them all. |

## Passing checks

Brand mark tokens (gradient/glow removed - moves toward the anti-goals);
tab icons on the image-editor icon system; Alpha chip on the .featured-tag
magenta idiom with AA-safe text token; step strip on the .editor-dialog-seg
idiom with the correct cyan fill-ink token; sr-only panel headings with
FieldHeading as the one visible label; archetype toolbar copy trim per the
"instructions live in accessible names" rule; card geometry (fixed 152/166
tracks, 5:7, two-line clamp, grain); hover panel art-first restyle with the
placement clamp retained.

Verification: fixes typecheck/lint/149-test green; the agent's overflow and
occlusion findings were computed from the CSS box model (no compositing
available) - the clearance and squeeze tiers make them impossible by
construction rather than re-measured.
