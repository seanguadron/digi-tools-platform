---
gate: integration
date: 2026-07-28
surface: Prompt Builder — panel merge 8->6, use-default draft fields, catalog defaultAudience, named exports
result: FAIL -> PASS
findings: 1 Medium (applied; same defect as the security gate's High) + 2 Low notes
---

# Integration gate — Prompt Builder defaults rework

Per-rule audit of the session's change set (14 modified + 2 new files)
against docs/STANDARDS.md.

## Result: FAIL → PASS

| Rule | Status | Note |
|---|---|---|
| §1.1 Tool registered | PASS | Registry + route untouched, no drift. |
| §1.4 Shell contract | PASS | Reuses `slugifyFilename` (previously Image-Editor-only) instead of new slug logic; portal/subbar/undo/persistence primitives untouched. |
| §5 CSS zone order | PASS | `.workbench-text-row`/`.workbench-default-check` land inside the Prompt Builder zone; Mobile-gate zone stays last; deleted `.flow-subnav`/`.brief-next-card` leave zero dangling references. |
| §2.1 Catalog + schema together | PASS | 25/25 `defaultAudience` present; `builder.json` booleans on both drafts; `prompt-catalog.schema.json` gained the required fields in the same diff; `data:validate` green; presence assertion added to `prompt-data.test.mjs`. |
| §2.2 Generated docs | PASS | roles.json untouched. |
| §2.3 Browser trust boundary | **FAIL → fixed** | `loadSavedPrompt`'s bare `{ ...EMPTY_DRAFT, ...entry.draft }` spread was the last unhardened draft-restore path (the same defect the security gate rated High). Applied: restores through `restoreDraft`/`restoreCardSystem`; library + custom-archetype stores now shape-filter on read. This session also CLOSES the long-standing "restoreDraft remains the open half" §2.3 flag from the 2026-07-16 session — annotated in SESSIONS.md. |
| §2.4 No injection primitives | PASS | Only the sanctioned theme-script.tsx hit remains. |
| §3.3 Gov-graph truth | PASS | DESIGN_DIRECTION.md edit is content-only; marker line untouched. |
| Conventions | PASS | `prompt-defaults.ts` kebab-case, alias-free by design (test-runner loadable), no stray "use client". |
| Test conventions | PASS (Low note) | New pure module fully tested; `withDraftText`/OR-rule/`restoreDraft` hardening untested because `prompt-builder-state.ts` still sits behind the `@/`-alias runner wall (existing backlog item; matches the Vector Editor precedent). |

Low note 2 (optional, deferred to backlog): proof scenarios that carry
explicit context/target text still inherit `contextUseDefault:
true`/`targetUseDefault: true` from `EMPTY_DRAFT`, so the checkbox shows
checked next to explicit text (cosmetic — text always wins in composition).
Aligning them like `exampleDraft` requires widening the separate `proofDraft`
schema def; deferred.

Also credited: `PromptDraftTextField` closes a latent type hole — the old
`Exclude<keyof PromptDraft, "roleIds">` would have typed-accepted a boolean
field with a string value.

## Deterministic half

typecheck · lint · test (25) · data:validate · check:standards ·
check:security — all green after fixes.
