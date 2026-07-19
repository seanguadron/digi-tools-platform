---
gate: security
date: 2026-07-19
surface: Vector Editor — localStorage document read + SVG/PNG export
result: PASS
findings: 1 Low (numeric range clamp; applied)
---

# Security gate — Vector Editor

Audited the new native-SVG vector tool's trust boundaries: the localStorage
document read (`project-io.ts`) and the artwork export (`svg-export.ts` +
`browser-download.ts`).

## Result: PASS (1 Low, applied)

The two hardening measures added before the gate — `escapeAttr` on every
color in the serializer and a `safeColor` allowlist regex in the loader —
**fully close** the attribute/markup-injection vector for the string-built
SVG export. The gate could construct no bypass and confirmed the two are
redundant-safe (each independently sufficient): `safeColor`'s three anchored
alternatives cannot emit `"`, `<`, `>`, `&`, or `(`, so no attribute
break-out and no `url(...)` reference is constructible, and `escapeAttr`
neutralizes the same characters unconditionally at export regardless of a
color's origin.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Low | Validated numeric geometry (`width`/`height`/`rx`/`ry`) is checked for type (`isNumber`) but not range/sign, unlike `opacity` (`clamp01`) and `radius` (`Math.max(0,…)`). A tampered `VectorDocument.width/height` feeds `canvas.width/height` in `rasterizePng`, so a huge value asks the PNG canvas for an absurd allocation. Browsers cap this gracefully and `exportPng()`'s try/catch already swallows the failure (hence Low, not Medium). | Added `clampSize()` in `project-io.ts` (mirrors the `clamp01`/radius pattern) applied to document `width`/`height` and shape sizes, plus a `raw.length` budget check before `JSON.parse` to mirror the write-side `SIZE_BUDGET`. |

## Verified on the merits (the gate's five checks)

- **localStorage read** — field-by-field, no bare cast; `record()` narrows a
  type-guarded object, every field validated individually; invalid objects
  and polygon points are dropped (filtered), not thrown; `JSON.parse` and
  both `getItem` calls each in try/catch; top-level failure → `null` →
  caller keeps `createEmptyDocument()`. Degrades to defaults, never crashes.
- **SVG export injection** — color is the ONLY string in the output; all
  geometry routes through `num()` (arithmetic, cannot carry markup); object
  names are never emitted. Both hardening layers verified sufficient
  independently.
- **PNG rasterization** — no external-resource vector exists in the model
  (`VectorShapeKind` has no `<image>`/`<use>`; no color can contain
  `url(...)`), so no canvas taint, no SSRF; SVG-as-`<img>` disables scripts;
  `encodeURIComponent` (correct — encodes the `#` in hex colors); all failure
  paths caught.
- **Downloads** — only the sanctioned `browser-download.ts` path; hardcoded
  filenames (no slugify/injection surface).
- **No new injection primitives** — grep across all vector-editor files: zero
  `eval`/`new Function`/`dangerouslySetInnerHTML`/`innerHTML`/`document.write`/
  `insertAdjacentHTML`/`srcdoc`/`window.open`. §2.4 allowlist unchanged. No
  import/file-upload boundary exists in this tool — localStorage is its only
  externally-influenced input.

## Amendments

None proposed.
