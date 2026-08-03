<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-08-02 (end of the "PICTURE Deck" session).

## Now

Branch **`main`**, working tree clean apart from this rewrite's own commit.
Ten commits this session built and gated the ENTIRE approved plan
(`C:\Users\seang\.claude\plans\now-very-similar-to-lovely-cookie.md`): a
sixth tool — the **PICTURE Deck**, an image/diffusion-model prompt builder —
plus the display rename of the Prompt Builder to **CRAFT Deck** and the
extraction of a shared card engine that now powers both decks (and any
future deck; the owner's long-term vision is a Pip-Decks-style universal
card-crafting family, next candidate: an idea-making deck).

1. `e54d3dc` **card-engine extraction** — `createCardEngine<S,T,L>` in
   `src/lib/card-engine.ts` owns decks/grades/slots/snap-memory/sanitize;
   CRAFT modules became thin adapters with byte-compatible export surfaces;
   `prompt-builder.tsx` compiled untouched. The engine is alias-free, so
   `scripts/card-engine.test.mjs` (20 tests) finally covers logic the
   @/-alias wall had left untestable.
2. `e59043c` **deck-adjacent generalizations** — floating-panel math,
   `useFlowNavigation`, dictation generics (NoInfer), proof-lab/library
   panels take props, `share-param.ts` codecs.
3. `056d80d` **CRAFT Deck display rename** — registry/name/kicker/CTA/
   metadata/header + prose sweep + PROMPT_ROLES regenerated. Ids, routes,
   storage keys, filenames untouched (drafts and share links survive).
