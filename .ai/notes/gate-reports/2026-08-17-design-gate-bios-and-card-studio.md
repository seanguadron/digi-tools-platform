---
gate: design
date: 2026-08-17
surface: card bios in the CRAFT inspection panels + the Card Studio (/studio/cards), audited at 32e0a04 + working tree
result: FAIL -> fixes applied, re-verified
findings: 2 Medium, 2 Low (all fixed) + 5 prior fixes verified
---

# Design audit: card bios and the Card Studio

## Prior fixes, verified rather than re-reported

All five findings from the run against the previous commit were confirmed
still correct: `--font-geist-mono` → `--font-mono` (zero hits remain; the
token is real, generated at `layout.tsx:13-15`), the thirds guides no longer
use `mix-blend-mode` anywhere, the cropper is a real dialog (trap, Escape,
restore, `aria-labelledby`, arrow-key pan — and `role="application"` on the
pan surface matches the image and vector editors' existing precedent),
variant chips carry `aria-pressed`, and the 24px floor plus `accent-color`
cover every checkbox on the surface.

## Applied

1. **Medium — the "not started" tab label failed AA.** `opacity: 0.72` stacked
   on `--muted-foreground`, a token already tuned to the contrast floor,
   computing to ~3.99:1 light / ~4.34:1 dark at 9.6px. The same failure shape
   DESIGN_DIRECTION's "accent colors mark, they do not spell" section exists
   to prevent. Opacity dropped; size, weight and uppercase carry the
   de-emphasis, and the dashed tab border signals the state independently.
2. **Medium — ARIA Tabs without the keyboard contract.** The facet strip
   announced `role="tablist"`/`role="tab"` but had no roving `tabIndex`, no
   arrow keys, and no `tabpanel` wiring — priming the APG model and then not
   honouring it. Replaced with the repo's own `EditorTabs` primitive, which
   ARCHITECTURE already names for this and which carries the full contract.
   `EditorTabDef.label` widened to `ReactNode` and gained an optional
   `className` so the facet tabs could reuse it rather than fork it.
3. **Low — the panel budget was verified against today's content, not the
   schema's ceiling.** Re-measured in the browser at the real maximum (6 goals
   at 55 characters, the schema's `maxItems`, plus a 240-character bio, the
   schema's `maxLength`): **479px against the 560 budget, 81px of headroom,
   every child inside the content box.** The gate's own estimate was
   85-135px; the measured figure is 81px.
4. **Low — `previewAnchor` undersold its payload.** Retyped as
   `ReturnType<typeof getFloatingPanelPosition>` in all three panels so the
   declared shape includes the `maxHeight` that is actually rendered.

## Confirmed clean

The bio never reaches the generated prompt (traced through both `<code>`
compositions — only grade instructions, goals, roles and format feed it).
PICTURE stays bio-free with no empty ruled section, because it passes no
`cardBio` and `CardBio` returns null. Color-token discipline is right
throughout: `--brand-cyan` for borders and fills, `--brand-cyan-text` for
text. New inputs reuse the `.field` chrome rather than inventing styling.

## Proposed amendment (owner consent)

DESIGN_DIRECTION specifies the ability-inspection panel but has no vocabulary
for the character bio — italic, muted, ruled off, spanning both grid columns,
capped at 240 characters, authored per art pack, and deliberately excluded
from the generated prompt. The implementation is consistent; it just is not
written down.

Separately: `.floating-card-bio` sits at 0.7rem, below the stated 0.75rem
caption floor — but so do several pre-existing elements in the same panel.
That belongs to the already-queued "micro-label tier" amendment rather than
being a fresh issue.
