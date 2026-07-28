---
gate: design
date: 2026-07-28
surface: Vector Editor — path core: 7-tool strip, menubar subbar, anchor/pen/marquee overlays, convert control
result: FAIL -> PASS
findings: 1 High + 2 Medium + 1 Low (all applied or verified)
---

# Design gate — Vector Editor path core (V1)

Audited against docs/DESIGN_DIRECTION.md with numerically computed WCAG
contrast from the actual OKLCH tokens.

## Result: FAIL → PASS (every finding applied or resolved)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | High | Every new canvas overlay (anchors, handle lines/knobs, pen path/ghost, marquee — plus the pre-existing selection frame) stroked with theme-reactive `--brand-cyan`, which is 1.56:1 against the always-white artboard in dark theme (the mandated initial theme); the handle line's color-mix diluted to 2.77:1 even in light theme. The artboard sits outside the surface-token sweep, so app-theme tokens are the wrong palette for on-canvas marks. | Applied: new artboard-pinned tokens on the surface — `--ve-overlay-accent: oklch(0.48 0.12 200)` (≥4.9:1 on white, same value in both themes) and `--ve-overlay-paper: #ffffff` — used by ALL overlay classes including the pre-existing `.ve-sel-*`; the handle-line dilution and ghost-alpha dilution removed (the dash pattern alone marks the ghost as provisional). Verified live: the accent resolves to the dark cyan under `data-theme="dark"`. |
| 2 | Medium | Hollow-marker fills mixed two theme-reactive tokens (`--card` vs `--background`) — in dark theme both render as solid dark dots on the white artboard, breaking the hollow language. | Applied: both use `--ve-overlay-paper`. |
| 3 | Medium | Undo/Redo/SVG/PNG duplicated as four always-on subbar buttons AND menu items — diverging from the image editor's consolidated pattern (menus + one primary action). | Applied: subbar now carries a single `button-primary` "Export SVG"; File/Edit/Object menus own the rest. Deliberate mirror of the image editor's shape. |
| 4 | Low | `✒` (U+2712) pen glyph could theoretically take emoji presentation. | Verified live with a canvas fillStyle probe in the running app: 564 glyph pixels, 0 colored — renders as monochrome text on this platform. No swap needed. |

## Passed outright

Chrome color roles (cyan border + cyan-text label split), typography (all new
labels inside the established 0.68–0.72rem dock micro-tier — one more data
point for the queued codification amendment), tap targets (30px convert
buttons, 44px toolstrip), copy voice (plain, specific, no AI tells), zero new
motion, sub-900px toolstrip wrap (7 tools wrap cleanly), menubar subbar
structure byte-parallel to the image editor's, focus-visible ring inherited
unoverridden, correct toggle-group semantics on the convert control, keyboard
parity for whole-object work via the layers panel + nudge/delete/escape.

Noted for the backlog (not scored): anchor-level keyboard entry (pen is
pointer-only — a recognized freehand exception); overlay accent derived from
`doc.background` luminance once V3 makes the artboard editable.
