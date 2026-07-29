---
gate: integration
date: 2026-07-29
surface: V2 point text + V3 vector documents + I2 image export/new-doc + shared roving-radiogroup (84eada7..9b255bd)
result: FAIL -> PASS
findings: 1 Medium + 1 Low-Medium + 2 Low (all applied)
---

# Integration gate — the owed range (discharges 3 blocked runs)

Ran against the committed range `84eada7..HEAD` once subagent capacity
returned. This DISCHARGES the OWED integration runs recorded in
`2026-07-28-integration-gate-vector-text.md`,
`2026-07-28-gates-vector-documents.md`, and
`2026-07-28-gates-image-export-newdoc.md`.

## Result: FAIL → PASS (all findings applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | V2 pinned the canvas-overlay palette to a literal white artboard with a comment saying "revisit when document setup makes doc.background editable" — and V3, in the same range, shipped exactly that. Selection handles, anchors, pen preview, and the text-editor border stayed one fixed dark cyan over a now user-chosen (possibly dark or transparent) artboard. | Applied: the canvas derives `is-dark-artboard` from the background's own luminance (transparent follows the app theme) and flips to a bright-cyan-on-dark-paper palette; the comment now describes the real behavior. Verified live: setting `#101319` flipped the accent from lab 40.8% to 80.8% and paper to `#10141c`. |
| 2 | Low-Medium | The 12000px export ceiling was redeclared independently in FOUR files (three new in this range) — the exact drift risk `units.ts` was extracted to prevent. | Applied: `MAX_EXPORT_DIMENSION` + `MAX_EXPORT_PIXELS` now live in `src/lib/units.ts`; all four sites import them. |
| 3 | Low | The image editor's `runExport` allocated straight from dialog-supplied numbers, skipping the defense-in-depth clamp its vector sibling has. | Applied: `runExport` re-clamps per-side AND against the pixel budget at the allocation site (proportional shrink), mirroring `rasterizeBitmap`. |
| 4 | Low | `svg-export.ts`'s header still claimed "no user-authored text in the markup, so nothing needs escaping" — false since V2. | Applied: the comment now documents the three string kinds and their escaping. |

Also applied from the gate's "ambiguous, for the main agent" note: an
explicit ARCHITECTURE.md carve-out stating that `EditorDialog`-based
dialogs (null until `open`, every consumer defaulting closed) may portal to
`document.body` directly, and that an open-by-default dialog loses the
exemption.

## Passed outright

Shell contract (EditorDialog reused by all four new dialogs;
`useRovingRadioGroup` wired at all 9 radiogroup sites); §2.3 (unit/ppi
whitelist + scalar-gated clampPpi, doc-name try/catch + cap, the text
validator arm, `withMeasuredText` as the single text enforcement point —
all read directly, not taken from the ledger); §2.4 (every interpolation
escaped; no new injection primitives); §3.2/§3.3/§3.5 governance; kebab-case
and test conventions.

Deterministic halves green after fixes: typecheck · lint · test (53) ·
data:validate · check:standards · check:security.
