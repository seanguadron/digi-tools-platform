---
gate: security
date: 2026-07-14
surface: Image Editor Photopea redesign — trust-boundary changes: new store-only ZIP download (src/lib/zip.ts + export-archive.ts), brush-tip PNG import (buildTipAlpha via decodeImageFile), channels reading composite ImageData
result: pass (after fixes)
findings: 1 Medium (fixed), 3 Low (all fixed)
---

# Security gate — Image Editor Photopea redesign

Ran against `docs/STANDARDS.md` §2.3/§2.4. Result was 1 Medium + 3 Low; **all fixed.**

## Confirmed safe (primary threats)

- **Filename injection — neutralized.** `slugifyFilename` reduces to `[a-z0-9-]`;
  archive entry names are a constant `layers/` prefix + padded index + slug + `.png`.
  No `../`, CRLF, or control chars reach an entry name or `anchor.download`.
- **Brush-tip import guard — applied and bounded.** `importTipFile` routes through
  `decodeImageFile(file, IMAGE_LIMITS)` and returns on error before `buildTipAlpha`;
  dimensions capped to 12,000/side and 40 MP.
- **channels.ts — clean.** In-bounds pixel loops over the app's own composite;
  returns null on empty; same-origin canvases (no taint).
- **No new script-injection primitive.**

## Findings (all fixed)

| # | Sev | Finding | Fix applied |
|---|-----|---------|-------------|
| 1 | Medium | Layer/doc name flowed unescaped into `layers.md` → could break the table or become live markup in a raw-HTML markdown viewer (the JSON manifest was already safe via `JSON.stringify`). | Added `mdCell()` in `export-archive.ts`: strips control chars/newlines, HTML-escapes `&<>`, escapes `\|`; applied to every name/file/blend cell + the heading. Verified: `<script>`→`&lt;script&gt;`, `\|` escaped, newlines→spaces. |
| 2 | Low | Custom brush tips unbounded in count and retained at full decode resolution (up to 40 MP each). | `buildTipAlpha` now downscales tips to ≤512px; `importTipFile` keeps the most recent 24 (`.slice(-24)`). |
| 3 | Low | `createZip` pre-concatenated all chunks into a second full buffer (~2× peak memory). | Build the Blob directly from the chunk array (`new Blob(parts …)`), one copy. |
| 4 | Low | ZIP writer has no ZIP64 fallback (>4 GB wraps silently). | Documented the <4 GB assumption (never reached under the 64-layer cap). |

## Deterministic half

`npm run check:security` green.

## Notes

- Root cause of #1 is the pre-existing import boundary (`project-io.ts` bounds
  pixels/dimensions/layer-count but not name length/content). Sanitizing at the export
  sink is sufficient; optional future hardening: clamp name length on import.
- `next.config.ts` dev-origin exposure unchanged and acceptable for a client-only app.
