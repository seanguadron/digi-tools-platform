---
gate: integration
date: 2026-07-14
surface: Image Editor — Photopea-style redesign (menu bar, tabbed right dock Layers/Channels/Properties/Adjust/History, narrow tool strip, on-canvas zoom cluster + minimap, bottom status bar, brush stencils, functional channels, layered zip/JSON+MD export). 9 new files, 8 modified.
result: pass
findings: 0 integration defects; process obligations satisfied (this + Security + Design reports saved; deterministic halves green)
---

# Integration gate — Image Editor Photopea redesign

Ran against `docs/STANDARDS.md`. **Result: PASS (0 integration defects.)**

## Per-rule

- **§1.1 tool registration** — PASS. No new tool; `image-editor` already registered
  (`tool-registry.ts`). New components carry no `href`/`next/link`; the only shell
  change is the `#app-statusbar-slot` portal (consumed, not orphaned). Nothing links
  to an unregistered tool.
- **§2.1 / §2.2 catalogs & generated docs** — N/A. No `src/data/` change; no roles
  touched.
- **§2.3 trust boundary validated** — PASS. All three ingest paths (`openImageFile`,
  `placeImageFiles`, new `importTipFile`) route through `decodeImageFile(file,
  IMAGE_LIMITS)` and check `"error" in result` before use; the new download path is
  output-only, built from the internal doc. No new `localStorage`/`JSON.parse`.
- **§2.4 no injection primitives** — PASS. Only `dangerouslySetInnerHTML` in `src/`
  remains the allowlisted theme bootstrap in `layout.tsx`. User strings render as
  escaped React text.
- **§3.3 graph true** — PASS. No gov:node file changed; `check:standards` green.
- **§3.1/§3.4 skill pins** — N/A. No skill installed/refreshed.
- **Conventions** — PASS. Kebab-case files; `"use client"` only where client APIs are
  used (the 4 new `.ts` helpers carry no directive; `brush-tips.ts` avoids
  module-scope canvas); `EditorMenubar`/`EditorTabs` are caller-driven (commands/tabs
  as props), panels props-driven over the doc.

## Deterministic half

`npm run typecheck` clean; `npm run check:standards` green.

## Notes

- Strongest part of the change: a single validated decode funnel (`decodeImageFile`)
  now serves image-open, image-place, and brush-tip import — the new ingest surface
  inherited the existing (2026-07-08 audited) guards rather than opening a parallel path.
- Flagged to Design/a11y (not an integration defect): the minimap is a pointer-only
  drag control under `aria-hidden` — verify an accessible pan path exists. (Design gate
  ruled it acceptable as decorative; zoom/Fit are keyboard-reachable.)
