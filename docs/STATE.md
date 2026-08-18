# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-08-18, night (the "all three worlds live" session).

## Now

Branch **`main`**, working tree clean except for `card-art-source/` (see
Owed). **Every world is finished and switchable in the app.** Two commits
tonight on top of the morning's three:

**`feat(art)` — Fantasy and Superhero generated, 452 NB Pro 2K images
live.** Both packs went 0/226 → 226/226 through the same local pipeline as
sci-fi (download PNG → store `addVariant` → frame-check → sharp 1024
centred-cover webp q92 → `selectVariant`; originals kept as studio
variants). QA on magenta contact sheets per world. Fantasy needed 7
re-rolls; superhero needed 31, and its failures came in three families the
sci-fi run never showed: cream *page* borders (the model drawing a printed
comic page), readable text (gauges that said PASS, a slab captioned STORY
SLAB, sound-effects CHIRP/BUZZ), and literal DC/Marvel characters (a
bat-signal, Batman twice, Superman three times, The Flash, an Iron Man
pastiche). The re-roll recipe that cured all three: describe what surfaces
ARE (blank faces, tick-marks only, original heroes with plain geometric
emblems, or "no figures, machinery only") rather than only prohibiting.
Land-time auto-crop healed 70+ thin comic borders without re-rolls — the
detector earned its keep this run.

**`feat(deck)` — the world picker.** A three-way segmented control (Sci-Fi /
Fantasy / Superhero) in the CRAFT deck subbar's middle slot. One click
re-renders the whole deck onto another pack — art and bios resolve at render
time, so there is no per-component wiring and no reload. Persists per
browser (`digitools.prompt-builder.art-pack-v1`) behind the `isArtPackId`
guard; tampered values degrade to the sci-fi default. All three judgment
gates ran on it (ledger: `2026-08-18-{design,integration,security}-gate-
art-pack-picker.md`): Security PASS (one accepted Low — the module-level
active-pack singleton is race-free until Suspense ever wraps the deck),
Integration PASS, Design FAIL→fixed (the first draft invented a 999px-pill
segmented control; restyled onto the app's `.editor-dialog-seg` idiom and
browser-verified at 900/768/phone). ARCHITECTURE.md §1 now documents the
picker and the persistence contract.

Known accepted behavior: a returning Fantasy/Superhero user briefly sees
sci-fi paint first (the saved pack applies after the mount effect, same
deferred-restore pattern as saved prompts). A theme-script-style
pre-hydration snippet is the fix if it ever grates.

Health: `typecheck` · `lint` · `test` (148) · `data:validate` ·
`check:standards` · `check:security` all green.

**Owed from Sean:**
- **Decide on `card-art-source/` — now ~3 sessions of originals** (sci-fi +
  fantasy + superhero full-res PNGs). `git add card-art-source && git
  commit` bakes it into history forever; a `.gitignore` entry keeps the repo
  light and loses the re-crop candidates on any fresh clone.
- **Review the two new decks** — fastest in the app itself now: open the
  CRAFT deck, click Fantasy, click Superhero. Contact sheets also in the
  session scratchpad (`fantasy-sheet.webp`, `sup-sheet-1..4.webp`,
  `sup-rerolls-verify.webp`). Any miss is a 2-credit re-roll.
- Real-mic dictation spot-check (headless browsers cannot grant a mic).

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100. Never start a
  second dev server if one is running; verify inside the running one. A
  server started outside the preview tooling will make `preview_start
  {name}` refuse the port — open a tab with `preview_start {url}` instead.
  Never `npm run build` while a dev server may be live (shared `.next/`).
- **If CSS edits stop taking effect** (Turbopack serving a stale
  stylesheet): an identical rewrite does NOT jolt it (content-hash dedupe);
  append a real change (a comment), let it recompile, remove the comment,
  then hard-reload the page — or `npm run dev:clean` when the server can be
  restarted.
- **Framework:** read `docs/ARCHITECTURE.md` first. §1 covers the art-pack
  model *including the world picker*; §2 the shell contract.
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Authoring:** `/studio/cards` — development-only, 404s in production,
  requires a loopback Host. One tab per world; the studio writes whichever
  pack's rows are on screen.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex,
  `.claude/skills/` Claude Code; never cross-install.
- **Headless preview gotchas** (2026-07-28 list in SESSIONS.md still true):
  card images are `loading="lazy"` — force eager or scroll before reading
  load state; screenshots fail unless the Browser pane is displayed — verify
  through DOM evals; Next image `src` is URL-encoded
  (`/_next/image?url=%2Fcard-art%2F…`) — `decodeURIComponent` before
  matching paths.
