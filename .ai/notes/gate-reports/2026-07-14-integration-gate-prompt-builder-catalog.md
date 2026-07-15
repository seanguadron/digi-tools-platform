---
gate: integration
date: 2026-07-14
surface: /tools/prompt-builder — catalog change (2 card lineages, 4 archetypes + reorder, test counts)
result: pass
findings: 0
---

# Integration audit: /tools/prompt-builder — Prompt Builder catalog change (2 card lineages, 4 archetypes + reorder, test counts)

## Result: PASS

| Rule | Status | Evidence | Fix |
|------|--------|----------|-----|
| §1.1 tool registered | PASS (n/a) | No new tool or route; pure data under an already-registered tool. Only `src/data/prompt-builder/{cards,archetypes}.json` + `scripts/prompt-data.test.mjs` changed in scope (`git status` confirms). | — |
| §2.1 catalogs validated | PASS | Both files are existing catalogs registered in `scripts/prompt-data-files.mjs:16-25` (`catalogFiles.cards/.archetypes`); no new `src/data/*.json` added. Test counts updated in the same change (`scripts/prompt-data.test.mjs:12-13,30`: 32/25/128). Re-ran `data:validate` + `node --test scripts/prompt-data.test.mjs`: green, fail 0. | — |
| §2.1 count math | PASS | Independently verified: 30→32 cards (+2), 21→25 archetypes (+4), 120→128 grade illustrations (+2 lineages × 4 grades). | — |
| §2.1 reorder integrity | PASS | Programmatic old-vs-new compare: all 21 surviving archetypes byte-identical (JSON.stringify equality), 0 removed, 4 added (`app-build-handoff`, `agent-skill`, `agent-gate`, `social-post`) at positions 7–10 — exactly the stated "content-unchanged, only moved". | — |
| §2.1 referential integrity | PASS | Validator covers every cross-reference the new data introduces: driver∈section + grades=driver points (`validate-prompt-data.mjs:180-196`), archetype formatCode/roleIds/tracks/equipped section+slot budgets (`:319-362`), unique ids AND codes (`:73-88`), illustration path uniqueness + `/card-art/` + no-text rule (`:222-235`). New archetypes reference the new cards (`action-clarify` ×3, `format-tiers` ×1), which is why cards+archetypes must land together — they do. | — |
| §2.2 generated docs | PASS | `roles.json` untouched; re-ran `check:standards` (regenerates + byte-compares `PROMPT_ROLES.md`): green. | — |
| §2.3 trust boundary | PASS (unchanged) | No import/localStorage code touched. Catalog additions are backward-safe for stored states: `src/lib/prompt-card-system.ts:148` (`sanitizeCardSystemShape`) already drops unknown card ids from old saves/share links/custom archetypes. | — |
| §2.4 no injection primitives | PASS | Re-ran `check:security`: green. New instruction/effect strings are plain text flowing through unchanged text-only paths: `getEquippedInstructions` returns string arrays (`prompt-card-system.ts:121-138`); UI renders via JSX text nodes (`prompt-archetype-toolbar.tsx:200-262`, `prompt-card-workbench.tsx:595`). No markup in any new string. | — |
| §3.1 skill pins | PASS (n/a) | No skill installs/refreshes in this change. | — |
| §3.3 gov graph | PASS | No governance files edited; `check:standards` gov:node validation green. | — |
| §3.4 two skill homes | PASS (n/a) | Neither skill home touched. | — |
| Conventions | PASS | No new files (kebab-case n/a), no components/hooks, no "use client" changes. New cards keep the deck's section grouping (verified: contiguous context→action→format→target runs; `action-clarify` is the last action card, `format-tiers` the last format card) and omit `affinity` → always in deck, as intended. Schema `code` pattern `^[A-Z][A-Z0-9]*$` admits ASK/TIER/APP/SKILL/GATE/SOCIAL; 6-char `SOCIAL` has precedent (`POLISH`). | — |

## Required fixes (ordered)

None.

## Notes

- **typecheck: clean** (`tsc --noEmit`, exit 0, no output).
- **Security-gate "rendered prompt content" clause — judgment: NOT triggered.** The gate table scopes Security to *trust-boundary changes*; the clause's other members (session import/export, localStorage, downloads) are all boundary *mechanisms*, so "rendered prompt content" reads as changes to the rendering path, not additions of first-party, schema-validated, repo-committed catalog strings flowing through unchanged text-only renderers (§2.4's deterministic half re-ran green; the render invariant is untouched). If the owner wants this durable, flag a clarifying amendment via the sessions log — e.g. "pure catalog data through unchanged render paths needs only the deterministic halves" (consent-gated, per §4.1).
- **Design gate: not owed, on the same logic** — no new component and no visual-presence change; new tiles render through the unchanged archetype toolbar (catalog order, no count/slice assumptions, `prompt-archetype-toolbar.tsx:77-81`). Preview verification of the 4 new tiles + reordered rail was performed by the main agent in the live dev server.
- Content spot-checks beyond the pipeline, all consistent: effect strings' card counts match equipped totals (14/14/14/13); the "clarifying interview" effect line appears on exactly the three archetypes equipping `action-clarify`; `social-post` (autonomy 2) correctly omits it; instructions avoid the reserved "Focus on these outcomes" suffix the workbench appends (`prompt-data.test.mjs:33-38`).
