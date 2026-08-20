---
gate: design
date: 2026-08-19
surface: "the draggable corner-snap nav dock (flow-nav-dock.tsx + .flow-nav-dock* CSS), both decks"
result: FAIL -> fixed, verified in-browser
findings: 2 high / 3 medium / 1 low
---

# Design gate: the movable nav dock (2026-08-19)

The gate owed since the dock shipped. Two earlier attempts died on a
provider spend limit before reporting; this third run completed, and every
finding is applied and verified against a live server at 1440x900.

## Findings and outcomes

| Sev | Finding | Outcome |
|---|---|---|
| High | `.flow-nav-dock-handle` was `min-height: 14px` — the sole grab affordance, under the 24px target floor. The repo had already fixed this exact defect four times, each with a `/* WCAG 2.5.8 */` comment; the new component repeated the same 14px. | Fixed: 24px with the same comment. Verified `handleH: 24`. Costs ~10px of dock height, nothing of width. |
| High | A top-parked dock covered the panel's first heading, on every panel and every visit (the corner persists). `--dock-clearance` padded only the bottom. | Fixed: the dock now publishes its corner onto `.flow-workspace` (`data-dock-corner`), and the panel reserves clearance on the side the dock actually occupies. Verified: top corner → `padding-top: 230px`, `padding-bottom: 34px`, and the step panel's card starts at y=340 against a dock ending at y=302. |
| Medium | `.proof-scenario-status` anchors to the identical `top:12/right:12` as a top-right dock, at a higher z-index — it would sit on Back/Next whenever a Proof Lab scenario was open. | Fixed: when the dock holds top-right, the proof card takes the opposite corner. Verified by probe: `left:12px` and no overlap in that state, untouched in the others. |
| Medium | The grab pill mixed `--muted-foreground` at 45% — the hardest dilution of that token anywhere in the stylesheet, plausibly under the 3:1 non-text floor. | Fixed: full token strength. **Measured through a canvas** (this browser reports `lab()`, so a naive parse of the computed string gives nonsense): **8.36:1 light, 7.19:1 dark**. |
| Medium | `role="button"` with no Enter/Space activation — the behaviour is drag-and-drop, so the role promised a contract that does not exist. | Fixed: `aria-roledescription="drag handle"` alongside the existing role and label, per the WAI-ARIA APG drag-and-drop pattern. |
| Low | `moveDrag` applied an unclamped transform, so mid-drag the dock could be pushed over the toolbar or header before snapping back. | Fixed: the drag clamps to the workspace bounds. |

## Found while verifying — a real pre-existing bug

`--dock-clearance` **had never worked at all.** A later `.flow-panel` rule
sets the `padding` *shorthand*, which silently reset the `padding-bottom`
declared earlier in the file at equal specificity. The panel had been
reserving 34px, not 230px, since the clearance shipped — so the bottom
controls have been sitting under the dock this whole time. Moving the
declaration to follow the shorthand fixed it (`paddingBottom: 230px`
confirmed live), and the CSS now carries a comment saying why the order
matters.

A second consequence surfaced only once the clearance became real: the
guide panel centres its column, and centred content that outgrows its box
overflows **both** ways — so with top clearance applied the guide pushed its
own title up under the dock. Pinned to `start` while a top corner is held.

## PASSes worth recording

Motion (200ms transform-only settle inside the direction's band, genuinely
neutralized by the reduced-motion block because the JS re-enables the CSS
transition rather than interpolating by hand); z-index 6 against the
floating card panel at 70 and every dialog at 60+, all `position: fixed` and
correctly above; the sitewide `:focus-visible` ring reaches the handle
unclipped; the card idiom matches `.image-editor-minimap` as its comment
claims. The gate also ruled out overlap with the step strip and the
archetype toolbar — both live outside the dock's `offsetParent`.

## Amendment (owner consent)

DESIGN_DIRECTION has no entry for the dock's drag/corner-snap/keyboard
interaction. The gate suggests folding it into the existing pending
amendment (f), which already covers documenting the world-switch control,
rather than opening a second flag.

Battery after fixes: typecheck / lint / test 150 / data:validate /
check:standards / check:security all green.