- **Editing JSON catalogs programmatically:** node with `utf8`; PowerShell
  Get/Set-Content mangles non-ASCII.
- **Batch image generation** (Higgsfield MCP): `generate_image_batch` max 12
  requests, `jobs_wait` max 12 jobs / 15s cap; loop is submit 12 → 3-min
  background timer → poll → land → next 12. Result URLs
  `hf_<YYYYMMDD>_<HHMMSS>_<job_id>.png`; timestamps can differ ±1s per job
  within one batch — land per-prefix. `nsfw` rejections are random false
  positives on innocuous briefs (~1 per 2 batches); resubmit with a light
  rewording. Always end a theme with the pending check (worklist minus
  done-ledger).

## Built

**Six tools** in `src/lib/tool-registry.ts`, plus one unregistered authoring
surface.

- **CRAFT Deck** (`prompt-builder`): C.R.A.F.T. language-model prompts from
  card choices — 35 roles, 32 lineages ×4 grades, 25 archetypes,
  library/share/sessions/dictation/proof lab, **and the world picker**. All
  226 cards carry final art and a bio in each of three worlds.
- **PICTURE Deck** (`picture-deck`): P.I.C.T.U.R.E. image-model prompts —
  100 lineages ×3 grades, 18 archetypes, Midjourney tail. Still carries its
  illustrations inline; moving it to packs is additive and deferred.
- **Architect Wizard**, **Image Editor**, **Vector Editor**, **Skills Wiki**:
  unchanged this session.
- **Card Studio** (`/studio/cards`): not a tool, not registered. Per-card
  facet tabs (Card · Sci-Fi · Fantasy · Superhero); relations strip; the
  Card tab edits catalog text through a validator gate; each pack tab holds
  that world's art workflow and bio editor.

**The art-pack model** (`docs/ARCHITECTURE.md` §1): catalog owns the
universal half (id, name, description, mechanics); a pack
(`art-themes/<id>.json`) owns the per-world half (brief, alt, bio, status);
paths derived by `scripts/art-pack.mjs`. **All three packs are complete:
226/226 generated each — 678 images total.** The deck renders whichever pack
the picker selects; `src/lib/art-pack.ts` owns the active-pack seam.

## Backlog / in flight

- **In flight: nothing mid-task.**
- **Sean's queue:** the `card-art-source/` decision; Fantasy + Superhero
  deck review (in-app via the picker); real-mic dictation check.
- **Next:** the PICTURE deck onto packs (same model, additive); a per-model
  output formatter; a Pip-Decks-style restyle; the idea-making deck.
- **Worth promoting out of the scratchpad:** `frame-check.mjs`,
  `contact-theme.mjs` (theme-parameterized contact sheets), the bright-ring
  scan, and the land pipeline (`make-batch.mjs`/`land-theme.mjs`) →
  `scripts/art-qa.mjs --sheets`. Note the bright-ring threshold must be
  per-world (110 worked for fantasy's dark edges; superhero's neon edges
  false-positived ~19 of 25 hits — the magenta sheet + eyeballs stays the
  definitive check).
- **Pending amendments** (`npm run amendments`, owner consent): the standing
  queue (§2.2 naming both doc families; `is*` guards checking every field;
  colour+text status indicators; server-echoed identifier reuse for writes;
  free-text ceilings naming pack `prompt`/`alt`), plus new from tonight:
  (f) DESIGN_DIRECTION should document the world-switch control in its CRAFT
  section; (g) segmented single-select controls follow one idiom
  (`.editor-dialog-seg` shape) — the design gate has now caught an invented
  variant twice.
- **Non-blocking, accepted:** `src/lib/art-pack.ts` imports
  `scripts/art-pack.mjs`; the first-paint flash for returning non-default
  pack users; the module-level active-pack singleton (revisit with
  `useSyncExternalStore` only if Suspense ever wraps the deck).
- **Pre-existing, still open:** Filters/"Adjust" dialog onto EditorDialog;
  `.image-editor-title-input` focus pattern; image-editor statusbar portal
  idiom chip; agent-eval fixtures vs the gates; prompt-builder proofDraft
  schema widening; `restoreDraft` degradation unit test; vector "Later" list
  (`docs/ROADMAP.md`); `npm run amendments` line-wrap fragility;
  `writeStoredOrThrow` for the architect save path.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. Art briefs:
  `docs/CRAFT_ART_SCIFI.md` / `docs/CRAFT_ART_FANTASY.md` /
  `docs/CRAFT_ART_SUPERHERO.md` (226 each) and
  `docs/PICTURE_ART_MANIFEST.md` (118). History: `.ai/notes/SESSIONS.md`
  (newest-first). Rules: `docs/STANDARDS.md`. Gate ledger:
  `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
