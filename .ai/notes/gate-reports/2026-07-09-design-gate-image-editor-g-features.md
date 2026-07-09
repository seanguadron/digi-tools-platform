---
gate: design
date: 2026-07-09
surface: Image Editor — second 12-feature batch "G-features"; new visual surfaces = History panel, Select ▾ menu, grid overlay + guides, Levels/Posterize/Threshold sliders, per-layer Lock/Clip
result: pass (after fixes)
findings: 3 Medium (fixed), 5 Low (4 fixed, 1 deferred with rationale)
---

# Design gate — Image Editor G-features batch

The `design-gate` agent ran fully against `docs/DESIGN_DIRECTION.md`. Result was
0 High / 3 Medium / 5 Low; all Mediums and four Lows fixed.

## Medium (all fixed)

- **History-step font 0.68rem < 0.75rem caption floor** (interactive list item).
  Raised to 0.75rem.
- **`.is-future` contrast** (opacity stacked on `--muted-foreground`). Dropped the
  opacity — token alone is the AA-safe de-emphasis. (Same finding as Integration.)
- **Guides were add-at-center / clear-all only, not draggable** — fell short of the
  familiar Photoshop guide interaction the batch was scoped to. **Fixed by
  implementing it properly:** guides are now grabbable with the Move tool (5px
  hit-test), drag to reposition, drag off-canvas to remove; a menu hint documents
  it. Browser-verified via pixel assertions: add → renders at doc centre, drag →
  line repositions (old column clears), drag-off → guide removed.

## Low (4 fixed, 1 deferred)

- **Fixed:** grid stroke used a hardcoded `rgba(128,128,128,0.4)` literal → now
  falls back to the resolved `--border`/`cyan` token, no arbitrary gray.
- **Fixed:** Lock/Clip state now shows as compact `L`/`C` badges on every layer
  row (not only the active-layer block).
- **Fixed:** the three Levels sliders grouped under a `Levels` panel-label to keep
  the now-10-slider Adjust dialog scannable.
- **Fixed:** Posterize label reads "off" for values ≤ 1 (matching the `>= 2`
  effect gate), not just 0.
- **Deferred (motion):** History steps (and every other interactive surface in
  this tool) transition `background-color`/`border-color` rather than
  DESIGN_DIRECTION's literal "opacity/transform only". This is a pre-existing,
  repo-wide idiom (`.image-editor-tool` etc.), not new drift. Timing (150ms) and
  `prefers-reduced-motion` are correct. Candidate for a DESIGN_DIRECTION amendment
  (permit color micro-transitions for hover/selected affordances) — needs owner
  consent; logged to SESSIONS.

## Bug found while verifying (fixed)

Verifying the guide overlay surfaced a real pre-existing defect in G11/G12: the
overlay canvas only repainted on `doc`/`view` changes, so adding a guide or
toggling the grid showed nothing until the next pan/zoom. **Fixed** by (a) reading
`grid`/`guides` from refs inside the RAF-deferred `drawOverlay` (matching the
existing `doc`/`view`/`tool` ref pattern that dodges stale closures) and (b) an
explicit repaint effect on `[grid, guides]`. Confirmed: a guide now appears the
instant it's added and tracks the drag live.
