# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-08-18, late (the "three worlds" session).

## Now

Branch **`main`**, working tree clean except for `card-art-source/` (see
Owed). Two things happened today, in order: **the sci-fi deck got its real
face**, and then **the other two worlds got their words.**

`62f2e52` **226 Nano Banana Pro images, applied live.** Every sci-fi card
was regenerated at 2K and *selected*, so 226/226 entries are `generated` and
the deck ships with a face. The pipeline ran entirely on this machine
(download PNG → the store's own `addVariant` → local `sharp` webp at 1024px
centred cover q92 → `selectVariant`); the full-resolution originals stay on
disk as variants, so every card can still be re-cropped in the studio. The
borders were the real work: four automated frame detectors each missed real
cases, and what settled it was compositing all 226 onto a magenta ground and
looking. Five framed cards came back clean once the brief described a
*photographic crop with the subject cut off by the picture edge* —
**telling the model what the frame IS beats telling it what to avoid.**

`94ac22a` discharged a gate debt `gate:sweep` surfaced: the relations strip
(`9a63b31`, previous session) had shipped after the 2026-08-17 gate reports
and was never audited. All three gates ran; every finding applied (High:
morph-chain jumps threw keyboard focus to `<body>` — both jump sites now
share `src/lib/reveal-element.ts`, which scrolls, focuses, and honours
reduced motion).

`a9fe6f3` **Fantasy and Superhero became authored worlds** (the owner's
direction: Fantasy = Warcraft-card style, Superhero = comic book). All 226
briefs per pack, bios on the 98 non-grade cards, draft flags OFF, so both
packs sit under the full coverage check and generate their own docs
(`docs/CRAFT_ART_FANTASY.md`, `docs/CRAFT_ART_SUPERHERO.md`). No images were
generated — every entry is `planned` — per the owner's instruction. The
craft that matters:

- **Fantasy** is fully hand-painted Warcraft-TCG style: amber-gold lantern
  light, forest-green/umber darkness, chunky heroic proportions. Roles are
  fantasy specialists (Researcher = loremaster; QA = siege proof-master).
- **Superhero** is bold inked comic: halftone over four-color flats,
  crimson/electric-yellow on indigo night city, framed as a full-bleed
  splash page, with comic-specific exclusions appended after the validator's
  no-text rule (no speech bubbles, caption boxes, sound-effect lettering,
  panel gutters) because the idiom primes exactly that furniture.
- **One object per lineage per world across its whole morph chain** (sci-fi
  survey drone → fantasy scrying orb → superhero searchlight), so morphing
  reads as one card growing in every world. The full-bleed lesson is baked
  into both style paragraphs. All 678 prompts across three worlds are unique
  — a sweep caught 21 superhero prompts echoed from sci-fi and re-dressed
  them.

