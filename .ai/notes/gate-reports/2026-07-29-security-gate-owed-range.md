---
gate: security
date: 2026-07-29
surface: V3 vector documents + I2 image export/new-doc + roving-radiogroup (3cc425e, 315c7fa, 9b255bd)
result: FAIL -> PASS
findings: 2 Medium + 2 Low (all applied)
---

# Security gate — the owed range (discharges 2 blocked runs)

Ran once subagent capacity returned. DISCHARGES the OWED security runs in
`2026-07-28-gates-vector-documents.md` and
`2026-07-28-gates-image-export-newdoc.md`. (V2's security gate already ran
2026-07-28 and passed; correctly out of scope here.)

## Result: FAIL → PASS (all applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | The image Export dialog capped per-side (12000) but never total pixels — a 6000×6000 doc at the 2× preset lands both sides on exactly 12000 (each legal) and requests a 144-megapixel canvas (~549MiB) on top of the live composite. | Applied: `MAX_EXPORT_PIXELS` (40M) added to the dialog's `valid` AND re-clamped inside `runExport` at the allocation site (proportional shrink), matching the pattern `cropDoc` established in I1. |
| 2 | Medium | Same gap, worse in the vector editor: artboards allow 20000/side with no pixel budget anywhere, so a 12000×12000 artboard saturates both axes at the DEFAULT 1× scale. | Applied: the same shared budget gates the vector export dialog and is re-clamped inside `rasterizeBitmap` — the true choke point, since it is also callable directly. Verified live: a 7000×7000 artboard (49MP) disables Export with the limits hint. |
| 3 | Low | `applyDocSetup` committed dialog width/height verbatim while its sibling `resizeArtboard` re-clamped. | Applied: same defensive clamp in both. |
| 4 | Low | `rasterizeBitmap`'s new `quality` had no finite guard (its neighbor `scale` did). | Applied: finite-guarded with a 0.92 fallback. |

## Verified safe (gate's own traces)

- **unit/ppi/doc-name restore**: `isDocUnit` strict whitelist; ppi
  scalar-gated then clamped (fuzzed `[]`, `1e308`, `"abc"` — all land on
  defaults or bounds); doc name try/catch + 120-char cap on BOTH read and
  write, and its only sinks are `slugifyFilename` and a controlled input.
- **rasterizeBitmap**: scale finite-guarded; JPEG matte is a literal;
  `omitBackground` is internally computed and only toggles a `<rect>`;
  colors double-protected by `safeColor` on load and `escapeAttr` on out.
- **Export filenames**: every user-controllable name routes through
  `slugifyFilename` before `anchor.download`.
- **createDoc background**: only null / `#ffffff` / a browser-normalized
  color-input value, feeding `ctx.fillStyle` (spec-ignores invalid input).
- **EditorDialog**: static FOCUSABLE selector; the capture listener can't
  be live while closed (early return before `addEventListener`, React
  cleanup ordering); `focus()` on a removed element is a spec no-op.
- **useRovingRadioGroup**: `count===0` returns before modulo; out-of-range
  `activeIndex` falls back to 0; all 9 call sites pass module-const lengths.

## Notes carried forward

The gate flagged (out of scope, untouched by this range) that shape
position/rotation fields in `project-io.ts` are finite-checked but not
magnitude-clamped, unlike path anchors — an explicit decision on whether
V1's coordinate-clamp convention should be document-wide is queued in the
backlog. Its proposed amendment (any bitmap-rasterizing surface enforces a
TOTAL pixel ceiling and re-clamps at the allocation site, not just the
dialog gate) is queued for owner consent — this range is the second
occurrence of that exact class.
