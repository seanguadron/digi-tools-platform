---
gate: design
date: 2026-08-02
surface: PICTURE Deck (/tools/picture-deck + home section + registry strings) against DESIGN_DIRECTION incl. its new PICTURE Deck subsection
result: FAIL -> fixes applied in fa577a4, re-verified with computed styles
findings: 2 High (fixed), 2 Medium (1 fixed, 1 resolved by redesign), 2 Low (1 fixed, 1 standing amendment)
---

# Design audit: PICTURE Deck

The reused CRAFT chrome was not re-litigated (documented coupling). Findings
confined to the new Execution-panel tail fieldset and supporting CSS/copy:

1. **High — four undefined CSS tokens** (`--surface`, `--surface-raised`,
   `--text`, `--text-muted`) silently resolved to transparent/inherited,
   making the "quiet chrome" micro-labels as loud as body text. FIXED:
   replaced with the real tokens (`--card`, `--muted`, `--foreground`,
   `--muted-foreground`). Verified via getComputedStyle.
2. **High — the Exclude (--no) input was a bare unstyled `<input>`**
   (browser UA defaults, white box in dark theme). FIXED: joined the
   `.field` input chrome (border, 9px radius, background fill, 44px
   min-height, placeholder color, cyan focus ring). Verified computed.
3. **Medium — range inputs under the 24px target floor.** FIXED with the
   sitewide WCAG 2.5.8 `min-height: 24px` convention. Verified computed.
4. **Medium — disabled-state legibility risk**: the naive whole-body 0.45
   dim would have put muted labels at 2.19:1 light / 2.47:1 dark
   (measured with the OKLCH->sRGB WCAG math; numbers match the agent's).
   RESOLVED BY REDESIGN rather than the naive alias: only the CONTROLS dim
   to 0.45 (inactive, WCAG-exempt); labels keep full-opacity
   --muted-foreground at a measured 8.4:1 light / 7.2:1 dark, so the
   feature's shape stays learnable — the subsection's stated intent.
5. **Low — inert `.picture-deck-page`/`.picture-deck-layout` hooks.**
   FIXED: dropped from the JSX.
6. **Low — 0.68rem micro-labels** under the 0.75rem caption floor: a
   sitewide pre-existing pattern already in the pending "micro-label tier"
   amendment; reinforced, not fixed here.

PASSES recorded: roving-radiogroup keyboard contract on the aspect tabs,
focus visibility, Geist Mono scoping, one-line dock rendering, motion band
(160ms opacity + reduced-motion blanket), guide/tail copy voice, home
section parity with true counts (100/18), selector hygiene.
