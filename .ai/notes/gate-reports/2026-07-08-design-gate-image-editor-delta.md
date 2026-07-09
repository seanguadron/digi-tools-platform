---
gate: design
date: 2026-07-08
surface: Image Editor 12-feature delta UI (fg/bg swatches, gradient segmented control, Canvas ▾ menu, Image Size dialog, recent colors, hue/sat sliders)
result: pass-after-fixes
findings: 2 High + 1 Medium — all fixed this session
---

# Design gate — Image Editor 12-feature delta

The `design-gate` agent ran fully (no limits) against `docs/DESIGN_DIRECTION.md`
+ `PRODUCT.md`. 3 grounded findings, all **fixed**.

**Finding 1 — High (fixed): Canvas ▾ menu didn't suspend global shortcuts.** The
keydown guard omitted `canvasMenuOpen`, so tool/undo/nudge/fill/color shortcuts
fired against the canvas behind the open menu (the same class the base gate
fixed for the dialogs). Fix (`image-editor.tsx`): the handler now returns early
when `canvasMenuOpen` (Escape closes the menu + refocuses the trigger), and
`canvasMenuOpen` is in the effect deps.

**Finding 2 — High (fixed): gradient segmented control exposed selection state by
color only.** The 4 Linear/Radial/FG→BG/FG→clear buttons toggled `is-active`
(color) with no ARIA. Fix (`image-editor-toolbar.tsx`): added `aria-pressed` to
all four, matching the file's own `ToolButton`/swatch pattern. Grounds:
PRODUCT.md "don't rely on color alone" + WCAG 4.1.2.

**Finding 3 — Medium (fixed): Canvas ▾ menu had no Escape/focus handling and
over-declared `role="menu"`/`"menuitem"` without the implied keyboard model.**
Fix: added Escape-to-close (returns focus to the trigger via a ref), and changed
the container to `role="group" aria-label="Canvas actions"` with plain buttons —
so Name/Role/Value matches the actual Tab/click behavior. `aria-haspopup` on the
trigger is now `"true"`.

Agent confirmed PASS (for the record): Image Size dialog is in the keyboard guard
+ autofocuses + Escape-closes; new CSS is 100% tokens (raw hex only in
user-selected paint values, the documented exception); segmented control +
dropdown are familiar idioms; hue/sat sliders have visible labels; focus rings,
motion, density, voice, anti-goals all clean; no shortcut collisions.

Proposed amendments (flags, carried forward): icon-language now mixes SVG +
Unicode glyphs inside the toolbar (fg/bg ⇄/◑, Canvas ▾ caret) — fold into the
base report's icon-consistency amendment. `.image-editor-seg` at 0.72rem is under
the 0.75rem caption floor — consider a documented compact-toolbar-chrome carve-out.
Both need the owner's consent.
