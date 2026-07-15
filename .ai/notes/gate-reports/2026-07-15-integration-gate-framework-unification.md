---
gate: integration
date: 2026-07-15
surface: core framework unification — docs/ARCHITECTURE.md + STANDARDS §1.4/§2.4 + gate-agent YAML fix + shared ToolSubbar/save-status/useUndoableState/useLocalDraft extraction
result: pass
findings: 1 (Low, fixed before delivery)
---

# Integration audit: DigiTools core framework unification (uncommitted tree — governance/docs + shared-shell extraction; commits 6ca8b83/87b90cd out of scope)

## Result: PASS (1 Low issue)

| Rule | Status | Evidence | Fix |
|------|--------|----------|-----|
| §1.1 registered tools | PASS | No new tool. Registry (`src/lib/tool-registry.ts:17-53`) and routes (`src/app/tools/{prompt-builder,architect-wizard,image-editor,skills}/`) still 4/4; registry untouched by this diff. | — |
| §1.4 shell contract | PASS | All three cockpit tools now portal via the shared `ToolSubbar` (`src/components/tool-subbar.tsx:16-41`): render-time SSR-guarded portal into `#app-subbar-slot`, root `div.prompt-subbar` + per-tool modifier, `data-component="Header:Tool"`, no wrapper. Migrations at `prompt-builder-header.tsx:60-144`, `architect-wizard.tsx:488-611`, `image-editor.tsx:1014-1052` — old hand-rolled portals deleted; grep shows only `app-shell.tsx` (the slot) and `tool-subbar.tsx` reference `app-subbar-slot`. Shared primitives reused, not re-implemented: history hooks are thin adapters over `useUndoableState` (`use-architect-history.ts:23-30`, `use-image-editor-history.ts:27-33`, `use-prompt-builder-history.ts:44-51`), persistence over `useLocalDraft`, chips over `save-status.ts`; three duplicated `getSaveStatusLabel` copies deleted (grep: none remain). `fullBleed` intentional and unchanged. IE keeps its `#app-statusbar-slot` portal (sanctioned, ARCHITECTURE §2). | — |
| §1.4 ARCHITECTURE.md accuracy | PASS | Spot-checked claim-by-claim against code: shell regions + slot ids + `.is-fluid` (`app-shell.tsx:24-92`), chrome vars (`globals.css:22-31`), `display: contents` slots + `:has(.prompt-subbar)` / `:has(.image-editor-statusbar)` handshakes (`globals.css:295-318`), `ToolDescriptor` fields (`tool-registry.ts:7-15`), zone order + boundaries (Welcome ~373, Skills ~544, Prompt Builder 2419, Architect 4757, Image Editor 5844), named exports all exist (`downloadBlob`, `readStored`/`writeStored`, `createZip`/`textZipEntry`, `tabPanelProps`, `skill-copy` in `copy-button.tsx:27`), single-importer caveats true (menubar/tabs/zip → Image Editor only), key patterns `digitools.<tool>.<thing>-v1` true (`use-architect-persistence.ts:14-15`), theme key `digitools.theme` (`app-shell.tsx:19`), §6 saved-at landmine matches code exactly (Architect `writeStored` JSON-quoted; PB/IE raw ISO `setItem`). Route pages are thin server components as claimed. | — |
| §2.1 catalogs validated | PASS | No `src/data/` changes in this diff; `data:validate` green. | — |
| §2.2 generated docs | PASS | `roles.json` untouched; drift check inside `check:standards` green. | — |
| §2.3 trust boundary | PASS | Validated restore paths preserved through the adapters: PB `restoreDraft`/`restoreCardSystem` with corrupt-data key-clear fallback (`use-prompt-builder-persistence.ts:45-73`), Architect `coerceProject` (`use-architect-persistence.ts:174`), IE `deserializeDoc` (`use-image-editor-persistence.ts:41-49`). No new bare casts; failures degrade to defaults (`useLocalDraft` maps restore throw → "unavailable", `use-local-draft.ts:50-54`). Latent audit points `prompt-session.ts`/`prompt-storage.ts` NOT touched. | — |
| §2.4 injection primitives | PASS | No new `eval`/`new Function`/`dangerouslySetInnerHTML`; `check:security` green. §2.4 clarification text landed verbatim per the consented wording (`docs/STANDARDS.md:79-83`). | — |
| §3.1/§3.4 skill pins | PASS | No skill directories added/changed. `docs/SETUP.md:53` count claim "36 skills" verified: `.agents/skills/` has exactly 36 dirs. | — |
| §3.2 gate ledger | PASS | This report is the ledger entry for the surface. | — |
| §3.3 graph truth | PASS | New node `docs/ARCHITECTURE.md:1` (id=architecture, reads=docs/DESIGN_DIRECTION.md — exists); AGENTS.md edge extended (`AGENTS.md:3`); integration-gate edge extended (`.claude/agents/integration-gate.md:8`). All 12 ids unique, every `reads=` target exists. Extended walker (`scripts/check-standards.mjs:53-57`) now covers `.claude/agents/*.md`; all 4 agent files carry markers. `check:standards` green. | — |
| §3.5 session continuity | PASS | STATE.md rewrite + sessions entry completed as part of this session's Phase 5. §2.4 amendment flag annotated "→ landed in §2.4 (2026-07-15)" (`.ai/notes/SESSIONS.md`); `npm run amendments` no longer lists it (5 unrelated flags remain). | — |
| §4.1 consent gate | PASS | Both STANDARDS edits (§1.4 new rule, §2.4 clarification) carry "landed 2026-07-15 with the owner's consent"; consent given in-session via plan approval + AskUserQuestion. The sessions entry records the §1.4 decision for the durable trace. | — |
| Conventions | PASS | New files kebab-case (`save-status.ts`, `tool-subbar.tsx`, `use-undoable-state.ts`, `use-local-draft.ts`, `save-status.test.mjs`); hooks named `use-*`; `"use client"` only where DOM/state demands it — correctly ABSENT from `src/lib/save-status.ts` (pure module, imported by the node test). Composable ToolSubbar parts (Title/Chip/Actions + free children). | — |
| Behavioral no-op fidelity | PASS | Adapter semantics match the deleted originals line-for-line: PB future-queue `unshift/shift` vs shared `push/pop` are both LIFO (identical ordering); IE `isEmpty: doc === null` reproduces the old null guards in checkpoint/undo/redo; IE `"large"` path skips write and doesn't update `lastSavedAt` (commit gates on `outcome === "saved"`, `use-local-draft.ts:82-87`); 1200ms debounce + 4MB budget preserved (`use-image-editor-persistence.ts:16-17`); restore-cancellation returns `null` → gate stays closed, matching the old `cancelled` early-return; PB "Restoring..." (ASCII) default vs IE "Restoring…" override preserved and unit-tested (`scripts/save-status.test.mjs:8-14`). Corroborates the byte-identical-DOM and round-trip browser evidence. | — |
| Doc drift (this session's own scope) | LOW — FIXED | `docs/AGENT_PRINCIPLES.md:225` still read "cites path:line + the **DESIGN.md** rule it violates" after the rest of §8 migrated to DESIGN_DIRECTION.md. | Fixed before delivery: now reads DESIGN_DIRECTION.md. |

## Required fixes (ordered)

1. ~~`docs/AGENT_PRINCIPLES.md:225` DESIGN.md → DESIGN_DIRECTION.md~~ — **applied by the main agent before delivery.**

## Notes

- typecheck: clean. Also green: `check:standards` (with the extended agent-walker), `check:security`, `npm test` 22/22 (18 prior + 4 new save-status tests), `data:validate`.
- ARCHITECTURE.md's "globals.css:22-29" for the chrome variables is a hair narrow — the five declarations begin at 22/23/24/25/29 but the last calc body runs to line 31. All five names are findable in the stated range.
- The §3.3 walker intentionally skips markerless .md files (`check-standards.mjs` `if (!m) continue;`), so a future agent file added without a gov:node marker would silently escape the graph. Candidate amendment: §3.3 additionally requires every `.claude/agents/*.md` to carry a marker (proposed amendment, needs the owner's consent — flagged in the sessions log).
- Browser evidence from the main agent: per-tool `.prompt-subbar` outerHTML byte-identical before/after; undo/redo cycles, template load+undo, persistence save/reload round-trips under unchanged keys, and the image editor's 1200ms debounce all verified in the live dev server.
