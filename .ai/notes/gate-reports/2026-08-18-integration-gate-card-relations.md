---
gate: integration
date: 2026-08-18
surface: the Card Studio's post-art-pack delta — card relations (9a63b31), Fantasy/Superhero scaffolds (e90c35b), Card Studio (b5318c5), audited at 62f2e52
result: FAIL -> fixes applied, re-verified
findings: 2 FAIL (1 code fix applied, 1 ledger debt cleared by this report)
---

# Integration audit: the Card Studio's post-art-pack surface (`/studio/cards`)

Scope: everything in `git diff 32e0a04..62f2e52` touching `src/app/studio`,
`src/app/api/card-art`, `src/components/{card-studio,editor-tabs}.tsx`,
`scripts/{art-pack,card-art-store,card-record,generate-craft-art-docs,validate-prompt-data}.mjs`,
`docs/ARCHITECTURE.md`, and `src/data/prompt-builder/art-themes/*.json`.

**Why this report exists.** `b5318c5` was committed at 01:46; the three
2026-08-17 reports are stamped 01:44 and each says "audited at 32e0a04 +
working tree" — the same tree that became `b5318c5` two minutes later. So
`b5318c5` is substantively covered. The genuinely un-gated delta was
`9a63b31` (card relationships) and `e90c35b` (pack scaffolds, data+docs only).

| Rule | Verdict |
|---|---|
| §1.1 registration | PASS (exempt) — nothing links to `/studio/cards`; `ToolId` still names exactly the six shipped tools |
| §1.4 shell contract | PASS (correctly exempt) — and it still voluntarily reuses `usePortalTarget` and the shared `EditorTabs` |
| §2.1 catalog coverage | PASS — `installedArtPackIds()` auto-discovers the two new packs; both validate at 226/226, `draft: true` |
| §2.2 generated docs | PASS — draft packs correctly emit no doc; `checkDocs` reports no drift |
| §2.3 trust boundary | **FAIL — fixed** |
| §2.4 injection | PASS — relation labels render as JSX text; the `dangerouslySetInnerHTML` allowlist is still `theme-script.tsx` alone |
| §3.2 gate ledger | **FAIL — cleared by this report** |
| §3.3 governance graph | PASS — the Animal→Superhero prose edits are truthful; zero stale "Animal" hits repo-wide |
| conventions | PASS — kebab-case throughout; `"use client"` only on the two interactive components; the route stays a server component |

## Applied

**§2.3 — three type guards checked fewer fields than the type they name.**
Each declared a shape wider than what it verified, the same class of gap the
previous gate closed for `previewAnchor`, and each guarded a field that is
actually read downstream:

- `isManifest` never checked `progress.generated`, which renders directly —
  a response missing it would have printed `"undefined/226"`.
- `isCardRecord` never checked `hasRecord` (branched on) and accepted any
  array for `structural` without checking its elements are `{label, value}`
  (both read unchecked).
- `isPackSummaryList` checked three of the six fields `PackSummary` promises,
  omitting `draft`, `generated`, and `total`.

All three now check every field of the type they name, matching `isEntry` /
`isVariant` / `isRelatedGroup` in the same file. Not exploitable as written —
the server always sends complete objects — but closed before something reads
`pack.draft` trusting the annotation.

## Notes

- Verified rather than assumed: every fix the three 2026-08-17 reports claim
  is still present at HEAD — `assertInside` on both `saveCard` and
  `scaffoldPack`, the single `writeQueue`, `MAX_FIELD_LENGTH = 1200`, the
  shared `EditorTabs`, and the `previewAnchor` typing in the three CRAFT
  floating panels.
- `e90c35b` changed zero lines of application code: two inert JSON files and
  docs prose.
- `buildRelations` is read-only — it walks the already-validated in-memory
  catalog and returns `{key,label}` chips. No new write path.
- Health at the time of writing: `typecheck` · `lint` · `test` (148) ·
  `data:validate` · `check:standards` · `check:security` all green.
- Raised for the owner, not applied: this is the second time this file has
  had a type-guard/type mismatch caught. A STANDARDS line — "an `is*` guard
  must check every field of the type it names" — would make it deterministic
  rather than a gate-by-gate catch. (proposed amendment, needs the owner's
  consent)
