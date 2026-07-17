<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-16 (end of the "theme-bootstrap relocation" session —
the owner-clicked task chip fixing the React 19 script-tag dev warning).
Touched 2026-07-17: the owner said ship — this commit landed and
`governance/aos-uplift` was merged into `main` (fast-forward).

## Now

Branch **`main`**, which now carries the whole `governance/aos-uplift` line
fast-forwarded through this session's commit (2026-07-17). Working tree
clean; nothing awaiting the owner's word.

**What this session changed:**

1. **The React 19 dev warning is gone.** The no-flash theme bootstrap moved
   1:1 from an inline `<head>` script in `src/app/layout.tsx` into
   `src/components/theme-script.tsx`, which injects the byte-identical
   constant script into the streamed `<head>` via `useServerInsertedHTML`
   (first-party Next API; outside the hydrated React tree, so the warning
   cannot fire; still parse-blocking in `<head>`, so zero-flash first paint
   is preserved). Verified: raw server HTML carries the unescaped script in
   `<head>` before `<body>`; console clean across many full loads;
   light/dark/invalid localStorage restore matrix passes; the toggle still
   writes the key.
2. **STANDARDS §2.4 allowlist RELOCATED (not grown)** with consent: the
   `check-security.mjs` S1 entry and the §2.4 text now name
   `theme-script.tsx`; `layout.tsx` has zero injection primitives. Consent
   basis = the owner-clicked task chip that explicitly scoped the allowlist
   update; the durable §4.1 trace is the 2026-07-16 SESSIONS.md entry
   (required by the integration gate before delivery — the consent machinery
   worked as designed).
3. **The gate agents are CONFIRMED registered** — first session where
   `integration-gate` and `security-gate` ran as real subagent types (the
   2026-07-15 YAML fix took effect). Security: PASS (1 Low, comment applied).
   Integration: FAIL→PASS (stale security-gate.md allowlist mention fixed;
   consent-trace entry added). Reports:
   `.ai/notes/gate-reports/2026-07-16-{security,integration}-gate-theme-script-relocation.md`.

Health: `typecheck`, `lint`, `test` (22), `data:validate`, `check:standards`,
`check:security` all green as of this rewrite.

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one. Never `npm run build` while a dev
  server may be live (shared `.next/`).
- **Framework:** read `docs/ARCHITECTURE.md` before building or changing a
  tool — registry, portal slots, ToolSubbar, useUndoableState/useLocalDraft,
  the add-a-tool recipe. STANDARDS §1.4 gates conformance. The theme
  bootstrap lives in `src/components/theme-script.tsx` (the repo's ONE
  sanctioned `dangerouslySetInnerHTML`, §2.4).
- **Headless preview gotchas:** the pane can report a 0×0 viewport — drive
  and verify via DOM/`javascript_tool`, not screenshots. The Image Editor's
  canvas is RAF-driven (no repaint headless); the Prompt Builder's
  flow-panel carousel scrolls via RAF too — verify state via DOM queries.
  React reads after a `.click()` need a deferred read (setTimeout).
- **Checks:** `npm run typecheck` · `npm run lint` · `npm test` ·
  `npm run data:validate` · `npm run check:standards && npm run check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex (36),
  `.claude/skills/` Claude Code (16 incl. `/digi`); never cross-install.
  Log material skill use: `npm run skill:log -- <skill> "<surface>"`.
- **Gate agents:** `integration-gate`, `security-gate`, `design-gate`
  REGISTER as subagent types (confirmed 2026-07-16) — invoke them directly
  via the Agent tool; they are read-only and save nothing themselves (main
  agent writes the ledger reports).

## Built

Four tools registered in `src/lib/tool-registry.ts` (Prompt Builder,
Architect Wizard, Skills Wiki, Image Editor); the shell contract and shared
primitives are documented in `docs/ARCHITECTURE.md`. The Prompt Builder is
the flagship (C.R.A.F.T. prompts from explicit card choices; see `PRODUCT.md`
+ `CONTEXT.md`).

**Prompt Builder catalog:** 35 roles, 32 card lineages (4 grades each), 8
output types, 25 archetypes (daily drivers first, then App build
handoff/Agent skill/Agent gate/Social post at 7–10). The `action-clarify`/ASK
card (grade 1 = the owner's "ask me clarifying questions until you have 95%
confidence" pattern) and `format-tiers`/TIER card are equipped by the
APP/SKILL/GATE archetypes.

**Image Editor:** Photopea-style cockpit — menubar in the context subbar,
tool strip, docked canvas + minimap, tabbed right dock, statusbar in the
global footer, PNG/JPG/layered-.zip export.

**Shared framework:** `ToolSubbar` (+Title/Chip/Actions), `save-status`,
`useUndoableState`, `useLocalDraft`, `ThemeScript`, `EditorMenubar`,
`EditorTabs`+`tabPanelProps`, `zip.ts`, `browser-download.ts`,
`prompt-storage.ts`.

## Backlog / in flight

- **In flight:** nothing. The theme-script relocation commit
  (`fix(theme): relocate the no-flash bootstrap via useServerInsertedHTML`)
  landed 2026-07-17; `governance/aos-uplift` is merged into `main`.
- **Next session:** run the `.ai/agent-evals/` fixtures against the
  registered gates (registration is now CONFIRMED; the fixtures themselves
  have still never run through it) and add fixtures for the newer surfaces
  (image editor, prompt catalog, framework).
- **Archetype card art:** all illustration entries remain `status: planned`.
- **Pending amendments** (`npm run amendments`, owner consent needed): cyan
  as light-theme text color; §2.3 bare-cast hardening; cardSystem affinity
  validator rule; §3.3 "every agent file must carry a gov:node marker"; one
  motion/icon item from earlier sessions.
- **Deferred polish:** unify the "Restoring..." vs "Restoring…" glyph (needs
  owner sign-off); optional `writeStoredOrThrow` for the architect save path;
  output docks + dialog portals + prompt-role-workbench tablist remain the
  sanctioned extraction backlog (ARCHITECTURE §3). gate-sweep's
  `TRIGGERS.security` globs don't cover the check-security allowlist file
  itself — candidate heuristic improvement.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. History:
  `.ai/notes/SESSIONS.md` (newest-first). Rules: `docs/STANDARDS.md`. Gate
  ledger: `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
