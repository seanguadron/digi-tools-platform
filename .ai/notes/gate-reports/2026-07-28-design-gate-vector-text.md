---
gate: design
date: 2026-07-28
surface: Vector Editor — point text (V2): Type tool, in-place overlay editor, Type dock section
result: FAIL -> PASS
findings: 3 Medium + 2 Low (all applied)
---

# Design gate — Vector Editor point text (V2)

## Result: FAIL → PASS (all applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | With the Type tool active, the Enter-to-place capture listener exempted only INPUT/TEXTAREA — pressing Enter on any focused BUTTON (tool strip, export, layers…) placed text instead of activating the button, page-wide. | Applied: BUTTON and SELECT added to the exemption. Verified live: Enter on a focused tool button no longer spawns an editor and keeps native activation. |
| 2 | Medium | Committing/canceling the overlay dropped focus onto `<body>` with no visible destination. | Applied: the svg carries `tabIndex={-1}` and both commit and cancel focus it. Verified live. |
| 3 | Medium | `--ve-overlay-accent` was declared on the svg, but `.ve-text-editor` is a stage-level SIBLING — the var never resolved there and the identical fallback literal silently masked it. | Applied: tokens moved to `.vector-editor-stage` (one shared ancestor); the masking fallback dropped so future retunes propagate. Verified live: the border computes to the token color. |
| 4 | Low | The overlay hardcoded dark ink even when the object's fill is OFF (invisible on canvas, solid in the editor). | Applied: fill-off text edits with a 40% ghost ink — readable typing without faking a fill. |
| 5 | Low | The Type section's hint documented entry only. | Applied: "Enter finishes, Esc cancels, Shift+Enter adds a line." |

## Passed outright

Bare "T" glyph (the universal type-tool mark — familiar-controls principle);
WYSIWYG fidelity structurally guaranteed (overlay, canvas render, and export
all import the same `TEXT_ASCENT`/`TEXT_LINE_HEIGHT` constants — drift is
impossible, not just unlikely); dashed-border contrast on the white artboard
in both themes; Type section reuses the dock's existing field/label/hint
classes with no new type sizes; copy voice; zero new motion; default text
ink byte-matches the line tool's default stroke; dark/light parity on all
new chrome.

Credited by the gate: Type is the only tool with a keyboard-only creation
path (Enter places at center), and handle-resize scales `fontSize` instead
of distorting glyphs — Illustrator/Figma point-text parity.

Pre-existing items reinforced, not re-charged: the `.ve-toggle` tap-target
chip, the micro-label tier amendment, the Space-pan listener's missing
BUTTON exemption (flagged for the continuity sweep).
