---
gate: integration
date: 2026-08-17
surface: art packs + the Card Studio (the catalog/pack split, /studio/cards, scripts/{art-pack,card-record}.mjs), audited at 32e0a04 + working tree
result: FAIL -> fixes applied, re-verified
findings: 2 FAIL (both fixed) + 3 notes (all applied)
---

# Integration audit: art packs and the Card Studio

| Rule | Verdict |
|---|---|
| §1.1 registration | PASS (exempt) — `/studio/cards` is an authoring surface, not a tool; nothing links to it |
| §1.4 shell contract | PASS (correctly exempt), same carve-out |
| §2.1 catalog/pack coverage | PASS — `art-pack.schema.json` wired into `data:validate`; new tests in `art-pack.test.mjs`, `card-record.test.mjs`, `craft-art-docs.test.mjs` |
| §2.1 store I/O layer | **FAIL — fixed** |
| §2.2 generated docs | PASS — intent verified, not just bytes: `PROMPT_ROLES.md` now redirects to the pack doc instead of printing status, so exactly ONE generated doc quotes it |
| §2.3 trust boundary | PASS — `isCardRecord` / `isPackSummaryList` / `isManifest` shape-check every new payload before it reaches state |
| §2.4 injection | PASS — no new primitive; the allowlist is still just `theme-script.tsx` |
| §3.2 gate ledger | **FAIL — fixed by this report** |
| §3.3 governance graph | PASS — every path named in the edited prose exists |
| conventions | PASS |

## Applied

1. **§2.1 — the new write path had no filesystem tests.** `saveCard`, `setBio`,
   `scaffoldPack`, `readCard` and `listPacks` were exercised by nothing:
   `card-record.test.mjs` covers the pure helpers they wrap, not the writer.
   Seven store-level tests added against a temp root, including the ones that
   matter most — a rejected save writes nothing at all, a save touches only
   its own catalog file, and a scaffolded pack validates against the pack
   schema before it lands.
2. **§3.2 — no ledger entry covered this change.** The newest entries predated
   it (`audited at 65b8298`). This report and its two siblings close that.
3. Three stale "Card Art Studio" comments renamed (`next.config.ts`,
   `check-security.mjs`, `prompt-data-files.mjs`).
4. `ArtPackFile.theme` gained the `draft?: boolean` the schema and the store
   both use.
5. `previewAnchor` in the three floating-panel components now types as
   `ReturnType<typeof getFloatingPanelPosition>`, so the declared shape
   includes the `maxHeight` the panel actually renders. It worked before only
   because TypeScript does not excess-property-check a function-call
   assignment; narrowing it by hand later would have silently dropped the
   clip budget.

## Judgment call, accepted

`src/lib/art-pack.ts` imports `scripts/art-pack.mjs`, so a `scripts/` module
ships in the CRAFT Deck's production client bundle. Confirmed: exactly one
`src/` file reaches across, the module has zero imports and no node built-ins,
and its header documents the triple-runtime reuse it is designed for. The
alternative was two implementations of the path derivation with a test
asserting they agree. Accepted, with the layering suggestion (move it under
`src/lib/`, reached FROM `scripts/`, matching `card-engine.ts`) recorded as a
non-blocking note.

## Proposed amendment (owner consent)

§1.1 is written around "a tool". A line making authoring surfaces explicitly
exempt when nothing links to them would save the next one of these needing a
fresh interpretive call. (Carried over from the 2026-08-17 studio audit.)
