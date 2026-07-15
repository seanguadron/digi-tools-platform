<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-14 (end of the Prompt Builder "archetype expansion"
session — the second session of the day; the Image Editor Photopea session's
work is still in the same uncommitted tree).

## Now

Two bodies of UNCOMMITTED work sit on branch **`governance/aos-uplift`** (the
owner has not asked to commit either):

1. **Prompt Builder catalog expansion (this session).** 4 new archetypes —
   **App build handoff** (APP: one self-contained doc an AI agent can build a
   whole app from, modeled on the owner's YABL handoff doc), **Agent skill**
   (SKILL), **Agent gate** (GATE), **Social post** (SOCIAL) — plus 2 new card
   lineages: **`action-clarify`/ASK** (autonomy-driven; grade 1 is the owner's
   "ask me clarifying questions until you have 95% confidence" pattern; at
   interview grades the written Context may stay thin — the questions gather
   it) and **`format-tiers`/TIER** (structure-driven three-tier information
   layering). The archetype rail was reordered: the owner's daily drivers
   (Executive summary, Creative concept, Note taker, Message & email, Prompt
   improver, Learning guide) first, the 4 new ones at 7–10, natural tail.
   Pure data change: `src/data/prompt-builder/{cards,archetypes}.json` +
   count assertions in `scripts/prompt-data.test.mjs` (cards 32, archetypes
   25, grade illustrations 128). Integration gate: **PASS, 0 findings**
   (`.ai/notes/gate-reports/2026-07-14-integration-gate-prompt-builder-catalog.md`);
   Security/Design gates judged not triggered (pure catalog data through
   unchanged render paths — see the report's Notes).

2. **Image Editor Photopea-style cockpit (prior session, same day).** The
   docked menu-bar/tool-strip/tabbed-right-dock redesign described in the
   2026-07-14 image-editor gate reports; all three gates passed after fixes.
   9 new files + 8 modified, unchanged since that session ended.

Health: `typecheck`, `lint`, `test` (18), `data:validate`, `check:standards`,
`check:security` all green as of this rewrite.

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one.
- **Gotchas:** never `npm run build` while a dev server may be live (they
  share `.next/`). The Image Editor's main canvas is RAF-driven and does not
  repaint in the headless preview — verify via DOM/computed-style +
  `javascript_tool` canvas reads. The Prompt Builder's **flow-panel carousel
  also scrolls via RAF/smooth-scroll**, so off-screen panels can't be reached
  by clicks in the headless preview — verify loadout/prompt state via DOM
  queries (`.archetype-button`, slot `strong` names, the live-output `pre`).
- **Checks:** `npm run typecheck` · `npm run lint` · `npm test` ·
  `npm run data:validate` · `npm run check:standards && npm run check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` is the Codex set,
  `.claude/skills/` the Claude Code set; never cross-install.
- **Gate agents:** `.claude/agents/{integration,security,design}-gate.md` may
  not be registered as subagent types in every session; if the Agent tool
  rejects the type, run general-purpose with the gate's .md contents as its
  instructions (read-only), as this session did.

## Built

Four tools are registered in `src/lib/tool-registry.ts` (Prompt Builder,
Architect Wizard, Skills Wiki, Image Editor). The Prompt Builder is the
flagship (C.R.A.F.T. prompts from explicit card choices; see `PRODUCT.md` +
`CONTEXT.md`).

**Prompt Builder — current catalog (this session):** 35 roles, 32 card
lineages (each 4 grades along its driver track), 8 output types, **25
archetypes**. Archetypes are preset C.R.A.F.T. loadouts (array order = rail
order; favorites float). The clarify/tiers cards are equipped by the three
agent/build archetypes (APP, SKILL, GATE) so those interview the user before
producing; Social post stays fast. Data lives in
`src/data/prompt-builder/*.json`, validated by
`scripts/validate-prompt-data.mjs` + `prompt-catalog.schema.json` on
build/commit/CI.

**Image Editor — current surfaces (prior session):** application menu bar in
the context subbar; bottom status bar portaled into the global footer; ~92px
2-column tool strip + FG/BG swatch; docked canvas stage with zoom cluster +
minimap; tabbed right dock (Layers | Channels | Properties | Adjust |
History); PNG/JPG/layered-.zip export. Reusable primitives:
`editor-menubar.tsx`, `editor-tabs.tsx`, dependency-free `src/lib/zip.ts`.

## Backlog / in flight

- **Commit pending** for both bodies of work on `governance/aos-uplift`
  (owner has not asked).
- **Archetype card art:** all new illustration entries are `status: planned`
  (like the rest of the catalog) — generate when the art pass happens.
- **Proposed STANDARDS amendment (owner consent, from the image-editor
  session):** cyan-as-text fails WCAG AA in light theme across 20+ selectors;
  proposal: cyan is a focus/marker/active color, not a light-theme text
  color. See the 2026-07-14 design-gate report. `npm run amendments`.
- **Possible STANDARDS clarification (from this session's gate Notes):**
  "pure catalog data through unchanged render paths needs only the
  deterministic halves" — flag via sessions log if the owner wants it durable.
- **Accepted-as-decorative (image editor):** minimap recenter is pointer-only
  under `aria-hidden`; add a keyboard pan path if full parity is later wanted.

## Pointers

- History: `.ai/notes/SESSIONS.md` (newest-first). Rules:
  `docs/STANDARDS.md`. Gate ledger: `.ai/notes/gate-reports/`. Domain
  language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
