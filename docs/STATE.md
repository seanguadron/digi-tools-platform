<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-19 (end of the "Vector Editor" session — a fifth tool,
native-SVG vector drawing).

## Now

Branch **`main`**. This session added the **Vector Editor**, the fifth
registered tool: a native-SVG vector drawing app (Illustrator-lite, scoped to
"Core shapes + styling"). It is **committed, gate-passed, and green**; working
tree clean.

**What it does.** Draw rectangles, ellipses, lines, and polygons on an SVG
artboard; select and move/resize/rotate (rotation-aware, opposite-corner
anchored) and delete; a **Design** dock panel (fill / stroke / opacity /
X-Y-W-H-rotation) and a **Layers** panel (reorder, lock, hide, delete);
undo/redo, autosave to localStorage with the save chip, pan/zoom + a draggable
minimap, and **SVG + PNG export**. Keyboard: `V/R/O/L/P`, `Delete`, `Esc`,
`Enter` (drop a default shape at the artboard center), `Ctrl/⌘+Z` / `+Shift+Z`.

**Architecture.** A native SVG scene graph — objects render as real SVG
elements, so edit and export are the same artifact (zero conversion). The
model + pure services live in `src/lib/vector-editor/`
(`types`/`document`/`geometry`/`transform`, plus `project-io` persistence and
`svg-export`). The cockpit reuses the shared shell contract — `ToolSubbar` via
`usePortalTarget`, `EditorTabs`, `useUndoableState`, `useLocalDraft`,
`browser-download`, `save-status`, and the `mobileSupport: "gated"` flag — no
shell primitive was reinvented. Same Manager/Worker/Service shape as the Image
Editor.

**How it was built.** Six phases, each verified in the running dev server
before the next: skeleton → draw → select/transform → properties/layers →
undo/autosave/export → pan/zoom/minimap/home. Testing caught **three real bugs
mid-build** — a StrictMode double-commit (side effect in a setState updater), a
`useLocalDraft` restore-callback that wasn't memoized and clobbered live edits
with the last-saved snapshot, and inline-SVG aspect distortion — and one
**injection vector was pre-empted** on the string-built SVG export
(`escapeAttr` + a `safeColor` load allowlist).

**Gates (reports in `.ai/notes/gate-reports/2026-07-19-*`).** Security PASS
(1 Low fixed: numeric size clamp so a tampered doc can't ask the PNG canvas
for a 2e9-px allocation). Integration FAIL→PASS (globals.css zone order — the
tool block must sit BEFORE the mobile-gate zone so the gate's overrides stay
last, §5; and `.button-small` graduated to the shared `.button.button-small`).
Design FAIL→PASS (1 High + 6 Medium + 3 Low: a non-pointer create path via
Enter, toggle `accent-color` + accessible names, a themed `■`/`□` lock glyph
replacing color emoji, `role="application"` on the interactive artboard, and a
re-run WCAG sweep across the previously-unpainted Layers-selected and
Fill/Stroke states — 0 failures both themes).

Health: `typecheck`, `lint`, `test` (22), `data:validate`, `check:standards`,
`check:security` all green as of this rewrite.

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
  useLocalDraft, the add-a-tool recipe (the Vector Editor is a fresh worked
  example). STANDARDS §1.4 gates conformance. The theme bootstrap lives in
  `src/components/theme-script.tsx` (the repo's ONE sanctioned
  `dangerouslySetInnerHTML`, §2.4). Any FIRST-render portal must resolve its
  target through `usePortalTarget` (never a render-time DOM read — that was the
  2026-07-17 hydration/theme bug).
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
  - Canvas/`<img>` work is RAF/decode-driven: `rasterizePng` (SVG→Image→canvas)
    can take >500ms headless — poll for the PNG blob, don't assume one tick.
  - React reads after a `.click()` need a deferred read (setTimeout).
  - Synthetic `dispatchEvent` sets `event.target` to the element you dispatch
    ON, not the element at the coordinates — to exercise hit-testing, dispatch
    pointerdown on the actual shape/handle element, not the `<svg>`.
  - **Don't audit contrast while LIVE-toggling `data-theme`** — buttons
    transition `background-color` over ~150ms, so a quick read catches a
    mid-transition mixed state (false low-contrast). Set the theme via
    localStorage + reload (or wait out the transition).
  - `window.scrollTo(x,y)` silently no-ops (smooth scroll is RAF-driven); use
    `scrollTo({ top, behavior: "instant" })`.
  - A stale `.next` Turbopack cache can serve old CSS indefinitely and survives
    a restart; fix with `rm -rf .next` (gitignored) while stopped.
  - **Dev is the WRONG place to verify hydration/theme** — Fast Refresh
    re-acquires the `<html>` singleton and resets `data-theme`. Use a
    production build (`npm run build` + `npm start`, dev stopped first).
