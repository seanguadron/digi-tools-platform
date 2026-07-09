---
gate: integration
date: 2026-07-08
surface: Image Editor (/tools/image-editor) — new from-scratch raster editor tool
result: pass
findings: no code-level defects; only the process item (this ledger entry), now satisfied
---

# Integration gate — Image Editor

The `integration-gate` judgment agent ran fully (no tool/spend limits) and
returned **PASS** on every substantive STANDARDS rule. The only "FAIL" was the
process item — the ledger report didn't exist yet — which this file resolves.

Per-rule result (agent, corroborated by live `check:standards` / `data:validate`
/ `typecheck` / `next build`):

- **§1.1** tool registered + routed in one change — PASS. `tool-registry.ts`
  adds the `"image-editor"` id + entry (`fullBleed: true`); the route lives at
  `src/app/tools/image-editor/page.tsx`; nav/full-bleed derive from the registry
  (`app-shell.tsx`), and `src/app/page.tsx` links via `imageTool.href`. `rg`
  found no reference to an unregistered path.
- **§2.1** — N/A. No new `src/data/` JSON catalog; `data:validate` untouched
  (ran green).
- **§2.3** trust boundary shape-validated, not cast — PASS. `project-io.ts`
  `deserializeDoc` validates version/dimensions/layers/data-URL prefixes and
  coerces opacity/blend, returning null on any problem; `parseProjectJson` and
  the persistence restore both route through it before `setDoc`; `decodeImageFile`
  validates MIME + dimensions and returns `{error}`. The known-latent
  `prompt-session.ts`/`prompt-storage.ts` casts are confirmed **unmodified**.
- **§2.4** no injection primitives — PASS. No `eval`/`new Function`/
  `dangerouslySetInnerHTML` in any new file; `check:security` S1 green.
- **§3.2/§3.3** — ledger entry (this file); no `gov:node` edges touched.
- **Conventions** — PASS. kebab-case files, `use-*` hooks, `"use client"` only
  where interactivity demands it (route page is a server wrapper; lib modules
  have no module-scope DOM access), composable component tree.

Non-blocking notes carried forward (no STANDARDS rule; left as observations):
`image-editor-canvas.tsx` inlines all per-tool pointer logic in one large
component — a candidate split if the surface grows; the two modals set initial
focus now (fixed under the Design gate) but don't trap focus.
