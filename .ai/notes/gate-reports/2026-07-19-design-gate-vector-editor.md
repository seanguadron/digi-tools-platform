---
gate: design
date: 2026-07-19
surface: Vector Editor cockpit (tool strip, canvas, properties, layers, zoom cluster, minimap) + home section
result: FAIL → PASS (1 High, 6 Medium, 3 Low — all fixed)
findings: 10, all applied
---

# Design gate — Vector Editor

Audited the new tool's UI against `docs/DESIGN_DIRECTION.md`. PASS on color
roles (cyan is a marker everywhere, never light-theme text), the artwork-color
exception (shape defaults are export data, correctly raw hex), anti-goals (no
glass/gradient/oversized-radius), voice, and theme sanity. Ten findings, all
fixed.

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | High | No non-pointer path to create an object — the shape tools only draw by drag, even a zero-drag click is discarded. The sibling Architect Wizard's palette adds nodes on click/Enter. | `Enter` (with a shape tool active) now drops a default-size shape at the artboard center, selects it, and switches to Select. Empty-state copy updated. Verified. |
| 2 | Med | `.button-small` (0,1,0) was silently beaten by `.prompt-flow-header-actions .button` (0,2,0) inside the subbar → 34px there, 30px elsewhere. | Renamed to `.button.button-small` (0,2,0, wins on source order) and relocated to the shared button-vocabulary zone. |
| 3 | Med | `.ve-toggle` checkboxes rendered the OS default accent, ignoring theme. | `.ve-toggle input { accent-color: var(--brand-cyan) }`, matching `.image-editor-check`. |
| 4 | Med | `🔒`/`🔓` are color emoji — rendered in the OS emoji font, ignoring theme; the only emoji in the codebase. | Replaced with themed `■`/`□` (inherit `--muted-foreground`), matching the `◉`/`◌` hide glyphs in the same list. |
| 5 | Med | Fill/Stroke toggle checkboxes had a context-free accessible name ("On"/"Off"). | Added `aria-label={"Turn off/on fill"}` (and stroke). |
| 6 | Med | Artboard `<svg>` used `role="img"` despite owning the pointer handlers. | `role="application"`, matching the Image Editor's interactive canvas. |
| 7 | Med | The "0 failures" sweep hadn't painted two conditional subtrees: `.ve-layer-row.is-selected` (needs Layers tab + selection) and the Fill/Stroke property sub-fields (gated on `fill`/`stroke` non-null). | Re-ran the WCAG sweep with a rect selected + Stroke toggled on (both Fill+Stroke blocks painted) AND the Layers tab with the row selected, in BOTH themes: **0 failures** (2 swatches + selected row confirmed painted). The "audit with content" lesson, one level deeper. |
| 8 | Low | Zoom cluster + minimap added `box-shadow` the Image Editor equivalents don't use. | Dropped both `box-shadow` lines for parity. |
| 9 | Low | `.vector-editor-dock-head` was dead CSS (unused after the dock moved to EditorTabs). | Deleted. |
| 10 | Low | Selection/minimap marquee is a single-color marker over arbitrary artwork — inherent to any marquee, solid against the #ffffff default artboard. | Left as-is (restrained single stroke); noted. |

## Amendments proposed (owner consent)

- **Motion clause scope.** DESIGN_DIRECTION's "Use opacity or transform only"
  is contradicted by the base `.button` (and every tool strip, Image Editor
  included) transitioning `background-color`/`border-color` on hover. Predates
  this tool. Propose scoping that clause to the card system's motion, not
  routine hover-color transitions.
- **Micro-label tier.** `.ve-field-label`/`.vector-editor-dock-label` sit at
  0.68rem, under the documented 0.75rem "Caption" floor — but match a
  pre-existing, undocumented micro-label tier (e.g. `.image-editor-field-caption`
  0.62rem). Propose codifying a "micro-label 0.58–0.72rem" tier in Typography.

## Verification

typecheck / lint / check:standards / check:security green after all fixes.
Enter-to-add, `role="application"`, themed lock glyph, and layout-after-CSS-reorder
all confirmed in the running dev server; contrast 0 failures across the newly
painted states in both themes.
