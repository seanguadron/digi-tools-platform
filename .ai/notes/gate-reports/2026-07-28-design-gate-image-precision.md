---
gate: design
date: 2026-07-28
surface: Image Editor — precision pass (I1): crop overlay + panel, Image/Canvas size dialogs
result: FAIL -> PASS
findings: 2 Medium + 3 Low (applied, except one tracked as shared backlog)
---

# Design gate — Image Editor precision pass (I1)

Audited against docs/DESIGN_DIRECTION.md; overlay contrast computed
numerically (worst-case white imagery under the darkened chip ≈ 9.9:1).

## Result: FAIL → PASS

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | `.image-editor-select` name collision (same defect the integration gate rated High). | Applied — renamed `.image-editor-unit-select`. |
| 2 | Medium | The crop workflow's numeric/aspect controls only rendered once a pointer drag seeded `cropRect` — no keyboard-only entry to the milestone's own headline feature. | Applied: "Set crop region" button in the empty state seeds a centered 80% region; hint copy updated. Verified live. |
| 3 | Low | Crop HUD label hardcoded `system-ui` instead of the app face. | Applied: font resolved from the stage's computed style (the same pattern the cyan token read uses two lines above). |
| 4 | Low | Anchor-grid 4px gap vs the sitewide focus ring's 5px extension — a focused cell's ring could tuck under its neighbor. | Applied: gap 6px with a comment naming the constraint. |
| 5 | Low | `role="radiogroup"` on plain buttons without roving tabindex — a promise to AT the keyboard model doesn't keep. Systemic: the identical shape ships in prompt-flow-panels (×2) before this milestone added two more. | Deliberately NOT patched in isolation (a third divergent one-off) — spun off as a task chip for one shared roving-tabindex helper across all four call sites. |

## Passed outright

Cyan border+text job split on active states; crop overlay follows the
pro-editor recipe (darken + thirds + handles + readout) with the raw-HUD
exemption precedent; label chip ≥9.9:1 worst-case; typography inside the
established micro-tier; tap targets ≥24px; copy voice plain and specific;
dialog structure byte-parallel to the existing pattern (backdrop, Esc,
autoFocus, quiet/primary pair); focus-visible inherited everywhere; all new
chrome fully tokenized in both themes.

Noted for the sessions log (owner consent): a short DESIGN_DIRECTION
carve-out for canvas-drawn tool chrome over arbitrary imagery, so audits
stop re-deriving the exemption; dialogs' missing focus trap is pre-existing
and backlogged, not new here.
