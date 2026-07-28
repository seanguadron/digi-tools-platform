---
gate: security
date: 2026-07-28
surface: Vector Editor — path core: project-io path validator, pathToD SVG export, anchor DOM attributes, stale-selection consumers
result: PASS
findings: 3 Low (all applied)
---

# Security gate — Vector Editor path core (V1)

The gate fuzzed the REAL validator (polyfilled localStorage + direct import
of `loadProject` — its only import is type-only, so alias resolution never
runs): non-array anchors, poisoned per-anchor fields, `__proto__` keys at two
levels, 60k-anchor arrays, 4.5MB oversize strings, 200k-deep nesting, string
`closed`, under-minimum counts — every case degrades without throwing;
prototype pollution impossible (object literals from named fields, never
spreads of untrusted objects).

## Result: PASS (3 Low, all applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Low | `fmt()`/`num()` had no finite guard — two independently-valid huge coordinates SUM to Infinity in path arithmetic and would emit literal "Infinity" tokens into the d attribute (no markup breakout — verified the string can never contain quotes/angle brackets — but a malformed export). | Applied: both formatters now return 0 for non-finite input, and `project-io.ts` clamps anchor/handle coordinates to ±`MAX_DIMENSION` at the trust boundary (`clampCoord`), so the sum cannot overflow in the first place. |
| 2 | Low | `Number.isInteger(index)` on `data-anchor-index` is a type guard, not a bounds guard — safety relied on every downstream bezier op's own `if (!anchor)` guard. | Applied: `validIndex()` in `handleDirectDown` now also requires `0 ≤ index < selectedPath.anchors.length`. |
| 3 | Low | The properties panel used raw `anchorSelection.indices` (stale after an undo shrinks a path) where the orchestrator live-filters — display staleness only. | Applied: the panel filters indices against the live anchor count. |

## Verified safe

- **Export**: `objectToSvg`'s path case interpolates only `pathToD` output
  (literal command tokens + rounded numbers); `object.name` never reaches
  markup; colors keep the `safeColor` allowlist + `escapeAttr` pair.
- **Rasterize**: `rasterizePng` byte-identical to the audited 2026-07-19
  version; `PathObject` adds no url()/href-capable field; no
  FileReader/file-input/paste/drop surface exists in the tool.
- **Selection vs live doc**: every `anchorSelection` consumer traced —
  Set-membership, `liveAnchorIndices`, or per-op guards; the single direct
  index access is optional-chained.

## Deterministic half

`npm run check:security` green before and after.

Candidate STANDARDS line (queued via the sessions log, owner consent):
"finite at the trust boundary does not mean finite after arithmetic —
formatters that stringify into markup carry their own finite-guard backstop."
