---
gate: design
date: 2026-07-08
surface: Image Editor UI — toolbar, canvas stage, layers panel, New + Filters dialogs, color picker, welcome section (image-editor-*.tsx, globals.css "Image Editor" block, page.tsx)
result: pass-after-fixes
findings: 1 High + 1 Medium + 2 Low — all fixed this session
---

# Design gate — Image Editor

The `design-gate` judgment agent ran fully (no limits) against
`docs/DESIGN_DIRECTION.md` and returned 4 grounded findings. All are **fixed**.

**Finding 1 — High (fixed): global shortcuts leaked behind open modals.** The
window `keydown` handler guarded only on `inField`, and neither dialog moved
focus in on open, so Ctrl+A/Z/Delete + single-letter tool shortcuts fired against
the hidden canvas while New/Adjust was open. Fix (image-editor.tsx +
image-editor-new-dialog.tsx + image-editor-filters.tsx): the global handler now
bails when `newDialogOpen || filtersOpen`, and each dialog autofocuses its first
control on open (mirroring `architect-command-palette.tsx`). Verified in-browser:
with the New dialog open, focus is the width input and an `e` keypress does not
switch tools.

**Finding 2 — Medium (fixed): no true single-column collapse below 900px.**
DESIGN_DIRECTION:61-62 requires the work area to become one column under 900px;
the rules narrowed to 3 columns then *hid* the layers rail + option panels. Fix
(globals.css): a `max-width: 900px` rule now stacks toolbar → canvas → layers
(`grid-template-columns: 1fr; grid-template-rows: auto minmax(360px,60vh) auto`;
`height:auto; overflow:visible`), matching the Architect Wizard's pattern —
panels reflow, nothing is hidden.

**Finding 3 — Low (fixed): blend-mode select + hue slider had sr-only labels.**
DESIGN_DIRECTION:70 ("inputs use visible labels"). Fix: both now show a visible
`.image-editor-field-caption` micro-label (image-editor-layers.tsx,
image-editor-color-picker.tsx, globals.css).

**Finding 4 — Low (fixed): New-canvas "Create" disabled silently past the size
ceiling.** Fix: an inline hint states the 1–12,000px / 40M-px limit when the size
is invalid (image-editor-new-dialog.tsx).

Agent confirmed sound (for the record): the marching-ants animation has a correct
`prefers-reduced-motion` still-fallback; raw hex is confined to user-selected
paint content + canvas-fed token fallbacks (documented exceptions); 12px panel
radius, `.button` color transitions, continuous raster sliders, and the modal
backdrop all match established sitewide/precedent patterns; no anti-goals (no AI
gradients / glassmorphism / oversized radii / cloud-sync language); the welcome
section reuses the existing `home-feature`/`home-spec` structure.

**Proposed DESIGN_DIRECTION amendments (flags only, need owner consent):** (a) the
"motion: opacity or transform only" wording conflicts with the pre-existing
sitewide `.button` border/background transitions — loosen or scope it to the
Prompt Builder card system; (b) icon-language consistency — the toolbar uses SVG
line icons while the layers panel uses Unicode glyphs (no DESIGN_DIRECTION line
covers it today). Recorded in SESSIONS.
