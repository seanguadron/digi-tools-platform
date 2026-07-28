<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-28 (end of the "Prompt Builder defaults rework"
session).

## Now

Branch **`main`**. This session reworked the **Prompt Builder** around Sean's
real workflow — download a prompt `.md` once, recycle it in
Claude/ChatGPT/Gemini by attaching the file and typing the working context in
the chat. The work is **gate-passed and green but NOT yet committed** (the
owner did not ask for a commit); the whole change set sits in the working
tree, and the pre-commit deterministic gates pass.

**What changed (five items, one voice note).**

1. **Dictation audio meter fixed** — only bar 0 ever animated. Root cause: the
   analyser buffer was allocated BEFORE `fftSize` was set (stale 1024-bin
   length, only 32 live). Now `fftSize = 256` first, then allocation, and the
   18 bars average slices of the lower third of the spectrum (voice band).
   ⚠ The one thing this session could not verify: headless browsers can't
   grant mic permission — **needs a quick real-mic spot-check** (all bars
   should pump at varied heights while speaking).
2. **Write/Cards subpages removed** — the slider went 8 panels → 6 (guide,
   context, role, action, format, target). Context and Target audience are
   single panels shaped like Action: card workbench first, then an optional
   custom-text field at the bottom. Proof-scenario `panel` data needed ZERO
   migration (it was authored against the legacy 6-panel layout;
   `getLegacyProofPanel` deleted).
3. **"Use default" checkboxes** on Context and Target (checked by default;
   typing auto-unchecks; unchecked + empty = section missing). With the box
   on and no text, the assembled prompt injects: for CONTEXT an instruction
   deferring to the request accompanying the file; for TARGET AUDIENCE
   "Otherwise assume: {the active archetype's authored `defaultAudience`
   one-liner}" (25 authored in `archetypes.json`, schema-required) or a
   generic infer-and-state fallback. Custom text always wins.
   **Baseline shift:** a fresh reset now shows "2 missing" (Role, Action) —
   C/T/F count complete out of the box.
4. **Named downloads** — best-name chain: archetype → loaded/saved library
   name → lead role → legacy `craft-*` fallback, via the shared
   `slugifyFilename`. E.g. `executive-summary-prompt.md`,
   `landing-page-teardown-session.json`.
5. **Output dock no longer collapses on archetype apply** (one stray
   `setOutputExpanded(false)` deleted; chevron/phone/proof-lab writers kept).

**Gates (ledger: `.ai/notes/gate-reports/2026-07-28-*-prompt-builder-defaults.md`).**
Security FAIL→PASS (High: `loadSavedPrompt` bare-spread bypassed the
hardened restore path — now routes through `restoreDraft`/`restoreCardSystem`
and both `readStored`-backed lists shape-filter on read; Medium + Low also
applied). Integration FAIL→PASS (its Medium was the same defect — and this
session closes the long-standing §2.3 "`restoreDraft` remains the open half"
flag). Design PASS (1 Low applied: 24px checkbox tap target).

Health: `typecheck`, `lint`, `test` (25), `data:validate`, `check:standards`,
`check:security` all green as of this rewrite. Draft schema change is
backward-safe: old saves/shares/library entries inherit the booleans from
`EMPTY_DRAFT`; corrupted/tampered entries degrade to defaults (verified live).

**Same session, second act:** the owner and the agent designed the
**vector + image feature program** — now `docs/ROADMAP.md` (owner-approved,
four scoping decisions recorded there). The owner then said "do it all":
the roadmap is being executed milestone by milestone in this same session,
each gate-passed and committed separately.