**Gates on the pack commit** (ledger:
`2026-08-18-{integration,security}-gate-fantasy-superhero-packs`):
Integration PASS (one Low doc-wording fix applied). Security PASS with a
real Medium caught and fixed pre-commit: this session's own read-side fix
(`loadedTheme`) had left writes on the ambient selected theme, so a click in
the tab-switch window could write one pack's bio or bytes into another pack.
`send()` now targets the pack the on-screen entries belong to and
`refresh()` gained a monotonic stale-response guard; browser-verified that
the studio's Save button writes only the pack on screen. Also fixed: the
tab-switch 404 race (image URLs now derive from the manifest's own theme),
and a validator guard refusing backticks in pack free text (they would break
the generated docs' code fences) — proven by injection.

Health: `typecheck` · `lint` · `test` (148) · `data:validate` ·
`check:standards` · `check:security` all green.

**Owed from Sean:**
- **Decide on `card-art-source/` — 2.2GB** (488 PNGs). Uncommitted three
  sessions running. `git add card-art-source && git commit` bakes it into
  history forever; a `.gitignore` entry keeps the repo light and loses the
  candidates on any fresh clone.
- **Review the sci-fi deck** (contact sheets in the session scratchpad:
  `sci-fi-contact-sheet.webp`, `sheet-1..4.webp`; regenerate with
  `contact-sheet.mjs` / `chunk-sheets.mjs`). Any miss is a 2-credit re-roll.
- **Review the Fantasy/Superhero briefs** — in `/studio/cards` (Fantasy /
  Superhero tabs) or by reading `docs/CRAFT_ART_FANTASY.md` and
  `docs/CRAFT_ART_SUPERHERO.md` top to bottom. Generation is 452 × 2 = 904
  credits at Nano Banana Pro 2K if run the same way as sci-fi.
- Real-mic dictation spot-check on both decks (headless browsers cannot
  grant a mic).

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100. Never start a
  second dev server if one is running; verify inside the running one. A
  server started outside the preview tooling will make `preview_start
  {name}` refuse the port — open a tab with `preview_start {url}` instead.
  Never `npm run build` while a dev server may be live (shared `.next/`).
- **If CSS edits stop taking effect**, or a renamed route 404s with a stale
  module error: `npm run dev:clean`. Turbopack keeps serving the old
  stylesheet and keeps deleted routes in its graph.
- **Framework:** read `docs/ARCHITECTURE.md` first. §1 covers the art-pack
  model and the one server surface; §2 the shell contract.
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Authoring:** `/studio/cards` — development-only, 404s in production,
  requires a loopback Host. One tab per world; the studio writes whichever
  pack's rows are on screen, never blindly the selected tab.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex,
  `.claude/skills/` Claude Code; never cross-install.
- **Headless preview gotchas** (2026-07-28 list in SESSIONS.md, all still
  true), plus this session's: card images are `loading="lazy"`, so force
  `loading="eager"` or scroll before reading load state; screenshots fail
  unless the Browser pane is displayed — verify through DOM evals and
  composite proof sheets; `.focus()` on `tabindex="-1"` proves nothing while
  the window is unfocused, but a real `<button>` target can be trusted.
- **Editing JSON catalogs programmatically:** node with `utf8`; PowerShell
  Get/Set-Content mangles non-ASCII.
- **Batch image generation** (Higgsfield MCP): `generate_image_batch` max 12
  requests, `jobs_wait` max 12 jobs / 15s cap; loop is submit 12 → poll →
  land → next 12. Result URLs are `hf_<YYYYMMDD>_<HHMMSS>_<job_id>.png`,
  timestamp shared per batch. Jobs report `model: nano_banana_2`; billing
  confirms Nano Banana Pro at 2 credits.

## Built

**Six tools** in `src/lib/tool-registry.ts`, plus one unregistered authoring
surface.

- **CRAFT Deck** (`prompt-builder`): C.R.A.F.T. language-model prompts from
  card choices — 35 roles, 32 lineages ×4 grades, 25 archetypes,
  library/share/sessions/dictation/proof lab. All 226 cards carry final
  sci-fi art and a bio from the art pack.
- **PICTURE Deck** (`picture-deck`): P.I.C.T.U.R.E. image-model prompts —
  100 lineages ×3 grades, 18 archetypes, Midjourney tail. Still carries its
  illustrations inline; moving it to packs is additive and deferred.
- **Architect Wizard**, **Image Editor**, **Vector Editor**, **Skills Wiki**:
  unchanged this session.
- **Card Studio** (`/studio/cards`): not a tool, not registered, nothing
  links to it. Per-card facet tabs (Card · Sci-Fi · Fantasy · Superhero); a
  relations strip showing the morph chain; the Card tab edits catalog text
  through a validator gate; each pack tab holds that world's art workflow
  and bio editor.

**The art-pack model** (`docs/ARCHITECTURE.md` §1): a card is two things.
The catalog owns the universal half — id, name, description, mechanics. A
pack (`art-themes/<id>.json`) owns the per-world half — image brief, alt,
bio, status. Packs store no path; `scripts/art-pack.mjs` derives them.
**Sci-Fi is complete (226/226 generated). Fantasy and Superhero are fully
authored (226 briefs each, 98 with bios), 0/226 generated.** The app itself
still renders only the active pack, a constant in `src/lib/art-pack.ts`
(sci-fi); the other worlds are reachable through the studio until a pack
picker exists.

## Backlog / in flight

- **In flight: nothing mid-task.**
- **Sean's queue:** the 2.2GB `card-art-source/` decision; sci-fi deck
  review; Fantasy/Superhero brief review; real-mic dictation check.
- **Next:** generate Fantasy + Superhero through the proven pipeline (904
  credits total at NB Pro 2K; the frame QA from the sci-fi run applies
  as-is); a pack picker in the app (the active pack is a constant today);
  the PICTURE deck onto packs (same model, additive); a per-model output
  formatter; a Pip-Decks-style restyle; the idea-making deck.
- **Worth promoting out of the scratchpad:** the frame detector and
  contact-sheet builders (`frame-check.mjs`, `contact-sheet.mjs`,
  `chunk-sheets.mjs`) — the next two generation runs need exactly the same
  QA. `scripts/art-qa.mjs --sheets` would make "did this pack come out
  clean?" a command.
- **Pending amendments** (`npm run amendments`, owner consent): the standing
  queue, plus new from today's gates: (a) §2.2 should name both
  doc-generation families, not just PROMPT_ROLES; (b) an `is*` guard must
  check every field of the type it names (caught twice in one file now);
  (c) a status indicator always pairs colour with a short visible text
  label; (d) a client action that reads pack-scoped data via one
  server-echoed identifier must reuse that identifier for any write it
  triggers; (e) the free-text ceiling rule should name art-pack
  `prompt`/`alt` explicitly.
- **Non-blocking, accepted:** `src/lib/art-pack.ts` imports
  `scripts/art-pack.mjs` (pure, no node built-ins) — the repo's precedent
  would invert it one day.
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
