---
gate: design
date: 2026-07-14
surface: Image Editor Photopea redesign — docked cockpit: narrow tool strip + overlapping FG/BG swatch, tabbed right dock, full menu bar, bottom status bar, on-canvas zoom cluster + minimap, brush stencils; Digi Tools dark/cyan skin kept
result: pass (after fixes)
findings: 1 Medium (fixed), 4 Low (2 fixed, 2 accepted/deferred with rationale)
---

# Design gate — Image Editor Photopea redesign

Ran against `docs/DESIGN_DIRECTION.md`. Result was 0 High / 1 Medium / 4 Low.
Structure judged a faithful, high-quality read of the cockpit direction (docked 1px
seams, opaque neutral rails, familiar controls, portaled shell chrome, full
keyboard/ARIA wiring, global reduced-motion). Fixes below.

## Findings

| # | Sev | Finding | Resolution |
|---|-----|---------|-----------|
| 1 | Medium | `.editor-tab.is-active` label used `var(--brand-cyan)` → **1.68:1** on the tab background in **light** theme (WCAG AA needs 4.5:1). Redesign-introduced, key state indicator. | **Fixed.** Active-tab label → `var(--foreground)`; cyan kept as a 2px inset marker bar. Matches the redesign's own "cyan as a thin active-state marker" intent. Verified: computed color == `--foreground`; cyan is the box-shadow. |
| 2 | Low | Floating zoom cluster + minimap used `backdrop-filter: blur(8px)` on translucent card — the glassmorphism anti-goal; the "matches Architect controls" rationale was wrong (those are opaque). | **Fixed.** Solid `var(--card)`, no blur — genuinely matches the Architect controls. Verified `backdrop-filter: none`. |
| 3 | Low | `.image-editor-dock-panel:focus-visible { outline: none }` removed the focus ring on a focusable panel (WCAG 2.4.7). | **Fixed.** Restored a cyan `outline` (offset -2px). |
| 4 | Low | `.image-editor-panel-label` is 0.55rem, below the 0.75rem caption floor. | **Deferred (rationale).** Pre-existing shared house style used across tools, not a redesign regression; the gate itself scoped the Medium to only the new tab label. Folded into the amendment proposal below rather than an editor-only patch. |
| 5 | Low | Minimap recenter is pointer-only under `aria-hidden` (WCAG 2.1.1). | **Accepted as decorative.** It's a redundant convenience; zoom/Fit/100% are keyboard-reachable. `aria-hidden` correctly declares it decorative. |

## Notes — proposed amendment (owner consent)

The Design gate flagged a **systemic, pre-existing** issue: `color: var(--brand-cyan)`
as TEXT computes ~1.5–1.8:1 in light theme across 20+ selectors app-wide (home spec,
skills headings, `.role-category-tab span`, craft method, `.image-editor-panel-label`,
`.editor-menu-check`). Dark theme is clean (11–12:1). The editor faithfully followed
the house pattern; only the new active-tab label was fixed here.

Proposed STANDARDS amendment (consent-gated, touches the shared palette): **"cyan is a
focus/marker/active color, not a light-theme text color; label text uses
`--foreground` or a darkened `--brand-cyan-text` token."** Introduce a text-safe cyan
token for light theme so "both modes first-class" (DIR:31) and WCAG 2.2 AA
(PRODUCT.md:47) actually hold together.
