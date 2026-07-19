---
gate: integration
date: 2026-07-19
surface: Vector Editor (new fifth tool, /tools/vector-editor)
result: FAIL → PASS (2 issues, both fixed)
findings: 2 (globals.css zone order; unprefixed .button-small)
---

# Integration gate — Vector Editor

Audited the new native-SVG vector tool against `docs/STANDARDS.md`.

## Result: FAIL → PASS (both fixes applied)

Almost entirely clean: §1.1 registration, the full §1.4 shell contract (subbar
+ statusbar handshakes both via `usePortalTarget`, chrome-height vars, the
shared `EditorTabs`/`tabPanelProps`, and every state/persistence/export/mobile
primitive REUSED not reinvented), §2.3 (the `project-io.ts` validator is
called out as a clean model of the rule), §2.4, and conventions all PASS. Two
CSS-organization failures, both fixed:

| # | Issue | Fix |
|---|---|---|
| 1 | The `/* ===== Vector Editor ===== */` block was appended AFTER the `/* Mobile tool gate */` zone. ARCHITECTURE §5 requires the mobile-gate zone to stay LAST — its overrides (the `html:has(...)` overflow unlock, the `.context-default` restore) win only on source order. Not yet a live bug, but it breaks the documented invariant. | Moved the whole Vector Editor block to before the Mobile-gate banner (right after Image Editor). Mobile gate is last again. |
| 2 | `.button-small` was unprefixed and generic-looking but defined inside the Vector Editor banner rather than the shared button-vocabulary zone. | Relocated it beside `.button-quiet` in the shared button zone — it graduates to a real shared size modifier (its natural role). |

## Verified PASS (evidence)

- §1.4 subbar: `vector-editor.tsx` `<ToolSubbar>` → `usePortalTarget("app-subbar-slot")`, no render-time DOM read (the hydration hazard I fixed elsewhere this month).
- §1.4 statusbar: `usePortalTarget("app-statusbar-slot")` + `createPortal` — done correctly (the gate noted this is a BETTER implementation than image-editor.tsx's still-live render-time `getElementById`, which is inert only because it's doc-gated).
- §2.3: `loadProject` → `JSON.parse` typed `unknown` → `validateDocument`, never cast; `isNumber`/`record`/`safeColor` guards, per-kind required-field switch, invalid objects/points dropped via `.filter()`, corrupt doc → `null` → caller keeps the empty document. Stronger than the two latent §2.3 audit points already on record.
- §2.4: no injection primitives; the SVG string builder is export-only (never React DOM), colors escaped + allowlisted.

## Follow-ups the gate surfaced (not owed on this surface)

- `image-editor.tsx:1054` statusbar portal still uses the render-time
  `getElementById` idiom — inert today (gated on `doc`), but the exact latent
  shape the portal-hydration rule warns about. Candidate cleanup; flagged
  separately.
- The pure modules (`transform.ts`/`geometry.ts`/`project-io.ts`) have no unit
  tests. Not a STANDARDS requirement, and a drop-in test is non-trivial here:
  the existing `scripts/*.test.mjs` runner resolves only relative imports, but
  `transform.ts`/`document.ts` use VALUE imports through the `@/` alias and
  `project-io.ts` is coupled to `localStorage` — so covering the
  regression-prone validator needs either a path-alias loader or a small
  refactor. Left as a candidate follow-up rather than done half-way.
