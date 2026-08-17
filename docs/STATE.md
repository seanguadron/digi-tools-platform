# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-08-17 (end of the "art packs and the Card Studio"
session).

## Now

Branch **`main`**, working tree clean. This session did one thing: **a card's
LOOK separated from what a card DOES**, and the authoring surface grew up to
match.

The problem it solved: art was welded to mechanics. Every card's
`illustration` (path, prompt, status) sat inside the shared catalog next to
what the card does, with a hardcoded `sci-fi` path. There was nowhere for a
fantasy image to live, and `status: "generated"` would have started lying the
moment a second world existed.

1. `7e5b436` **studio thumbnails, hover previews, thirds guides**, plus the
   integration and security findings from the previous session.
2. `32e0a04` **art packs.** 220 `illustration` blocks moved out of
   `roles/cards/archetypes.json` into `art-themes/sci-fi.json`, which stores
   **no path at all** — `scripts/art-pack.mjs` derives every path from (pack
   id, entry key). 98 character **bios** authored and rendered in the card
   inspection panels. `createCardEngine` gained `cardArt`/`cardBio` callbacks
   so one card face serves both decks.
3. `8e6dbf5` **the Card Studio.** `/studio/card-art` → `/studio/cards`, one
   tab per facet of a card (Card · Sci-Fi · Fantasy · Animal), with an
   editable Card tab gated by the real build validator.

**GATES: ALL THREE RUN AND DISCHARGED SAME-DAY** (ledger:
`2026-08-17-{integration,security,design}-gate-*`). What they caught, and
what the third commit fixes: the new write path had no filesystem tests at
all (seven added); `saveCard` and `scaffoldPack` skipped the `assertInside`
containment assertion every other write uses; `scaffoldPack`'s
already-exists check was not atomic with its write, so two clicks could
clobber each other; two separate write queues both fanned out to the same
generated doc, which could tear it and fail the next build (collapsed to one
queue with the render inside it); catalog free text had no length ceiling
where bios had one; and a tab strip announced `role="tablist"` without the
keyboard contract (now the shared `EditorTabs` primitive).

Health: `typecheck` · `lint` · `test` (147) · `data:validate` ·
`check:standards` · `check:security` · **`npm run build`** all green.

**Owed from Sean:**
- **Generate the card swatches.** 3 of 226 exist (Researcher, Analyst,
  Synthesizer). Work through `docs/CRAFT_ART_SCIFI.md`: copy a block →
  generate in Higgsfield → paste into `/studio/cards` → crop → "Use this".
  The studio writes the webp, flips the status, and re-renders the doc.
- Real-mic dictation spot-check on both decks (headless browsers cannot
  grant a mic).

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100. Never start a
  second dev server if one is running; verify inside the running one. Never
  `npm run build` while a dev server may be live (shared `.next/`).
- **If CSS edits stop taking effect** — and they did repeatedly this session,
  so expect it — **or a renamed route 404s with a stale module error:**
  `npm run dev:clean`. Turbopack keeps serving the old stylesheet and keeps
  deleted routes in its graph. Check by reading the rule out of
  `document.styleSheets` before believing a CSS fix did not work.
- **Framework:** read `docs/ARCHITECTURE.md` first. §1 covers the art-pack
  model and the one server surface; §2 the shell contract.
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Authoring:** `/studio/cards` — development-only, 404s in production,
  requires a loopback Host.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex,
  `.claude/skills/` Claude Code; never cross-install.
- **Headless preview gotchas** (2026-07-28 list in SESSIONS.md, all still
  true): IIFE evals, deferred reads after clicks, native value setters for
  controlled inputs, `focusin` not `focus()` for React focus handlers, no
  screenshots at 0×0 viewport, no mic, don't verify hydration in dev.
- **Editing JSON catalogs programmatically:** node with `utf8`; PowerShell
  Get/Set-Content mangles non-ASCII.

## Built

**Six tools** in `src/lib/tool-registry.ts`, plus one unregistered authoring
surface.

- **CRAFT Deck** (`prompt-builder`): C.R.A.F.T. language-model prompts from
  card choices — 35 roles, 32 lineages ×4 grades, 25 archetypes,
  library/share/sessions/dictation/proof lab. Art and bios come from an art
  pack.
- **PICTURE Deck** (`picture-deck`): P.I.C.T.U.R.E. image-model prompts —
  100 lineages ×3 grades, 18 archetypes, Midjourney tail. Still carries its
  illustrations inline; moving it to packs is additive and deferred.
- **Architect Wizard**, **Image Editor**, **Vector Editor**, **Skills Wiki**:
  unchanged this session.
- **Card Studio** (`/studio/cards`): not a tool, not registered, nothing
  links to it. Per-card facet tabs; the Card tab edits catalog text through a
  validator gate; each pack tab holds that world's art workflow and bio.

**The art-pack model** (`docs/ARCHITECTURE.md` §1): a card is two things.
The catalog owns the universal half — id, name, description, mechanics. A
pack (`art-themes/<id>.json`) owns the per-world half — image brief, alt,
bio, status. Packs store no path; `scripts/art-pack.mjs` derives them, which
is what makes a second world a drop-in and why renaming a card cannot orphan
its art. A pack marked `draft` is skipped by the generator and the coverage
check, so scaffolding a world cannot fail the build. Sci-Fi is written;
Fantasy and Animal are planned and scaffoldable from the studio.

## Backlog / in flight

- **In flight: nothing mid-task.**
- **Sean's queue:** swatch generation; real-mic dictation check.
- **Next:** the PICTURE deck onto packs (same model, additive); a pack picker
  in the app (the active pack is a constant in `src/lib/art-pack.ts` today);
  a per-model output formatter; a Pip-Decks-style restyle; the idea-making
  deck.
- **Pending amendments** (`npm run amendments`, owner consent): the standing
  queue, **plus new from today's gates:** (a) §1.1 should say authoring
  surfaces are exempt when nothing links to them; (b) the free-text length
  ceiling now in `card-record.mjs` should become a rule covering both session
  drafts and catalog fields; (c) DESIGN_DIRECTION has no vocabulary for the
  Card Bio (italic, muted, ruled, 240 chars, per-pack, never in the prompt).
- **Non-blocking suggestion from the integration gate:** `src/lib/art-pack.ts`
  imports `scripts/art-pack.mjs`, so a `scripts/` module ships in the client
  bundle. Accepted (one file reaches across; the module is pure and has no
  node built-ins), but the repo's own precedent puts shared browser+node
  logic in `src/lib/`, reached FROM `scripts/`. Worth inverting one day.
- **Pre-existing, still open:** Filters/"Adjust" dialog onto EditorDialog;
  `.image-editor-title-input` focus pattern; image-editor statusbar portal
  idiom chip; agent-eval fixtures vs the gates; prompt-builder proofDraft
  schema widening; `restoreDraft` degradation unit test; vector "Later" list
  (`docs/ROADMAP.md`); `npm run amendments` line-wrap fragility;
  `writeStoredOrThrow` for the architect save path.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. Art briefs:
  `docs/CRAFT_ART_SCIFI.md` (226 entries) and `docs/PICTURE_ART_MANIFEST.md`
  (118). History: `.ai/notes/SESSIONS.md` (newest-first). Rules:
  `docs/STANDARDS.md`. Gate ledger: `.ai/notes/gate-reports/`. Domain
  language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
