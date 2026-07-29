---
gate: integration+security+design (judgment agents BLOCKED — spend limit)
date: 2026-07-28
surface: Vector Editor — documents/units/export (V3): doc setup dialog, per-doc unit+PPI, export dialog, title, shared EditorDialog
result: deterministic halves PASS + main-agent inline review; agent re-runs OWED
findings: inline review notes below; no subagent findings possible this run
---

# Gates — Vector Editor documents/units/export (V3) — agents blocked

The provider's monthly subagent spend limit (hit during V2's integration
gate) prevents launching judgment agents for this milestone. Per the
2026-07-19 precedent: deterministic halves + an honest inline review are
recorded, and the three agent runs are OWED when capacity returns.

## Deterministic halves — all green

typecheck · lint · test (53) · data:validate · check:standards ·
check:security.

## Main-agent inline review (the judgment half, best-effort)

- **§1.4 shell contract** — V3 CREATES the shared dialog primitive the
  ROADMAP's continuity thread called for: `EditorDialog`
  (portal/backdrop/Escape + focus trap + focus restore — the two things the
  image editor's three older dialogs lack; they migrate in I2's sweep). Both
  new vector dialogs build on it; generic `.editor-dialog-*` CSS sits with
  the shared `.editor-menubar` chrome cluster. Title input mirrors the image
  editor's subbar title. `slugifyFilename` gains its fourth consumer.
- **§2.3 trust boundary** — `VectorDocument.unit`/`ppi` restore via
  `isDocUnit` (whitelist, default "px") and the scalar-gated `clampPpi`
  pattern the image editor's I1 fix established (arrays/objects take the
  default, never `Number([])` coercion). Doc name: separate key, sliced to
  120, try/catch both directions, "Untitled" fallback. Both verified in the
  running app (crafted values degrade; round-trip holds).
- **§2.4 injection** — no new interpolation into markup: `serializeSvg` only
  gained an `omitBackground` boolean; `rasterizeBitmap` params are typed
  numbers/enums with clamps (scale finite-guarded, canvas capped 12000/side,
  JPEG white-matted, quality clamped 0.5–1). Filenames pass through
  `slugifyFilename`.
- **§5 CSS zones** — `.editor-dialog-*` in the shared-chrome cluster (before
  the vector zone); `.ve-title-input` inside the vector zone; mobile-gate
  zone still last.
- **Copy/design** — dialog labels and hints follow the plain voice; the
  export dialog's SVG description states what the format preserves; physical
  sizes render through the shared units module; segmented format/scale
  controls reuse the established is-active border+text split. KNOWN
  reinforcement: the format/scale rows are two more radiogroup-on-buttons
  instances — deliberately consistent with the 4 existing sites so the
  chipped shared roving-tabindex helper fixes all 6 in one pass.

## Browser verification (running dev server)

8.5×11in @ 300 PPI setup → 2550×3300px artboard; unit-aware statusbar; title
rename persists and drives `poster-draft.*` filenames; export dialog: 2× PNG
= 5100×6600, focus trap verified live; unit/ppi/name survive reload through
the validator. NOTE: the unmanaged dev server on 5100 replays a stale
Turbopack error snapshot (a mid-edit compile) — disk code and typecheck are
clean; needs `dev:clean` whenever its owner restarts it (runbook gotcha).

## Owed

Integration + security + design agent runs on this surface when subagent
capacity returns (with V2's integration re-run and I2's gates).