- **Editing `globals.css` programmatically:** use node with `utf8` (the file
  has em-dashes etc.); PowerShell `Get-Content`/`Set-Content` mangles non-ASCII
  into mojibake (seen 2026-07-17).

## Built

**Five tools** registered in `src/lib/tool-registry.ts` (Prompt Builder,
Architect Wizard, Image Editor, **Vector Editor**, Skills Wiki); the shell
contract and shared primitives are in `docs/ARCHITECTURE.md`.

- **Prompt Builder** (flagship): C.R.A.F.T. prompts from explicit card choices —
  35 roles, 32 card lineages, 25 archetypes (see `PRODUCT.md` + `CONTEXT.md`).
- **Architect Wizard:** node-canvas architecture sketch → AI build brief.
- **Image Editor:** Photopea-style raster cockpit; PNG/JPG/layered-.zip export.
- **Vector Editor:** native-SVG vector cockpit (this session) — shapes, transform,
  fill/stroke, layers, undo/autosave, pan/zoom/minimap, SVG+PNG export.
- **Skills Wiki:** the document-style reference tool.

**Shared framework:** `ToolSubbar`, `EditorTabs`/`tabPanelProps`,
`EditorMenubar`, `save-status`/`ToolSaveStateChip`, `useUndoableState`,
`useLocalDraft`, `usePortalTarget`, `useMediaQuery`, `MobileToolGate`,
`zip.ts`, `browser-download.ts`, `prompt-storage.ts`. `EditorTabs` now has two
importers (Image + Vector), a good reuse precedent.

## Backlog / in flight

- **In flight: nothing.** The Vector Editor landed 2026-07-19.
- **Vector Editor v1.1 candidates** (Sean scoped v1 to Core): the **bezier pen**
  + editable **text**, then gradients, boolean path ops, grouping, multi-select
  + marquee, and numeric geometry edits for rotated objects in local space.
- **Vector-editor pure modules have no unit tests** — a drop-in test is blocked
  by the `@/` value-import alias (the `scripts/*.test.mjs` runner resolves only
  relative imports) plus `project-io`'s `localStorage` coupling; needs a
  path-alias loader or a small refactor. `project-io`'s validator is the
  regression-prone piece worth covering.
- **`image-editor.tsx` statusbar portal** still uses the render-time
  `getElementById` idiom (inert — doc-gated — but the latent shape the portal
  rule warns about). Task chip spawned 2026-07-19.
- **Next session (still owed from before):** run the `.ai/agent-evals/`
  fixtures against the registered gates; add fixtures for the newer surfaces.
- **Pending amendments** (`npm run amendments`, owner consent): §2.3 bare-cast
  hardening; cardSystem affinity validator; §3.3 "every agent file carries a
  gov:node marker"; the earlier motion/icon item; the `usePortalTarget`
  first-render-portal rule; the DESIGN_DIRECTION tab-strip / full-bleed-lock
  ambiguities; **new this session** — a design motion-clause scope (hover-color
  transitions vs card motion) and a codified "micro-label 0.58–0.72rem"
  typography tier.
- **`npm run amendments` is line-wrap fragile** — its regex matches line by
  line but SESSIONS.md hard-wraps at ~76 chars, so a flag split across a wrap is
  invisible to the queue. Candidate fix.
- **Deferred polish:** the sanctioned extraction backlog (output docks, dialog
  portals, prompt-role-workbench tablist — ARCHITECTURE §3); `writeStoredOrThrow`
  for the architect save path.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. History: `.ai/notes/SESSIONS.md`
  (newest-first). Rules: `docs/STANDARDS.md`. Gate ledger:
  `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
