---
gate: design
date: 2026-07-29
surface: V3 vector documents + I2 image export/new-doc + dialog migration (3cc425e..52188ff)
result: FAIL -> PASS
findings: 1 High + 2 Medium + 2 Low (all applied)
---

# Design gate — the owed range (DISCHARGED on the third attempt)

Two earlier launches died on the provider's monthly spend limit. This run
completed and audited `3cc425e..52188ff`. **The gate ledger's last owed
entry is now closed.**

## Result: FAIL → PASS (all five findings applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **High** | The artboard-aware overlay palette I shipped had a **dead zone**. It branched on a gamma-UNCORRECTED weighted average against an arbitrary 0.45 cutoff, so for a wide band of real backgrounds NEITHER cyan reached WCAG 1.4.11's 3:1 — the gate computed neutral gray `#969696` at 1.90:1, khaki 2.77:1, olive 1.39:1, orange 2.44:1, tan 2.97:1, plus a one-shade cliff at the branch boundary (`#727272` 3.09:1 → `#737373` 1.23:1). The shipped comment claimed "both clear 3:1"; it was wrong. | Applied: new pure module `lib/vector-editor/overlay-palette.ts` computes REAL relative luminance (sRGB-linearized) and picks the accent that actually clears 3:1 — brand cyan when it does (so white/dark artboards keep the product color), black or white when no cyan can. That fallback is mathematically total: for any background the better of black/white is ≥4.58:1. The canvas writes the result as inline custom properties; the CSS class flip is gone. |
| 2 | Medium | `.editor-dialog-title` set no `font-weight`, inheriting the UA's uncontrolled `<h2>` bold, while the sibling it claimed to mirror is explicit 1.15rem/600. | Applied: 1.15rem + `font-weight: 600`, matching the sibling and DESIGN_DIRECTION's "semibold". |
| 3 | Medium | The vector statusbar is unit/PPI-aware; the image statusbar was always bare pixels, so a user who created a Letter-size doc lost the physical readout the moment the dialog closed. | Applied: the image statusbar now shows `w × h px · X × Y in @ Nppi`, in the vector statusbar's phrasing. |
| 4 | Low | Three different renderings of "size @ resolution" in one feature. | Applied: one canonical form (spaced ×, unit suffix, `@ Nppi`) across both statusbars, the doc-setup hint, and the New-dialog presets. |
| 5 | Low | `.ve-title-input` had no passive cue that the artwork title is editable — border on hover/focus only. | Applied: a faint always-visible dashed underline. |

## Verified after the fixes

Drove the real Document-setup dialog through every color the gate proved
broken and read the live stage's resolved accent: `#969696` → 7.10:1,
`#c3b091` → 9.94:1, `#808000` → 5.01:1, `#ff8800` → 8.77:1, white →
5.85:1 (brand cyan kept), `#101319` → 11.95:1 (bright cyan kept). The pure
module carries 8 unit tests including a sweep of the whole sRGB cube
asserting no background falls under 3:1.

## Passed outright

Token discipline in both themes; tap targets (24–30px, all above the
floor); copy voice; `:focus-visible` inheritance (nothing sets
`outline: none`); the `EditorDialog` trap/restore/first-field focus;
roving tabindex correct at all 9 sites; the two editors' Export dialogs as
one family; no motion added; no anti-goals.

## Notes carried forward

- The Filters/"Adjust" dialog still runs on the pre-`EditorDialog`
  primitive — deliberate deferral ("migrate as they're touched"), so today
  it is 7 dialogs in 2 families. Backlogged.
- `.image-editor-title-input:focus-visible` (pre-dating this range) still
  does `outline: none`; the newer `.ve-title-input` pattern should be
  back-ported next time that file is touched.
- `.image-editor-panel-label` at 0.55rem is another instance of the
  already-pending micro-label tier amendment, not a new finding.
