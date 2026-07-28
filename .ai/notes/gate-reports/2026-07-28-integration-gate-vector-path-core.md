---
gate: integration
date: 2026-07-28
surface: Vector Editor — path core (ROADMAP V1): pen, direct selection, anchor model, multi-select, menubar
result: PASS
findings: 0 code violations; 2 process items (ledger + STATE freshness, both discharged); 1 Low + 2 doc-freshness applied
---

# Integration gate — Vector Editor path core (V1)

Audited the full V1 diff (2 new lib modules, 6 extended lib modules, 4
rebuilt components, CSS zone additions, 1 new test file) against
docs/STANDARDS.md.

## Result: PASS

| Rule | Status | Note |
|---|---|---|
| §1.1 Registered tool | PASS | Pre-existing registry entry; no new tool id. |
| §1.4 Shell contract | PASS | Header rebuilt on `EditorMenubar` inside `ToolSubbar` (image-editor precedent, old title header fully removed); `usePortalTarget` statusbar; `useLocalDraft`/`useUndoableState`/`EditorTabs` all reused. |
| §2.3 Trust boundary | PASS | Real second validator arm: per-anchor validation, type allowlist with corner fallback, `MAX_ANCHORS` cap applied BEFORE mapping, open≥2/closed≥3 minimums, degrade-not-crash throughout. |
| §2.4 No injection primitives | PASS | `pathToD` builds d from literal M/L/C/Z + rounded numbers only; colors keep `safeColor`+`escapeAttr`. |
| §3.3 gov-graph | PASS | ROADMAP.md marker valid, both `reads=` targets exist, id unique. |
| §5 CSS zone order | PASS | All additions inside the Vector zone, before the mobile-gate zone. |
| Conventions / tests | PASS | Kebab-case; `bezier.ts` deliberately import-free and unit-tested (15 tests) per the ROADMAP's testability rule. |
| §3.2 Gate ledger | was owed | Discharged: this report + the security + design reports (same date). |
| §3.5 STATE freshness | was owed | Discharged: STATE.md rewritten at the V1 commit. |

Applied from this gate's suggestions: anchor-coordinate magnitude clamp in
`project-io.ts` (`clampCoord` ± `MAX_DIMENSION`, also closes the security
gate's sibling finding); ARCHITECTURE.md's stale "EditorMenubar single
importer" line updated; `tool-registry.ts` mobile-gate copy now mentions pen
paths.

All 9 exhaustive switches individually verified to carry the path arm;
`createShape` correctly stays typed over the 4 drag shapes. Deterministic
halves green: typecheck · lint · test (40) · data:validate · check:standards
· check:security.
