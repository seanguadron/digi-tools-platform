---
gate: security
date: 2026-07-28
surface: Vector Editor — point text (V2): user text into the scene + string-built SVG export
result: FAIL -> PASS
findings: 1 Medium + 2 Low (all applied)
---

# Security gate — Vector Editor point text (V2)

First milestone that puts USER-AUTHORED text into the native-SVG scene and
the string-built export. The gate traced every interpolation and crafted-
payload path by hand.

## Result: FAIL → PASS (all applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | `MAX_TEXT_LENGTH` was enforced on load and CREATE but not on EDIT — the overlay textarea had no maxLength and `withMeasuredText` never sliced, so an oversized paste could push the doc past the 4MB autosave budget (and the tool has no manual-save recovery). | Applied: new `sanitizeText` in text.ts is THE enforcement point (length cap + XML-invalid control-character strip + \r\n normalization), called by `withMeasuredText` (covers overlay commits AND panel edits), `createTextObject`, and the load validator; the overlay textarea also carries `maxLength`. Unit-tested. |
| 2 | Low | Resize-handle drags scaled `fontSize` past `MAX_FONT_SIZE` (the only path skipping `clampFontSize`). | Applied: the transform text arm clamps, and scales the stamped extents by the factor that ACTUALLY applied so bounds can't desync. |
| 3 | Low | Pasted C0 control characters would land in tspan content — not an injection (escaping is length/charset-independent) but invalid strict XML that could fail external parsers or the rasterize `<img>` load. | Applied: covered by `sanitizeText`'s control strip (keeps \t and \n). |

## Verified safe (gate's own traces)

- **Export injection closed**: every tspan CONTENT interpolation runs
  through `escapeAttr` (& < > "); no way to close a tag or smuggle an
  entity; per-line escaping means embedded newlines can't leak raw content
  across boundaries.
- **font-family whitelisted twice over**: panel offers only the catalog;
  the loader forces unknown names to the default; and every consumer
  resolves through `fontCss`, which can only return one of the 8 authored
  stacks.
- **rasterizePng**: no new sink — no url()/href-capable field; SVG-as-image
  executes no scripts; colors still constrained by `SAFE_COLOR`.
- **Overlay editor**: controlled textarea + React text nodes only; the
  imperative style writes are number-built (a JS number can't carry a CSS
  breakout).
- **Validator arm**: every crafted payload (non-string text, 1MB strings,
  NaN/1e308 sizes, hostile font names, poisoned extents, missing fields)
  degrades — sliced, clamped, defaulted, or dropped; never a throw.

## Deterministic half

check:security · check:standards · typecheck · lint · test (53 after the
new sanitize test) — all green.

Proposed amendment (owner consent, queued via sessions log): every declared
`MAX_*`/`clamp*` invariant gets ONE enforcement point reused by every
mutator of the field (create AND update AND load) — findings 1–2 were both
bounds that existed in the validator but had live-editing gaps.
