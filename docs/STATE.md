# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-08-18, early (the "Nano Banana Pro pass" continuation).

## Now

Branch **`main`**, one commit ahead of the last session, working tree clean
except for `card-art-source/` (see Owed). This session did one thing: **the
CRAFT deck stopped looking like placeholders.**

`62f2e52` **226 Nano Banana Pro images, applied live.** The previous session
generated 226 Seedream candidates and left them all awaiting curation. This
one replaced every card with a Nano Banana Pro 2K render and *selected* it,
so 226/226 entries are now `generated` and the deck ships with a face. 223
pack entries flipped `planned` → `generated`; **no prompt, alt, bio, or
mechanic changed** — the only field touched was `status`.

The pipeline ran entirely on this machine, which is how the owner asked for
it: download the PNG → register it through the store's own `addVariant` →
convert with `sharp` locally (1024px centred cover, q92 — the same transform
the studio's client-side `toLiveWebp` performs) → `selectVariant`. No browser
round-trips; the full-resolution original stays on disk as the variant, so
every card can still be re-cropped in the studio.

**The borders were the real work, and the lesson generalizes.** The art
direction forbids a card frame, but "comic-book" primes panels and panels
have edges, so the model kept drawing mattes. Four automated detectors were
built and each failed for a reason worth remembering:

1. *flat run at any edge* — the direction **asks** for flat dark edges
   ("deep blue-black background", "generous breathing room"), so open sky
   above a subject tripped it and four good cards were cropped. Repaired
   from the PNGs already on disk, at no credit cost.
2. *flat run on all four sides* — a white border with a bevel is not flat.
3. *bright ring on all four sides* — a thin cyan keyline vanishes in the mean.
4. *luminance ridge on all four sides* — closest, still missed two.

What settled it was **looking**: all 226 cards composited onto a magenta
ground, where any drawn edge reads instantly. Five were framed. All five came
back clean once the brief described a *photographic crop with the subject cut
off by the picture edge*, instead of merely listing what not to draw.
**Telling the model what the frame IS beats telling it what to avoid** — the
single most reusable finding of the session, and it applies directly to the
Fantasy and Superhero briefs still to be written.

Health: `typecheck` · `lint` · `test` (148) · `data:validate` ·
`check:standards` · `check:security` all green. Browser-verified in the
already-running dev server: all 39 card images on `/tools/prompt-builder`
load, zero broken, 320×320 natural.

**Gates.** The art commit owed none — no code, component, page, or catalog
mechanics changed, only asset content and a status field. But
`npm run gate:sweep` surfaced a real debt carried over from the *previous*
session: the 2026-08-17 reports were saved at 01:44, and both `b5318c5`
(the Card Studio) and `9a63b31` (the relations strip) landed after them, so
the relations strip had never been gated at all. All three gates were run
against that surface and **every finding is applied** (ledger:
`2026-08-18-{integration,design,security}-gate-card-relations`):

- **Design, High** — jumping along a morph chain unmounted the chip you had
  just activated, so focus fell to `<body>` and a keyboard user lost their
  place. Both this and the flow navigator now share
  `src/lib/reveal-element.ts`, which scrolls, focuses, and honours
  `prefers-reduced-motion` (that last one fixed a pre-existing gap too).
- **Design, Medium** — the relations "live" marker was a wordless dot, so
  colour alone carried the status. It reads "live" now, matching the row
  badge above it.
- **Design, Low** — relation groups are `role="group"` +
  `aria-labelledby`, so "Morphs into" reaches someone browsing by control.
- **Integration, Medium** — three `is*` guards checked fewer fields than the
  type they name, including `progress.generated`, which renders directly.
  All three now check every field.
- **Security** — PASS with three Low findings, all fixed: `setBio` now
  cross-references the catalog like every sibling write op; a malformed key
  answers 400 instead of escaping as a 500; and the pack schema caps
  `prompt`/`alt` (2000/300, measured against shipped maxima of 222/65).
  The gate specifically confirmed the local image pipeline bypassing the
  HTTP route skipped no check that matters — sniffing, the size cap and
  `assertInside` all live in the store, not the route.

One test changed as a result, widened rather than relaxed: `setBio`'s
refusal test now asserts both failure modes and the malformed-key case.

**Owed from Sean:**
- **Decide on `card-art-source/` — it is now 2.2GB** (488 PNGs, up from
  771MB). Still uncommitted and deliberately left out of `62f2e52`.
  `git add card-art-source && git commit` bakes it into history forever; a
  `.gitignore` entry keeps the repo light and loses the candidates on any
  fresh clone. This decision has been open two sessions and is getting more
  expensive to defer.
- **Review the deck.** It is no longer a curation chore — every card is
  applied and coherent. Sheets for eyeballing the whole set at once are in
  the session scratchpad (`sci-fi-contact-sheet.webp`, `sheet-1..4.webp`);
  regenerate with `contact-sheet.mjs` / `chunk-sheets.mjs`. Anything that
  does not land is a 2-credit re-roll in `/studio/cards`.
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
  stylesheet and keeps deleted routes in its graph. Check by reading the rule
  out of `document.styleSheets` before believing a CSS fix did not work.
- **Framework:** read `docs/ARCHITECTURE.md` first. §1 covers the art-pack
  model and the one server surface; §2 the shell contract.
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Authoring:** `/studio/cards` — development-only, 404s in production,
  requires a loopback Host.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex,
  `.claude/skills/` Claude Code; never cross-install.
- **Headless preview gotchas** (2026-07-28 list in SESSIONS.md, all still
  true), plus three learned this session: card images are `loading="lazy"`,
  so a viewport-height check reports every below-the-fold image as
  never-loaded until you scroll or force `loading="eager"`; screenshots fail
  outright unless the Browser pane is actually displayed, so verify through
  DOM evals and composite proof sheets instead; and `.focus()` on a
  `tabindex="-1"` element does NOT move `document.activeElement` while the
  window itself is unfocused — so a body-focus reading on a non-native
  focusable proves nothing, while a real `<button>` target still focuses and
  can be trusted.
- **Editing JSON catalogs programmatically:** node with `utf8`; PowerShell
  Get/Set-Content mangles non-ASCII.
- **Batch image generation** (Higgsfield MCP): `generate_image_batch` takes
  at most 12 requests and `jobs_wait` at most 12 jobs with a 15s cap, so the
  loop is submit 12 → poll → land the finished ones → submit the next 12.
  Result URLs are `hf_<YYYYMMDD>_<HHMMSS>_<job_id>.png` with the timestamp
  shared across a batch. Jobs report `model: nano_banana_2`; the billing
  ledger confirms that is Nano Banana Pro at 2 credits.

## Built

**Six tools** in `src/lib/tool-registry.ts`, plus one unregistered authoring
surface.

- **CRAFT Deck** (`prompt-builder`): C.R.A.F.T. language-model prompts from
  card choices — 35 roles, 32 lineages ×4 grades, 25 archetypes,
  library/share/sessions/dictation/proof lab. **All 226 cards carry final
  sci-fi art and a bio**, both from the art pack.
- **PICTURE Deck** (`picture-deck`): P.I.C.T.U.R.E. image-model prompts —
  100 lineages ×3 grades, 18 archetypes, Midjourney tail. Still carries its
  illustrations inline; moving it to packs is additive and deferred.
- **Architect Wizard**, **Image Editor**, **Vector Editor**, **Skills Wiki**:
  unchanged this session.
- **Card Studio** (`/studio/cards`): not a tool, not registered, nothing
  links to it. Per-card facet tabs; a relations strip showing the morph
  chain; the Card tab edits catalog text through a validator gate; each pack
  tab holds that world's art workflow and bio.

**The art-pack model** (`docs/ARCHITECTURE.md` §1): a card is two things.
The catalog owns the universal half — id, name, description, mechanics. A
pack (`art-themes/<id>.json`) owns the per-world half — image brief, alt,
bio, status. Packs store no path; `scripts/art-pack.mjs` derives them, which
is what makes a second world a drop-in and why renaming a card cannot orphan
its art. A pack marked `draft` is skipped by the generator and the coverage
check, so scaffolding a world cannot fail the build. **Sci-Fi is complete**;
Fantasy and Superhero are scaffolded drafts (art directions written, 226
briefs each still to write).

## Backlog / in flight

- **In flight: nothing mid-task.**
- **Sean's queue:** the 2.2GB `card-art-source/` decision; deck review;
  real-mic dictation check.
- **Next:** author Fantasy + Superhero briefs (226 each; scaffolds + style
  paragraphs are in, `draft:true` keeps the build green), then generate them
  through the same pipeline — **carry the full-bleed lesson into those
  briefs from the start** rather than re-deriving it; the PICTURE deck onto
  packs (same model, additive); a pack picker in the app (the active pack is
  a constant in `src/lib/art-pack.ts` today); a per-model output formatter;
  a Pip-Decks-style restyle; the idea-making deck.
- **Worth promoting out of the scratchpad:** the frame detector and the
  contact-sheet builders are throwaway scripts today, but the next two packs
  need exactly the same QA. `scripts/art-qa.mjs` with a `--sheets` flag
  would make "did this pack come out clean?" a command rather than a
  rebuild-from-memory.
- **Pending amendments** (`npm run amendments`, 19 flagged, owner consent):
  the standing queue, including (a) §1.1 should say authoring surfaces are
  exempt when nothing links to them; (b) the free-text length ceiling in
  `card-record.mjs` should become a rule covering both session drafts and
  catalog fields; (c) DESIGN_DIRECTION has no vocabulary for the Card Bio
  (italic, muted, ruled, 240 chars, per-pack, never in the prompt).
- **Non-blocking suggestion from the integration gate:** `src/lib/art-pack.ts`
  imports `scripts/art-pack.mjs`, so a `scripts/` module ships in the client
  bundle. Accepted (the module is pure and has no node built-ins), but the
  repo's own precedent puts shared browser+node logic in `src/lib/`, reached
  FROM `scripts/`. Worth inverting one day.
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
