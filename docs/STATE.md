<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-15 (end of the "core framework unification" session:
orchestration review → docs/ARCHITECTURE.md + STANDARDS §1.4/§2.4 + gate-agent
YAML fix + the shared-chrome extraction).

## Now

Branch **`governance/aos-uplift`**. The two previously-pending bodies of work
are now COMMITTED (6ca8b83 image-editor Photopea cockpit, 87b90cd prompt
catalog expansion). This session's work sits in the tree ready for its two
commits (refactor first, then governance — see In flight) unless they landed
before you read this; `git log` is the truth.

**What this session changed:**

1. **`docs/ARCHITECTURE.md` now exists** — the app framework contract: the
   shell's 3 bars + page stage, the two portal slots
   (`#app-subbar-slot`/`#app-statusbar-slot`), the `.prompt-subbar` +
   `:has()` handshake, `fullBleed`, the add-a-tool recipe, the recyclable
   primitives catalog, globals.css zones, and persistence conventions. Wired
   into the gov graph (AGENTS.md and integration-gate read it); AGENTS.md
   Rule 22 + STANDARDS §1.4 (owner-consented) make shell-contract
   conformance a gated rule.
2. **The three gate agents finally register as subagents.** Root cause found:
   an unquoted `Read-only: it reports` colon-space in their YAML descriptions
   broke frontmatter parsing since 2026-07-04 (sessions.md had no colon —
   that's why only it registered). Fixed (em-dash); all four frontmatters
   parse under js-yaml. **Registration takes effect in a NEW session** — this
   session still ran gates via the general-purpose fallback.
3. **Shared framework primitives extracted** (behavioral+visual no-op,
   browser-proven: per-tool `.prompt-subbar` outerHTML byte-identical
   before/after): `src/components/tool-subbar.tsx` (ToolSubbar/Title/
   SaveStateChip/Actions), `src/lib/save-status.ts`,
   `src/hooks/use-undoable-state.ts`, `src/hooks/use-local-draft.ts`. The six
   per-tool history/persistence hooks are now thin adapters with unchanged
   public APIs; localStorage keys and byte formats untouched (architect
   saved-at stays JSON-quoted; PB/IE raw ISO — see ARCHITECTURE §6).
4. **Governance housekeeping:** §3.3 walker now validates `.claude/agents/*.md`
   gov markers; AGENT_PRINCIPLES.md dangling refs fixed (DESIGN.md →
   DESIGN_DIRECTION.md ×4, /admin/orchestration removed, ARCHITECTURE.md ref
   now real); SETUP.md count 36 + build/`.next` warning; the "pure catalog
   data" Security-gate clarification landed in §2.4 with its sessions flag
   annotated.
5. **Gates:** integration PASS (1 Low, fixed) →
   `.ai/notes/gate-reports/2026-07-15-integration-gate-framework-unification.md`;
   security PASS (1 Low, comment fix applied) →
   `2026-07-15-security-gate-framework-persistence.md`. Design gate not
   triggered (byte-identical DOM = zero visual change; reasoning in the
   integration report).

Health: `typecheck`, `lint`, `test` (22), `data:validate`, `check:standards`,
`check:security` all green as of this rewrite.

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one. Never `npm run build` while a dev
  server may be live (shared `.next/`).
- **Framework:** read `docs/ARCHITECTURE.md` before building or changing a
  tool — registry, portal slots, ToolSubbar, useUndoableState/useLocalDraft,
  the add-a-tool recipe. STANDARDS §1.4 gates conformance.
- **Headless preview gotchas:** the pane can report a 0×0 viewport — drive
  and verify via DOM/`javascript_tool` (element clicks by querySelector,
  state via localStorage/computed style), not screenshots. The Image
  Editor's canvas is RAF-driven (no repaint headless); the Prompt Builder's
  flow-panel carousel scrolls via RAF too, so off-screen panels are
  unreachable by clicks — verify loadout/prompt state via DOM queries.
  React reads after a `.click()` need a deferred read (setTimeout) — state
  commits async.
- **Checks:** `npm run typecheck` · `npm run lint` · `npm test` ·
  `npm run data:validate` · `npm run check:standards && npm run check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex (36),
  `.claude/skills/` Claude Code (16 incl. `/digi`); never cross-install.
  Log material skill use: `npm run skill:log -- <skill> "<surface>"`.
- **Gate agents:** `.claude/agents/{integration,security,design}-gate.md` —
  YAML fixed 2026-07-15; they should register as subagent types in fresh
  sessions. If the Agent tool still rejects the type, fall back to
  general-purpose with the gate's .md contents as instructions (read-only).

## Built

Four tools registered in `src/lib/tool-registry.ts` (Prompt Builder,
Architect Wizard, Skills Wiki, Image Editor); the shell contract and shared
primitives are documented in `docs/ARCHITECTURE.md`. The Prompt Builder is
the flagship (C.R.A.F.T. prompts from explicit card choices; see `PRODUCT.md`
+ `CONTEXT.md`).

**Prompt Builder catalog:** 35 roles, 32 card lineages (4 grades each), 8
output types, 25 archetypes (rail order = array order; daily drivers first,
then App build handoff/Agent skill/Agent gate/Social post at 7–10). The
`action-clarify`/ASK card (grade 1 = the owner's "ask me clarifying
questions until you have 95% confidence" pattern) and `format-tiers`/TIER
card are equipped by the APP/SKILL/GATE archetypes.

**Image Editor:** Photopea-style cockpit — menubar in the context subbar,
tool strip, docked canvas + minimap, tabbed right dock, statusbar in the
global footer, PNG/JPG/layered-.zip export.

**Shared framework:** `ToolSubbar` (+Title/Chip/Actions), `save-status`,
`useUndoableState` (past/future, tag coalescing, seal/jump/depth/position),
`useLocalDraft` (deferred restore w/ cancellation, debounced or sync-write
saves, quota/status machine), `EditorMenubar`, `EditorTabs`+`tabPanelProps`,
`zip.ts`, `browser-download.ts`, `prompt-storage.ts`.

## Backlog / in flight

- **In flight — two commits for this session** (owner approved committing in
  the plan): commit D `refactor(framework): shared ToolSubbar, save-status,
  use-undoable-state, use-local-draft` (the 5 new src/scripts files + 9
  modified tool/hook files), then commit C `feat(governance): ARCHITECTURE.md
  framework contract, gate-agent YAML fix, STANDARDS §1.4 + §2.4` (docs,
  agents, walker, ledger reports, SESSIONS.md, this file). If `git status`
  is clean, both landed.
- **Next fresh session:** confirm the three gate agents appear as subagent
  types; then run the `.ai/agent-evals/` fixtures against the REAL registered
  gates (they have never run through the registration path) and add fixtures
  for the newer surfaces (image editor, prompt catalog, framework).
- **Archetype card art:** all illustration entries remain `status: planned`.
- **Pending amendments** (`npm run amendments`, owner consent needed): cyan
  as light-theme text color (design-gate 2026-07-14); §2.3 bare-cast
  hardening; cardSystem affinity validator rule; §3.3 "every agent file must
  carry a gov:node marker" (new, from the 2026-07-15 integration gate); one
  motion/icon item from earlier sessions.
- **Deferred polish:** unify the "Restoring..." vs "Restoring…" glyph (needs
  owner sign-off — visible label change); optional `writeStoredOrThrow` for
  the architect save path (security-gate note); output docks + dialog
  portals + prompt-role-workbench tablist remain the sanctioned extraction
  backlog (ARCHITECTURE §3).
- **Dev-only console noise:** the theme bootstrap script warning in
  layout.tsx — a spawn-task chip exists for it.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. History:
  `.ai/notes/SESSIONS.md` (newest-first). Rules: `docs/STANDARDS.md`. Gate
  ledger: `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
