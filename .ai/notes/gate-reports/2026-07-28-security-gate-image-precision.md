---
gate: security
date: 2026-07-28
surface: Image Editor — precision pass (I1): ppi persistence, crop rect pipeline, size dialogs
result: FAIL -> PASS
findings: 1 Medium + 1 Low (both applied)
---

# Security gate — Image Editor precision pass (I1)

Audited the ppi field through both persistence paths (file-open + autosave —
verified they share the one validated `deserializeDoc`), the confirm-stage
crop pipeline end to end, both new/rewritten dialogs' validity gates, and the
resample quality param.

## Result: FAIL → PASS (both findings applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | The new numeric crop fields removed the drag path's implicit screen bound without adding an explicit one: typing 999999999 into W reached `createBitmap` ungated — the only doc-growing affordance without the `MAX_DOC_DIMENSION`/`MAX_DOC_PIXELS` gate its three siblings (New / Image size / Canvas size) all carry, in an app with no error boundary. | Applied at both halves: `cropDoc` now clamps width/height to `MAX_DOC_DIMENSION` and no-ops (never throws) when the area exceeds `MAX_DOC_PIXELS` — the allocation choke point; the panel computes the same `valid` and disables "Apply crop" with the standard limits hint; `applyCrop` re-checks. Verified live: huge W → Apply disabled + hint. |
| 2 | Low | `clampPpi(Number(value.ppi))` rode `Number([]) === 0` to a 1-PPI floor for a malformed array instead of the documented default. | Applied: only `number`/`string` shapes ride the coercion; every other shape takes `DEFAULT_DOC_PPI`. |

## Verified safe

- ppi crafted-payload matrix (string/object/array/±Infinity/negative/1e308/
  300-digit numerals/absent) → always a clamped finite value or the default;
  autosave restore flows through the same `deserializeDoc` as file-open;
  write side budget-capped before `setItem`.
- Both dialogs double-gate every apply (disabled + handler re-check); no
  form/Enter bypass; PPI division-by-zero unreachable (every writer clamps).
- `ResampleQuality` unreachable by arbitrary strings (fixed `<select>`
  options; compared, never interpolated).
- `check:security` green; no new injection primitives or bare-cast reads.

Proposed amendment (owner consent, queued via sessions log): every affordance
that grows/reallocates the document canvas must gate on
`MAX_DOC_DIMENSION`/`MAX_DOC_PIXELS` at BOTH the UI layer and the pure
`document.ts` operation — codify the pattern instead of per-feature opt-in.