**Milestone V1 — vector path core: DONE and committed.** The Vector Editor
is now a real SVG path editor: `path` object kind (anchors with relative
handle offsets), pen tool (P — click corners, drag smooth handles, click the
first anchor to close), white arrow (A — anchor/handle selection + drag,
marquee, double-click a segment to insert an anchor, Alt-drag breaks handle
pairs), four anchor types (corner/smooth/broken/auto) with the Design-tab
convert control, shapes→paths conversion (kappa-exact for
ellipse/rounded-rect), object multi-select (shift-click + marquee, group
move), EditorMenubar (File/Edit/Object), arrow-key nudge, and harmonized
shortcuts (V/A/P/R/O/N/G — N and R/O now match the image editor). The
bezier math lives in `src/lib/vector-editor/bezier.ts` — deliberately
import-free and covered by 15 unit tests. Gates: integration PASS, security
PASS (3 Low applied — finite-guarded formatters, coordinate clamp, bounds
guard), design FAIL→PASS (High applied: canvas overlays now use
artboard-pinned `--ve-overlay-accent`/`--ve-overlay-paper` tokens instead of
theme-reactive cyan — the artboard is always white, the app theme is not;
subbar consolidated to menus + one "Export SVG" primary; ✒ pen glyph
verified monochrome via canvas probe). Ledger:
`2026-07-28-*-vector-path-core.md`.

**Next up: Milestone I1** (image precision pass) — crop confirm-stage,
canvas-size dialog, image-size units/PPI/resample upgrade, shared
`src/lib/units.ts`. Drafts already staged.

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one. Never `npm run build` while a dev
  server may be live (shared `.next/`).
- **If CSS edits stop taking effect:** `npm run dev:clean` (clears `.next`,
  then dev). A stale Turbopack cache can serve old CSS forever — see gotchas.
- **`StartDigiTools.bat` health-CHECKS port 5100** (curls it) rather than
  trusting the socket is held, and offers to end a wedged process.
- **Framework:** read `docs/ARCHITECTURE.md` before building or changing a
  tool — registry, portal slots, ToolSubbar, EditorTabs, useUndoableState /
  useLocalDraft, the add-a-tool recipe. STANDARDS §1.4 gates conformance. The
  theme bootstrap lives in `src/components/theme-script.tsx` (the repo's ONE
  sanctioned `dangerouslySetInnerHTML`, §2.4). Any FIRST-render portal must
  resolve its target through `usePortalTarget` (never a render-time DOM read).
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex (36),
  `.claude/skills/` Claude Code (16 incl. `/digi`); never cross-install.
- **Gate agents:** `integration-gate`, `security-gate`, `design-gate` register
  as subagent types (all three ran this session) — read-only; the main agent
  writes the ledger reports.
- **Headless preview gotchas** (this list keeps earning its keep):
  - The pane can report a 0×0 viewport — drive/verify via DOM/`javascript_tool`,
    not screenshots (`computer{action:"screenshot"}` may time out).
  - `javascript_tool` keeps top-level `const` declarations across evals on the
    same page — wrap probe scripts in IIFEs. A returned promise that never
    resolves (e.g. a `find()` coming back empty inside nested timeouts) hangs
    the tool to its 30s timeout — probe-and-return-early instead.
  - Canvas/`<img>` work is RAF/decode-driven: poll for blobs, don't assume one
    tick. React reads after a `.click()` need a deferred read (setTimeout).
  - Synthetic `dispatchEvent` sets `event.target` to the element you dispatch
    ON — dispatch pointer events on the actual shape/handle, not the `<svg>`.
  - **Don't audit contrast while LIVE-toggling `data-theme`** — 150ms
    background transitions give false mid-transition reads. Set theme via
    localStorage + reload.
  - `window.scrollTo(x,y)` silently no-ops; use
    `scrollTo({ top, behavior: "instant" })`.
  - A stale `.next` Turbopack cache can serve old CSS indefinitely; fix with
    `rm -rf .next` (gitignored) while stopped.
  - **Dev is the WRONG place to verify hydration/theme** — Fast Refresh resets
    `data-theme`; use a production build. Related: the prompt builder logs a
    dev-only hydration warning from `@dnd-kit`'s module-global id counter
    (pre-existing; task chip open to pass stable `DndContext` ids).
  - Headless browsers cannot grant mic permission — dictation/audio-meter
    behavior needs a headed browser.
- **Editing `globals.css` / prompt-builder JSON programmatically:** use node
  with `utf8` (em-dashes); PowerShell `Get-Content`/`Set-Content` mangles
  non-ASCII into mojibake (seen 2026-07-17).

## Built

