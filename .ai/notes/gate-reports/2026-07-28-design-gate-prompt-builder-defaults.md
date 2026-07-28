---
gate: design
date: 2026-07-28
surface: Prompt Builder — Write/Cards panel merge, use-default checkbox row, authored audience lines
result: PASS
findings: 1 Low (tap target; applied) + 2 observations
---

# Design gate — Prompt Builder defaults rework

Audited the merged Context/Target panels, the new checkbox row, the copy
(labels, default lines, 25 authored `defaultAudience` one-liners), and the
output-dock collapse behavior against docs/DESIGN_DIRECTION.md + PRODUCT.md.

## Result: PASS (1 Low, applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Low | `.workbench-default-check` had no min-height/padding, so the 14px checkbox bounded the pointer target under the WCAG 2.2 §2.5.8 24×24 CSS-px floor. Pre-existing in `.image-editor-check` and `.ve-toggle` too — this change added a third instance. | Applied here: `min-height: 24px` on `.workbench-default-check`. The two pre-existing sibling classes are out of this change's scope — spun off as a task chip (2026-07-28). |

## Verified clean

- Write/Cards subnav + "Cards come next" teasers fully removed (markup, CSS,
  rendered HTML, zero grep hits).
- Merged panels reuse the exact Action-panel shape and the shared
  `PromptCardWorkbench`, so workbench alignment is identical by construction.
- Checkbox `accent-color: var(--brand-cyan)` matches the four sitewide
  toggle/slider precedents; label typography sits in the established (still
  uncodified) micro-label tier; flex row wraps safely at narrow widths.
- Copy: field/checkbox labels plain and calm; all 25 authored
  `defaultAudience` lines pass the AI-writing screen (rule 4) and the voice
  bar — concrete, specific, no hedge-hype vocabulary.
- docs/DESIGN_DIRECTION.md 249-263 (updated this session) traces
  clause-by-clause to matching code paths; doc and implementation agree.
- Output-dock collapse writers all match doc intent after deleting the
  archetype-apply collapse; phone default, chevron, proof-lab overlay, and
  completion auto-expand all preserved.
- A11y: distinct accessible names ("Use default context" vs "… audience");
  label associations survive the `required` drop with nothing stale; global
  `:focus-visible` ring applies in both themes.

## Observations (on record, no change)

- Fresh-draft C/T announcing "complete" is intentional and doc-specified —
  "complete" now means "will produce reasonable output", not "user typed".
- The 0.58–0.72rem micro-label tier remains an unwritten convention the
  pending amendment should codify (already in the queue).
