# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-08-19, evening (the "PICTURE is fully illustrated"
session).

## Now

Branch **`main`**, **working tree clean** — `card-art-source/` is gitignored
now (below), so for the first time in four sessions `git status` is empty.
**Both decks are fully illustrated.** Tonight's commit `e29d7a8` closes the
PICTURE art project and reshapes the guide pages of both decks.

**The gallery pack: 426/426 generated.** Every PICTURE card carries art that
DEMONSTRATES the technique it teaches — a watercolor card IS watercolor, a
knolling card IS knolled. 100 lineages + 300 per-grade intensity renders + 18
archetypes + 1 shared swatch + **7 new P.I.C.T.U.R.E. acronym cards**. Same
pipeline as the CRAFT worlds (Nano Banana Pro 2K → frame-check → sharp 1024
centred-cover webp q92); 428 landings including two re-rolls. Quality held up
well: 24 of 428 tripped the land-time auto-crop (all healed), and eyeball QA
on the flag sheets found only two real defects — candlelight[2] had a gray
band down one edge, and low-angle-hero[1] rendered a trench-coated figure
instead of a firefighter and lost the low angle. Both re-rolled and verified.

**Both guide pages were rebuilt** (owner's direction): title and copy on top,
the acronym spelled out below as ONE row of cards, each with its own letter
art above a word capsule — a solid brand-cyan tile holding the acronym letter
with the rest of the word completing it inside one bordered unit, `[C]ontext`.
The old layout hard-coded five columns and wrapped PICTURE's seven letters
mid-acronym; the row is now deck-agnostic (`grid-auto-flow: column`, with
`auto-fit` wrap tiers).

**CRAFT's guide gained a "Card style" tier** — three cards, Sci-Fi / Fantasy /
Superhero, each showing the same **Researcher** in that world's art. Clicking
one reskins the whole deck. This exists because the world switch was
undiscoverable as a dock control; the cards make it a thing you can see. No
new images were generated — these are existing role art.

**The nav dock became a little window.** Grab the handle and push it toward
any corner of the workspace; it snaps there (FLIP settle, 200ms), persists
per browser (`digitools.flow-dock-corner-v1` behind an `isDockCorner` guard),
and moves corner-to-corner on arrow keys. Both decks.

**The role step shows everything.** All 35 roles render by default; the
categories became equal-width filter chips with "All roles" leading. Every
programmatic load path (archetype apply, import, library, share link, reset)
sets "all" rather than jumping to the lead role's category, and picking a role
no longer moves the filter.

**Two owner decisions landed at the end of the session.**
`card-art-source/` is **gitignored** — 9.0GB across 1,416 PNGs against a
`.git` already at 6.2GB, and PNGs do not delta-compress, so committing it
would have weighed down every clone forever. Nothing is lost: the live webps
are committed and every pack entry carries the brief that made its image. 22
files accidentally tracked since the earliest studio commits were removed
from the index (files kept on disk; history deliberately not rewritten). And
**amendment (j) landed in STANDARDS §2.4**: `check:security`'s S1/S2 sweep
now walks `scripts/` as well as `src/`. Its first act was to flag itself —
the file defining the injection patterns necessarily contains them — so the
checker skips that one file, which is the rule declining to match its own
definition, not an exception for anything that ships.

**All four judgment gate runs landed** (ledger:
`2026-08-19-design-gate-guide-acronym-role-filters.md`,
`-integration-gate-picture-pack-guides.md`,
`-security-gate-picture-deck-param.md`, `-design-gate-nav-dock-drag.md`).
The dock's design gate — owed all session after two spend-limit deaths —
finally ran and found 2 High / 3 Medium / 1 Low, all fixed and verified in a
real browser: the 14px grab handle was under the 24px target floor, and a
top-parked dock covered the panel's first heading on every visit. Verifying
that second one exposed a **pre-existing bug worth knowing about:
`--dock-clearance` had never worked at all** — a later `.flow-panel` rule
sets the `padding` shorthand, which silently reset the `padding-bottom`
declared earlier at equal specificity, so the panel reserved 34px instead of
230px and the bottom controls have been sitting under the dock since the
clearance shipped. Fixed, with a comment on why the order matters.

Design FAIL→fixed
(the word capsule's letter tile failed AA in light theme; the acronym row
stranded PICTURE's 7th card mid-width). Integration FAIL→fixed
(ARCHITECTURE.md had gone stale in two places — it still claimed PICTURE
kept inline illustrations and that the dock was pinned bottom-right).
Security FAIL→fixed, 0 High: `setBio` wrote pack bios after only a length
check even though that text is spliced verbatim into a generated markdown
doc, so a newline or backtick could forge a doc entry that the drift check
could never notice; the grade-key index was unbounded; `?deck=__proto__`
reached `Object.prototype` and 500'd instead of 400'ing. One security
finding is **NOT** applied and needs Sean's consent (below).

Health: `typecheck` · `lint` · `test` (150) · `data:validate` ·
`check:standards` · `check:security` all green.

**Owed from Sean:**
- **Feel the dock drag with a real mouse.** Everything else about it is now
  verified in a real 1440×900 browser — corner snap, clearance swap, contrast,
  keyboard moves — but the *feel* of the pointer drag itself still wants a
  human hand.
- **Review the PICTURE deck's art** — open the PICTURE deck and page through;
  the grade art escalates one scene family per card (subtle → committed →
  total). Any miss is a 2-credit re-roll.
- Real-mic dictation spot-check (headless browsers cannot grant a mic).

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100. Never start a
  second dev server if one is running; verify inside the running one. A
  server started outside the preview tooling will make `preview_start
  {name}` refuse the port — open a tab with `preview_start {url}` instead.
  Never `npm run build` while a dev server may be live (shared `.next/`).
  **Routes are `/tools/prompt-builder` and `/tools/picture-deck`** (not
  `/craft` or `/picture`).
- **If CSS edits stop taking effect** (Turbopack serving a stale
  stylesheet): an identical rewrite does NOT jolt it (content-hash dedupe);
  append a real change (a comment), let it recompile, remove the comment,
  then hard-reload the page — or `npm run dev:clean` when the server can be
  restarted.
- **Framework:** read `docs/ARCHITECTURE.md` first. §1 covers the art-pack
  model including the world picker; §2 the shell contract.
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Authoring:** `/studio/cards` (CRAFT) and `/studio/picture` (PICTURE) —
  development-only, 404 in production, require a loopback Host. The picture
  studio has no Card tab: that deck's catalog stays script-managed.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex,
  `.claude/skills/` Claude Code; never cross-install.
- **Headless preview gotchas:** card images are `loading="lazy"` — force
  eager or scroll before reading load state; screenshots fail unless the
  Browser pane is displayed — verify through DOM evals; **the pane can report
  a 0×0 viewport, so `getBoundingClientRect` is useless — assert on computed
  styles and dispatch `.click()` instead**; Next image `src` is URL-encoded
  (`/_next/image?url=%2Fcard-art%2F…`) — `decodeURIComponent` before matching.
- **Editing JSON catalogs programmatically:** node with `utf8`; PowerShell
  Get/Set-Content mangles non-ASCII. Repo files are CRLF — patch scripts must
  match `\r?\n`.
- **Batch image generation** (Higgsfield MCP): `generate_image_batch` max 12
  requests, `jobs_wait` max 12 jobs / 15s cap; loop is submit 12 → 4-5 min
  background timer → poll → land → next 12. Result URLs
  `hf_<YYYYMMDD>_<HHMMSS>_<job_id>.png` — **the trailing underscore belongs to
  the prefix**; timestamps differ ±1-2s per job within one batch, so land
  per-prefix. Queue depth varies: a batch that is still `queued` at 4 minutes
  usually needs another 3. Always end a theme with the pending check
  (worklist minus done-ledger).

## Built

**Six tools** in `src/lib/tool-registry.ts`, plus two unregistered authoring
surfaces.

- **CRAFT Deck** (`prompt-builder`): C.R.A.F.T. language-model prompts from
  card choices — 35 roles, 32 lineages ×4 grades, 25 archetypes,
  library/share/sessions/dictation/proof lab, the world picker (dock + the
  new guide style tier). 226 cards with final art and a bio in each of three
  worlds.
- **PICTURE Deck** (`picture-deck`): P.I.C.T.U.R.E. image-model prompts —
  100 lineages ×3 grades, 18 archetypes, Midjourney tail. **Fully
  illustrated: 426/426 gallery images**, each demonstrating its own card's
  technique, plus flavor lines on every card.
- **Architect Wizard**, **Image Editor**, **Vector Editor**, **Skills Wiki**:
  unchanged this session.
- **Card Studio** (`/studio/cards`, `/studio/picture`): per-card facet tabs,
  relations strip, art workflow + bio editor per pack.

**The art-pack model** (`docs/ARCHITECTURE.md` §1): catalog owns the
universal half (id, name, description, mechanics); a pack
(`art-themes/<id>.json`) owns the per-world half (brief, alt, bio, status);
paths derived by `scripts/art-pack.mjs`. **Four packs, all complete:**
sci-fi, fantasy, superhero (226 each) and gallery (426) — **1,104 images.**
`src/lib/art-pack.ts` owns CRAFT's active-pack seam (plus `packArtFor` for
reading a named pack, which is how the guide's style cards show three worlds
at once); `src/lib/picture-art-pack.ts` is the same minus switching.

## Backlog / in flight

- **In flight: nothing mid-task.**
- **No gates owed.** All four ran and their findings landed.
- **Sean's queue:** the dock drag by hand; PICTURE deck art review;
  real-mic dictation check. (The `card-art-source/` decision and amendment
  (j) both closed 2026-08-19.)
- **Next:** a per-model output formatter; a Pip-Decks-style restyle; the
  idea-making deck.
- **Worth promoting out of the scratchpad:** `frame-check.mjs`,
  `contact-theme.mjs`, and the land pipeline (`make-batch.mjs` /
  `land-theme.mjs`) → `scripts/art-qa.mjs --sheets`. The magenta contact
  sheet + eyeballs stays the definitive check; the bright-ring scan is
  useless on the gallery pack (every card has a different palette by design).
- **Pending amendments** (`npm run amendments`, owner consent): 23 flagged,
  including tonight's — (h) DESIGN_DIRECTION should document the guide's
  stacked acronym row, the word capsule, and the "All roles" browse default;
  (i) the segmented-single-select rule now has a **named exception**: the
  world switch appears twice on CRAFT by owner's direction (dock control +
  illustrated guide tier), so the rule should name the sanctioned surfaces
  rather than forbid duplication outright. Amendment **(j) landed** in §2.4
  with consent (the `scripts/` sweep, above). Amendment (f) should now also
  cover the dock's drag / corner-snap / keyboard interaction, which
  DESIGN_DIRECTION does not mention at all.
- **Non-blocking, accepted:** `src/lib/art-pack.ts` imports
  `scripts/art-pack.mjs`; first-paint flash for returning non-default pack
  users (and the same for a non-default dock corner); the module-level
  active-pack singleton.
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
  `docs/PICTURE_ART_MANIFEST.md` (426). History: `.ai/notes/SESSIONS.md`
  (newest-first). Rules: `docs/STANDARDS.md`. Gate ledger:
  `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
