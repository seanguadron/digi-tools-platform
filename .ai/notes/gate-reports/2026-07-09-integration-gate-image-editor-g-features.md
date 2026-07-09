---
gate: integration
date: 2026-07-09
surface: Image Editor — second 12-feature batch "G-features" (add/subtract selection, Select menu, stroke selection, clone stamp, smudge, transparency lock, clipping mask, levels, posterize+threshold, history panel, grid+snap, guides+snap)
result: pass (after fixes)
findings: 1 High (fixed), 2 Medium (fixed); process ledger entry (this file)
---

# Integration gate — Image Editor G-features batch

The `integration-gate` agent ran fully (no spend limits) against the
uncommitted diff (`git diff HEAD -- src/`, 14 files + new
`image-editor-history.tsx`). Standards deterministic halves
(`check:standards`, `check:security`) green; `typecheck`/`lint`/`build` green.

## Findings and resolutions

- **[High — correctness] Select ▾ → "Stroke edge" bypassed the transparency
  lock.** The new stroke path committed directly, skipping the `clipToAlpha`
  clamp that `fillActive` and the canvas paint paths apply — so stroking a
  selection edge on a transparency-locked layer painted outside the layer's
  existing pixels, silently defeating the new lock feature.
  **Fixed:** extracted a single `commitPaintedBitmap(doc, layerId, working,
  clipToSelection?)` helper into `src/lib/image-editor/document.ts` — the choke
  point every paint/fill/stroke now routes through. It applies the selection
  clip (skippable for the edge stroke, which must straddle the boundary) and the
  transparency-lock clamp. `fillActive`, the canvas `commitPaintedLayer`, and the
  stroke branch all delegate to it, so the two trust rules can't be forgotten at
  a call site.
- **[Medium — composability] Duplicated paint-commit logic (3 copies).**
  Resolved by the same `commitPaintedBitmap` extraction above.
- **[Medium — WCAG AA] `.image-editor-history-step.is-future` stacked
  `opacity: 0.72` on `--muted-foreground`,** dropping ~11px text below 4.5:1 in
  both themes. **Fixed:** dropped the opacity; `--muted-foreground` alone is the
  AA-safe de-emphasis. (Also raised the step font from 0.68rem to the 0.75rem
  caption floor per the Design gate.)
- **[Note, not actioned] Tripled dropdown-menu scaffolding** (Select/Canvas/View)
  is real duplication but the Escape/refocus/backdrop behaviour is already
  centralized and identical across the three; a shared component is a reasonable
  follow-up, not a blocker. Left as-is to keep the batch surgical.

## Confirmations

- **§2.3 trust boundary.** `project-io.ts` gained only `locked`/`clipped`
  (booleans), deserialized as `layer.locked === true` — shape-checked, not cast.
  No new inbound path (Security gate corroborates).
- Conventions: new `image-editor-history.tsx` is kebab-case + `"use client"`;
  `use-image-editor-history.ts` unchanged name. Catalog/registry untouched
  (no new tool id beyond the clone/smudge already present).