**Five tools** registered in `src/lib/tool-registry.ts` (Prompt Builder,
Architect Wizard, Image Editor, Vector Editor, Skills Wiki); the shell
contract and shared primitives are in `docs/ARCHITECTURE.md`.

- **Prompt Builder** (flagship): C.R.A.F.T. prompts from explicit card choices —
  35 roles, 32 card lineages, 25 archetypes (each now carrying an authored
  `defaultAudience`). Six-panel guided slider; "Use default" recyclable-MD
  workflow; named downloads. See `PRODUCT.md` + `CONTEXT.md`.
- **Architect Wizard:** node-canvas architecture sketch → AI build brief.
- **Image Editor:** Photopea-style raster cockpit; PNG/JPG/layered-.zip export.
- **Vector Editor:** native-SVG vector cockpit — shapes, transform,
  fill/stroke, layers, undo/autosave, pan/zoom/minimap, SVG+PNG export.
- **Skills Wiki:** the document-style reference tool.

**Shared framework:** `ToolSubbar`, `EditorTabs`/`tabPanelProps`,
`EditorMenubar`, `save-status`/`ToolSaveStateChip`, `useUndoableState`,
`useLocalDraft`, `usePortalTarget`, `useMediaQuery`, `MobileToolGate`,
`zip.ts`, `browser-download.ts` (`slugifyFilename` now has three consumers:
image editor, architect, prompt builder), `prompt-storage.ts`,
`prompt-defaults.ts` (new, alias-free so `scripts/*.test.mjs` can import it).

## Backlog / in flight

- **In flight: nothing mid-task.** The defaults rework is done; the change
  set awaits the owner's commit. Owed from Sean: the real-mic meter
  spot-check. **Next build up:** Milestone V1 (vector path core) per
  `docs/ROADMAP.md` — plan it in its own session before coding.
- **Task chips open (2026-07-28):** stable `DndContext` ids (dev hydration
  warning); 24px tap targets for `.image-editor-check` + `.ve-toggle` (same
  WCAG shortfall the design gate fixed on the new checkbox). Earlier chip:
  `image-editor.tsx` statusbar portal idiom (2026-07-19).
- **Prompt-builder follow-ups:** proof scenarios that carry explicit
  context/target text still show "Use default" checked (cosmetic — text wins;
  aligning them needs the separate `proofDraft` schema def widened). A unit
  test that `restoreDraft`/`loadSavedPrompt` degrade malformed entries is
  blocked on the `@/`-alias test-runner gap (same wall as the vector-editor
  pure modules).
- **Vector + image program:** superseded the old "v1.1 candidates" bullet —
  the full owner-approved feature program lives in `docs/ROADMAP.md`
  (V1 path core → V2 type → V3 units/artboard/export · I1 crop/canvas/size →
  I2 export/new-doc · continuity thread). Local-space numeric edits for
  rotated objects remains a known gap, listed there under "Later".
- **Still owed from before:** run the `.ai/agent-evals/` fixtures against the
  registered gates; add fixtures for the newer surfaces.
- **Pending amendments** (`npm run amendments`, owner consent): §2.3 bare-cast
  hardening; cardSystem affinity validator; §3.3 "every agent file carries a
  gov:node marker"; the motion/icon item; the `usePortalTarget`
  first-render-portal rule; the DESIGN_DIRECTION tab-strip / full-bleed-lock
  ambiguities; the design motion-clause scope; the micro-label 0.58–0.72rem
  typography tier (reinforced again this session); **new this session** —
  every `readStored<T[]>`-backed list must pair with a shape-validating
  restore (`Array.isArray` alone is not §2.3 compliance).
- **`npm run amendments` is line-wrap fragile** — flags split across
  SESSIONS.md's ~76-char wrap are invisible to the queue. Candidate fix.
- **Deferred polish:** the sanctioned extraction backlog (output docks, dialog
  portals, prompt-role-workbench tablist — ARCHITECTURE §3);
  `writeStoredOrThrow` for the architect save path.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. History: `.ai/notes/SESSIONS.md`
  (newest-first). Rules: `docs/STANDARDS.md`. Gate ledger:
  `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
