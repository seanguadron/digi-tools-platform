---
gate: design
date: 2026-08-18
surface: the Card Studio relations strip (/studio/cards, commit 9a63b31) — .card-relations* in globals.css, the relations JSX and jumpTo in card-studio.tsx
result: FAIL -> all four findings fixed, re-verified in the browser
findings: 1 High, 1 Medium, 2 Low — all applied
---

# Design audit: the Card Studio relations strip

Scope: everything `9a63b31` added — `.card-relations*` in
`src/app/globals.css`, and the `entryByKey`/`jumpTo` logic plus the relations
JSX in `src/components/card-studio.tsx`. Colour figures below are computed
(OKLCH to linear sRGB to WCAG contrast) against the real tokens, not estimated.

## Applied

1. **High — the jump threw keyboard focus away.** `jumpTo` set the active key,
   which unmounts the very chip the user just activated, then only called
   `scrollIntoView`. With the focused element gone, the browser drops focus to
   `<body>`, so a keyboard user lost their place entirely and the next Tab
   restarted at the top of the page. The codebase already had the right
   pattern for this exact interaction in `use-flow-navigation.ts`, which
   scrolls AND focuses. Both call sites now share `src/lib/reveal-element.ts`,
   so the scroll-and-focus pair cannot drift apart again. Browser-verified:
   activating a chip now leaves focus on the destination row's
   `.card-art-row-main` button, inside the row that opened.

2. **Medium — the "live" marker was a wordless dot.** A bare 6px circle with
   only an `aria-label` told sighted users nothing, while the row-level status
   two elements away in the same file has always shown "live" as visible
   text. Colour was carrying the meaning alone. The marker is now a small
   text pill reading "live", styled as a one-tier-smaller sibling of
   `.card-art-status`, with colour reinforcing rather than replacing it.

3. **Low — the group label was only visually associated.** "Morphs into" sat
   next to its chips with no programmatic link, so browsing by control gave a
   bare list of card names with no idea what related them. Each group is now
   `role="group"` with `aria-labelledby` pointing at its label's id.
   Browser-verified: the reference resolves.

4. **Low — the jump scroll ignored reduced motion.** `behavior: "smooth"` ran
   unconditionally. `revealElement` now picks `"auto"` under
   `prefers-reduced-motion`, which fixes the identical pre-existing gap in
   `use-flow-navigation.ts` at the same time.

## Passed

| Check | Evidence |
|---|---|
| Colour tokens | Only `var()`/`color-mix()` over real tokens; zero raw hex |
| Contrast (computed) | Live marker vs chip 3.74:1 light / 11.48:1 dark; label 5.16:1 / 11.79:1; chip text 18.63/8.37 light, 15.93/7.23 dark — all clear AA |
| Marker-vs-text tokens | `--brand-cyan` for fills, `--brand-cyan-text` for text — the split DESIGN_DIRECTION prescribes |
| Keyboard reachability | Real `<button>` chips, siblings of the row toggle, no nested-button HTML |
| Accessible names | Decorative `alt=""` correctly excluded; names read e.g. "1 · Cartographer live" |
| Focus ring | Inherits the sitewide `:focus-visible` rule, unoverridden |
| Motion (CSS) | No transitions on `.card-relations-*`; hover is an instant snap |
| Density | Up to 14 wrapping chips on the busiest archetype; `flex-wrap` handles it, matches the existing variant strip |
| Voice | "Morphs into" / "Morph 2 of 4 · SCP" — terse, reuses the deck's own vocabulary |
| Anti-goals | No gradients beyond the existing cyan `color-mix`, no glassmorphism, no fake metrics |

Micro-label type sizes (0.62rem) and the pill radius were judged PASS on
precedent: both idioms are already established dozens of times in
`globals.css` and the previous design gate declined to re-flag them.

## Notes

- Headless caveat worth recording: `.focus()` on a `tabindex="-1"` heading
  does not move `document.activeElement` in this browser, because the window
  itself is not focused. The relations fix verified anyway because its target
  is a real `<button>`. Do not read a body-focus result on a non-native
  focusable here as an app bug.
- Raised for the owner, not applied: DESIGN_DIRECTION states no convention
  for status indicators, and this file now holds two shapes for one concept —
  a text pill and (previously) a wordless dot. A line such as "status is
  always paired with a short visible text label; colour reinforces, never
  replaces it" would stop the next indicator drifting a third way.
  (proposed amendment, needs the owner's consent)
