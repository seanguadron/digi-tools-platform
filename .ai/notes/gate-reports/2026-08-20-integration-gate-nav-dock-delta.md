---
gate: integration
date: 2026-08-20
surface: "commit bb4ac0e - the movable dock's design-gate remediation and the .flow-panel clearance fix"
result: FAIL -> fixed, clamp verified in-browser
findings: 3 (1 behavioural, 1 CSS regression, 1 doc gap)
---

# Integration gate: the nav-dock fix delta (2026-08-20)

Run because `gate:sweep` flagged one file since the last integration report,
and because the commit contained a pattern worth a second opinion rather
than my own say-so: a child component writing `data-dock-corner` onto its
`offsetParent` so sibling CSS can react. The expected result was PASS. It
was not, and both substantive findings were real.

## Findings and outcomes

| Finding | Outcome |
|---|---|
| **The drag clamp did not clamp.** The new bound derived the dock's origin from its *live* rect, which already carries the transform being computed — self-referential, so once the pointer passed the bound the clamp leaked outward every call. The gate simulated it: a sustained drag rested 71px outside, a fling ~260px. I reproduced it independently at 308px on a fling, then verified the fix in a real browser: a 3000px fling now leaves the dock **0px outside on both axes** and it rests inside. | **Fixed**: the untransformed box is captured once in `beginDrag` and the clamp measures against that. This also directly contradicted the previous commit's own message, which claimed dragging was clamped. |
| **The ≤760px block re-broke the clearance.** `.flow-panel { padding: 16px 12px }` in the mobile-preview media block is equal specificity to, and later than, the base rule whose `padding-bottom` had just been fixed — the identical shorthand-beats-longhand trap, one level down, still live for the supported mobile-preview mode. | **Fixed**: the longhand restated inside that block, with a comment naming the trap. |
| **ARCHITECTURE.md didn't describe the new mechanism.** It documented the dock as movable with a persisted corner but not the `data-dock-corner` publishing that `.flow-panel` and `.proof-scenario-status` now depend on. | **Fixed**: §1 now states the mechanism and its two conditions — `FlowNavDock` must stay a direct child of `.flow-workspace` (anything positioned between them silently re-points `offsetParent` and the selectors go dark), and the attribute is CSS-only; a JS consumer gets a prop, not a DOM read-back. |

The gate also asked for a comment where the `[data-dock-corner^="top"]`
rules sit earlier in the file than the block they override and win on
specificity alone — added, since flattening those selectors would silently
break them and this file has now shipped that footgun twice.

## The judgment call, recorded

The offsetParent write is **acceptable as shipped**, on the gate's reasoning:
`offsetParent === .flow-workspace` was already load-bearing inside this
component (the snap-to-quadrant math relied on it before this change), it
keeps both deck roots untouched, and `app-shell.tsx` sets a comparable
ambient attribute on the document element. It stops being acceptable when
(1) a consumer needs the corner in JS, (2) anything positioned is inserted
between the dock and the workspace, or (3) a third unrelated reader appears.
Those conditions are now in ARCHITECTURE.md rather than in a gate report
nobody re-reads.

## PASSes

Registry/catalog/trust-boundary rules are all N/A for this delta. Gate
ledger shape, gov:node graph, kebab-case, no new files or hooks,
`"use client"` correctness, and the base `.flow-panel` reordering all pass.
Accessibility intent verified: 24px handle, full-strength grab pill,
`aria-roledescription`, keyboard path intact.

Battery after fixes: typecheck / lint / test 150 / data:validate /
check:standards / check:security all green.