4. `65002f9` **PICTURE data pipeline** — schema (AJV strict), validator
   with referential checks, seed catalog, and the alias-free
   `picture-prompt.ts` merge (tested from day one, unlike CRAFT's).
5. `8917ace` **PICTURE Deck skeleton (Tool 06)** — 8-panel slider
   (guide + P.I.C.T.U.R.E.), engine-driven workbenches, Midjourney tail
   fieldset, dictation on Subject, validated persistence, undo, dock.
6. `5d23190` **full catalog** — 100 lineages ×3 intensity grades
   (P12 I12 C14 T12 U14 R20 E16), 18 archetypes, 8 proof scenarios, and
   `docs/PICTURE_ART_MANIFEST.md` (118 paste-ready Midjourney swatch
   prompts, drift-checked, chained into `data:generate`).
7. `a143c54` **archetype toolbar + custom presets** (tail presets clamp
   through one enforcement point).
8. `743bf7b` **library + share links + sessions** — `?p=` param, session
   files with a `tool: "picture-deck"` discriminator.
9. `5bebe10` **proof lab** (8 scenarios wired).
10. `fa577a4` **gate findings applied** — see GATES below.

**GATES: ALL THREE RUN AND DISCHARGED SAME-DAY** (ledger:
`2026-08-02-{integration,security,design}-gate-picture-deck.md`).
Highlights of what they caught and `fa577a4` fixed, in BOTH decks where
applicable: unvalidated `favorites-v1` reads (route-crashing; new
`readStoredStringArray` helper), custom-archetype shape checks now cover
`equipped`/`effects` (render-phase crash vectors), CRAFT sessions gained the
tool discriminator (a PICTURE import used to silently empty the CRAFT
draft), the tail's UI setter now shares the restore paths' range clamp,
four undefined CSS tokens in the tail fieldset replaced with real system
tokens, the disabled tail redesigned to control-only dimming (labels
measured 8.4:1/7.2:1; whole-body dimming was 2.2:1), the Exclude input
joined the `.field` chrome, ranges got the 24px WCAG floor.

Health: `typecheck` · `lint` · `test` (102) · `data:validate` (both
catalogs) · `check:standards` · `check:security` · **`npm run build`** all
green (build run with the dev server stopped; server restarted after).

**Owed from Sean:**
- **Generate the card swatches**: work through `docs/PICTURE_ART_MANIFEST.md`
  (118 entries, archetypes first; paste prompt → save webp to the listed
  `public/card-art/picture/...` path → flip `status` to `"generated"` →
  `npm run data:generate`). Cards render styled placeholders until then.
- Real-mic dictation spot-check now covers BOTH decks (headless browsers
  can't grant mic).

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is
  already running; verify inside the running one. Never `npm run build`
  while a dev server may be live (shared `.next/`).
- **If CSS edits stop taking effect (or stale compile errors replay):**
  `npm run dev:clean`.
- **Framework:** read `docs/ARCHITECTURE.md` before building or changing a
  tool. The card-deck tools' engine is `src/lib/card-engine.ts`
  (alias-free; instantiated by `prompt-card-system.ts` and
  `picture-card-system.ts`). Any FIRST-render portal resolves its target
  through `usePortalTarget` (the archetype toolbars were the last
  offenders; fixed). The theme bootstrap in
  `src/components/theme-script.tsx` stays the ONE sanctioned
  `dangerouslySetInnerHTML` (§2.4).
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`. `data:generate` regenerates
  PROMPT_ROLES.md AND PICTURE_ART_MANIFEST.md (both drift-checked).
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex,
  `.claude/skills/` Claude Code; never cross-install.
- **Gate agents:** `integration-gate`, `security-gate`, `design-gate`
  subagent types — read-only; the main agent applies fixes and writes the
  ledger. Subagent capacity is available again (three ran today).
- **Headless preview gotchas** (see the 2026-07-28 list in SESSIONS.md;
  all still true): IIFE evals, deferred reads after clicks, native value
  setters for controlled inputs, focusin (not focus()) for React focus
  handlers, no screenshots at 0×0 viewport, no mic, don't verify
  hydration in dev.
- **Editing JSON catalogs programmatically:** node with `utf8`;
  PowerShell Get/Set-Content mangles non-ASCII.

## Built

**Six tools** registered in `src/lib/tool-registry.ts`; shell contract and
shared primitives in `docs/ARCHITECTURE.md`.

- **CRAFT Deck** (id `prompt-builder`): C.R.A.F.T. language-model prompts
  from card choices — 35 roles, 32 lineages ×4 grades, 25 archetypes,
  library/share/sessions/dictation/proof lab.
- **PICTURE Deck** (id `picture-deck`): P.I.C.T.U.R.E. image-model prompts
  — Protagonist · Illumination · Canvas · Tone · Universe · References ·
  Execution. 100 lineages ×3 grades driven by ONE Intensity track,
  18 archetypes with Midjourney tail presets, model-agnostic one-line
  merge + toggleable --ar/--stylize/--chaos/--weird/--no tail, dictation
  on Subject, library/share/sessions/proof lab. Swatch art arrives via
  `docs/PICTURE_ART_MANIFEST.md`; `illustration.status` gates rendering.
- **Architect Wizard**, **Image Editor**, **Vector Editor**, **Skills
  Wiki**: unchanged this session (see their SESSIONS.md history).

**Shared framework additions this session:** `card-engine.ts` (the deck
engine), `floating-panel-position.ts`, `use-flow-navigation.ts`,
`share-param.ts`, `readStoredStringArray` in `prompt-storage.ts`,
generalized `PromptCardWorkbench`/`PromptProofLab`/`PromptLibraryPanel`/
`PromptOutputDock`/`usePromptDictation`/`CraftDictationField`/`FieldHeading`.

## Backlog / in flight

- **In flight: nothing mid-task.** All commits landed; gates discharged.
- **Sean's queue:** swatch generation (see Owed above); real-mic dictation
  check (both decks).
- **PICTURE follow-ups:** CONTEXT.md has no PICTURE vocabulary yet
  (Subject, Intensity dial, tail, panel letters — integration-gate note);
  consider per-panel tuning vocabulary (the engine supports per-key
  vocabulary; PICTURE passes none). Later list from the plan: per-model
  output formatter (SD negative syntax), Pip-Decks family restyle /
  per-letter color coding, the idea-making deck.
- **Pending amendments** (`npm run amendments`, owner consent): the
  standing queue (bare-cast §2.3, affinity validator, §3.3 agent markers,
  motion/icon, `usePortalTarget`, DESIGN_DIRECTION ambiguities,
  micro-label tier, total-pixel ceilings) **plus new from today's gates:**
  (a) every `readStored<T[]>` routes through a shared validated-array
  helper; (b) session/share payloads carry a `tool` discriminator in both
  directions (now true for both decks; make it a rule); (c) a shared
  length ceiling for free-text draft fields; (d) generalize §2.2's
  generated-doc rule to cover PICTURE_ART_MANIFEST (its drift check lives
  in data:validate today, not check:standards).
- **Pre-existing, still open:** Filters/"Adjust" dialog onto EditorDialog;
  `.image-editor-title-input` focus pattern; image-editor statusbar portal
  idiom chip (2026-07-19); agent-eval fixtures vs the gates (the gate
  agents' tool lists in `.claude/agents/*.md` also still say "Prompt
  Builder" and predate Image/Vector/PICTURE — update + re-run evals
  together); prompt-builder proofDraft schema widening; `restoreDraft`
  degradation unit test (alias-runner gap); vector "Later" list
  (`docs/ROADMAP.md`); `npm run amendments` line-wrap fragility;
  `writeStoredOrThrow` for the architect save path.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. The build plan this session
  executed: `C:\Users\seang\.claude\plans\now-very-similar-to-lovely-cookie.md`
  (product decisions + research live there). Swatch manifest:
  `docs/PICTURE_ART_MANIFEST.md`. History: `.ai/notes/SESSIONS.md`
  (newest-first). Rules: `docs/STANDARDS.md`. Gate ledger:
  `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep`
  stamps `.ai/notes/gate-status.json` and warns when this page goes stale.
