---
gate: integration
date: 2026-07-28
surface: Image Editor — precision pass (I1): units module, ppi, crop rework, two dialogs
result: FAIL -> PASS
findings: 1 High + 1 Medium + 1 Low (all applied)
---

# Integration gate — Image Editor precision pass (I1)

Per-rule audit of the I1 diff (new `src/lib/units.ts` + tests, ppi through
types/document/project-io, rewritten Image Size + new Canvas Size dialogs,
confirm-stage crop across orchestrator/canvas/properties, image-zone CSS).

## Result: FAIL → PASS (all findings applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | High | `.image-editor-select` was a TAKEN class — the Layers panel's blend-mode wrapper (grid container with a nested `select` rule). The new bare-`<select>` rule of the same name applied additively to that shipped control: a hard 30px height + border on a grid label that never had them. | Applied: new rule renamed `.image-editor-unit-select` (+ both dialog usages); a comment on the rule records why. Verified live: the blend-mode wrapper is back to `display:grid`, auto height, no border. |
| 2 | Medium | Crop apply path had no ceiling against the ROADMAP's standing size constraints (same defect the security gate rated Medium — two gates converged). | Applied (see the security report): `cropDoc` clamp + panel `valid`/disabled + `applyCrop` re-check. |
| 3 | Low | The PPI field hardcoded `max={1200}` instead of `MAX_DOC_PPI` (already importable from `@/lib/units`). | Applied: `min`/`max` now use `MIN_DOC_PPI`/`MAX_DOC_PPI`. |

## Passed outright

§1.4 shell contract (dialogs mirror the existing image-dialog pattern;
subbar/statusbar portals untouched; primitives reused); §2.3 (ppi restore
via `clampPpi`, both consumers routed through the one validated
`deserializeDoc`; no new unvalidated reads); §2.4 (no injection primitives);
§5 CSS zone order (single contiguous insertion inside the image zone);
kebab-case; test conventions (`units.test.mjs` alias-free, 7 tests in the
one glob run).

Deterministic halves green after fixes: typecheck · lint · test (47) ·
check:standards · check:security.
