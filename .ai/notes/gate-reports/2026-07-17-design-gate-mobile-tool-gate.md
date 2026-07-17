---
gate: design
date: 2026-07-17
surface: Mobile tool gate card + squeeze-in preview chip (phone widths, below 768px)
result: FAIL → PASS (all findings fixed)
findings: 1 High, 1 Medium, 2 Low — all applied
---

# Design gate — mobile tool gate

Audited `src/components/mobile-tool-gate.tsx`, the "Mobile tool gate" section
of `src/app/globals.css`, and the registry copy against
`docs/DESIGN_DIRECTION.md`.

PASS on first read: color tokens + cyan restraint (the chip's 7% mix is under
the 10% ceiling), typography (h1 1.5rem/600 = the documented Section-title
rung; body sizes inside the 0.875–1rem band), density, card vocabulary
(14px radius, 1px border, no shadow), button vocabulary (shared `.button`
classes, only a flex-basis addition), motion (none added), voice, the
anti-goals list, theme parity, and focus/keyboard handling.

## Findings and fixes

| # | Sev | Finding | Fix applied |
|---|---|---|---|
| 1 | High | The gate's own actions could be unreachable. `html:has(.page-stage.is-fluid) { overflow: hidden }` (globals.css:5343, pre-existing, written for the fixed-height desktop cockpit) is unscoped, and all three gated tools are `fullBleed`. On a short screen the card outgrew the viewport with no scroll. | The gate section now restores `overflow: visible` on html/body for both mobile states. **Reproduced and fixed empirically**: at 375×380 the actions sat at y=441–567 with a 380px viewport and zero scroll; now both are fully visible after scrolling, with no horizontal scroll. |
| 2 | Medium | The phone nav leaned on horizontal scroll (edge-fade mask) instead of reclaiming room, in tension with DESIGN_DIRECTION §Layout ("Navigation remains usable without horizontal page scrolling"). | Adopted the ≤640px precedent at this tier: the brand wordmark is hidden ≤767.98px (the mark still links home). Five tabs still exceed a 375px row after that, so the fade stays as an honest affordance for the residual overflow. Note the direction's line says *page* scrolling: the page itself never scrolls sideways (verified `scrollWidth == innerWidth` at every width), and the context bar names the active surface independently. |
| 3 | Low | Two "phone" thresholds coexisted: the gate at 767.98px, the Prompt Builder dock default at 760px — disagreeing in a 7px band. (The integration gate flagged this independently.) | Collapsed to ONE source of truth: `PHONE_MEDIA_QUERY` in `tool-registry.ts`, byte-identical to the CSS media query and consumed by the dock default. |
| 4 | Low | `.mobile-gate-notes` is a grid parent with no `list-style` reset — Blink/WebKit suppress the marker box, Firefox doesn't, and it ignored the app's own `.home-feature-points` precedent. | `list-style: none` plus the same cyan-dot `::before` marker as the Welcome page's feature bullets. |

## Verification

375×380 (the failing case), 375×812, 800×1000, 1280×800: gate → override →
tool, list markers, wordmark, dock default, scroll, and no horizontal scroll
all confirmed via DOM measurement in the running dev server. Desktop
(800/1280) is unchanged: the full-bleed lock is restored above the
breakpoint, the dock stays in-grid, the wordmark and un-faded tabs return.

## Amendments

One proposed, needs the owner's consent: DESIGN_DIRECTION §Layout's line
"Navigation remains usable without horizontal page scrolling" sits in a
paragraph about the tool work area. Whether it governs the top-bar tab strip
(which scrolls internally by design at phone widths) is genuinely ambiguous —
worth tightening the line to say which it means.
