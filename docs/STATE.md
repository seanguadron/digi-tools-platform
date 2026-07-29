<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-28 (end of the marathon "defaults rework + full
vector/image roadmap" session).

## Now

Branch **`main`**, working tree clean, six commits from this one session —
the ENTIRE owner-approved `docs/ROADMAP.md` program is built and committed:

1. `58e53f1` **Prompt Builder defaults rework** — recyclable use-default
   MDs (checked-by-default boxes, archetype-authored audience defaults),
   6-panel merge, dictation-meter + dock-collapse fixes, best-name
   downloads. Fully gate-passed (3 agents ran; ledger
   `2026-07-28-*-prompt-builder-defaults.md`).
2. `140aedb` **docs/ROADMAP.md** — the program + four owner decisions.
3. `323a553` **V1 vector path core** — pen (P), white arrow (A), four
   anchor types + convert control, shapes→paths, multi-select/marquee,
   EditorMenubar, artboard-pinned overlay tokens. Fully gate-passed
   (`2026-07-28-*-vector-path-core.md`).
4. `84eada7` **I1 image precision** — confirm-stage crop (handles, thirds,
   numeric X/Y/W/H, aspect presets, keyboard seed, size-ceiling gated),
   Canvas-size dialog (anchor grid), Photoshop-style Image-size
   (units/PPI/resample/interpolation), `ImageDoc.ppi`, shared
   `src/lib/units.ts`. Fully gate-passed (`2026-07-28-*-image-precision.md`).
5. `e5dac08` **V2 vector point text** — Type tool with WYSIWYG in-place
   overlay editing, curated font catalog (validated names), `sanitizeText`
   single enforcement point. Security + design gates passed with findings
   applied; **integration agent BLOCKED mid-run by the provider's monthly
   subagent spend limit** (`2026-07-28-*-vector-text.md`).
6. `3cc425e` **V3 vector documents/units/export** and (the commit carrying
   this rewrite) **I2 image export/new-doc** — artboard setup dialog +
   per-doc unit/PPI + unit-aware statusbar + persisted titles + export
   dialogs on the NEW shared `EditorDialog` primitive (focus trap +
   restore); image New-doc rebuilt with print presets + background choice;
   JPG quality finally adjustable; dead pre-menubar CSS removed.
   **Judgment agents blocked (spend limit)** for both — deterministic
   halves green + inline reviews recorded
   (`2026-07-28-gates-vector-documents.md`,
   `2026-07-28-gates-image-export-newdoc.md`).

7. `9b255bd` **shared roving-tabindex radiogroup helper** —
   `useRovingRadioGroup` adopted at all 9 radiogroup sites (one Tab stop,
   arrows move+select, Home/End, column stepping for the anchor grid),
   closing the systemic a11y gap the design gates kept flagging.
8. (this commit) **gate-debt discharge** — see below.

**GATE DEBT — mostly discharged (2026-07-29).** The integration and
security agents were re-run over the whole owed range once capacity
returned, and their findings are applied:
- **Integration DISCHARGED** for V2+V3+I2 (`2026-07-29-integration-gate-owed-range.md`):
  Medium — the canvas-overlay palette was pinned to a white artboard while
  V3 shipped an editable background; overlays now flip by background
  luminance. Plus the 4× duplicated 12000px ceiling consolidated into
  `units.ts`, an allocation-site clamp in the image `runExport`, a stale
  escaping comment, and an ARCHITECTURE carve-out for closed-by-default
  dialog portals.
- **Security DISCHARGED** for V3+I2 (`2026-07-29-security-gate-owed-range.md`):
  two Mediums — BOTH export paths capped per-side but never total pixels
  (a 6000×6000 doc at 2× legally requested a 144-megapixel canvas). Now
  gated by a shared `MAX_EXPORT_PIXELS` at the dialog AND re-clamped at
  every allocation site; plus a doc-setup clamp parity fix and a
  quality finite-guard.
- **DESIGN for V3+I2 is the ONE gate still owed**
  (`2026-07-29-design-gate-owed-range.md`) — the agent hit the provider
  spend limit again. V2's design gate did complete on 2026-07-28.

Health: `typecheck` · `lint` · `test` (53) · `data:validate` ·
`check:standards` · `check:security` all green. Owed from Sean: the
real-mic dictation-meter spot-check (headless browsers can't grant mic).
The port-5100 dev server was recycled with a cleared `.next` on 2026-07-29
— the stale-error replay is gone; re-run `npm run dev:clean` if CSS edits
ever stop landing again (that symptom recurred once during this session).

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one. Never `npm run build` while a dev
  server may be live (shared `.next/`).
- **If CSS edits stop taking effect (or stale compile errors replay):**
  `npm run dev:clean` (clears `.next`, then dev).
- **`StartDigiTools.bat` health-CHECKS port 5100** (curls it) rather than
  trusting the socket is held, and offers to end a wedged process.
- **Framework:** read `docs/ARCHITECTURE.md` before building or changing a
  tool — registry, portal slots, ToolSubbar, EditorTabs, EditorMenubar,
  **EditorDialog** (the shared modal with focus trap — new dialogs use it),
  useUndoableState / useLocalDraft, the add-a-tool recipe. STANDARDS §1.4
  gates conformance. The theme bootstrap lives in
  `src/components/theme-script.tsx` (the repo's ONE sanctioned
  `dangerouslySetInnerHTML`, §2.4). Any FIRST-render portal must resolve its
  target through `usePortalTarget` (never a render-time DOM read).
- **Checks:** `npm run typecheck` · `lint` · `test` · `data:validate` ·
  `check:standards && check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex (36),
  `.claude/skills/` Claude Code (16 incl. `/digi`); never cross-install.
- **Gate agents:** `integration-gate`, `security-gate`, `design-gate`
  register as subagent types — read-only; the main agent writes the ledger
  reports. **Currently blocked by the monthly subagent spend limit** — see
  GATE DEBT above.
- **Headless preview gotchas** (this list keeps earning its keep):
  - The pane can report a 0×0 viewport — drive/verify via DOM/`javascript_tool`,
    not screenshots (`computer{action:"screenshot"}` may time out).
  - `javascript_tool` keeps top-level `const` declarations across evals on the
    same page — wrap probe scripts in IIFEs. A returned promise that never
    resolves hangs the tool to its 30s timeout — probe-and-return-early. An
    eval that spans a `location.reload()` dies with "target navigated" —
    return BEFORE the reload, read state in the NEXT eval.
  - Canvas/`<img>` work is RAF/decode-driven: poll for blobs, don't assume one
    tick. React reads after a `.click()` need a deferred read (setTimeout).
  - Synthetic `dispatchEvent` sets `event.target` to the element you dispatch
    ON — dispatch pointer events on the actual shape/handle, not the `<svg>`.
  - React controlled inputs need the native value setter + an `input` event
    (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set`).
  - **Don't audit contrast while LIVE-toggling `data-theme`** — set theme via
    localStorage + reload.
  - `window.scrollTo(x,y)` silently no-ops; use
    `scrollTo({ top, behavior: "instant" })`.
  - A stale `.next` Turbopack cache can serve old CSS — and replay stale
    COMPILE ERRORS in the console — indefinitely; fix with `dev:clean`.
  - **Dev is the WRONG place to verify hydration/theme** — use a production
    build. The prompt builder's dev-only `@dnd-kit` hydration warning is
    pre-existing (task chip open).
  - **`requestAnimationFrame` never fires while the preview pane is hidden.**
    A promise awaiting one hangs the eval to its 30s timeout, and any
    rAF-deferred behavior (focus-on-open, deferred measurement) silently
    looks broken. Prefer running such work directly in the effect; when a
    frame is genuinely required, don't try to verify it headlessly.
  - Headless browsers cannot grant mic permission — dictation/audio-meter
    behavior needs a headed browser.
- **Editing `globals.css` / prompt-builder JSON programmatically:** use node
  with `utf8` (em-dashes); PowerShell `Get-Content`/`Set-Content` mangles
  non-ASCII into mojibake. Regexes with control-character classes: write the
  fixer as a SCRIPT FILE (Write tool) — inline `node -e` collapses
  backslashes through the shell and embeds raw control chars.

## Built

**Five tools** registered in `src/lib/tool-registry.ts`; the shell contract
and shared primitives are in `docs/ARCHITECTURE.md`.

- **Prompt Builder** (flagship): C.R.A.F.T. prompts from explicit card
  choices — 35 roles, 32 lineages, 25 archetypes with authored
  `defaultAudience`. Six-panel slider; "Use default" recyclable-MD workflow;
  named downloads.
- **Architect Wizard:** node-canvas architecture sketch → AI build brief.
- **Image Editor:** Photopea-style raster cockpit — layers, filters,
  channels; confirm-stage crop, Canvas/Image-size dialogs with units + PPI;
  print-preset New dialog; Export dialog (PNG/JPG, scale/exact size,
  quality); PNG/JPG/layered-.zip export.
- **Vector Editor:** native-SVG "Illustrator-core" cockpit — pen paths with
  four anchor types, white-arrow editing, point text with in-place editing
  and a curated font catalog, shapes→paths, multi-select, per-doc
  units/PPI, document-setup + export dialogs (SVG/PNG/JPG at any size),
  persisted titles, undo/autosave, pan/zoom/minimap.
- **Skills Wiki:** the document-style reference tool.

**Shared framework:** `ToolSubbar`, `EditorTabs`, `EditorMenubar`,
**`EditorDialog`** (new: portal/backdrop/Esc + focus trap + restore),
`save-status`, `useUndoableState`, `useLocalDraft`, `usePortalTarget`,
`useMediaQuery`, `MobileToolGate`, `zip.ts`, `browser-download.ts`
(`slugifyFilename`: 4 consumers), **`units.ts`** (new: px↔in/cm/mm through
per-doc PPI; import-free, 7 tests), `prompt-storage.ts`,
`prompt-defaults.ts`. Vector pure modules `bezier.ts` (15 tests) and
`text.ts` (6 tests) are import-free/runner-testable by design.

## Backlog / in flight

- **In flight: nothing mid-task.** All commits landed; tree clean.
- **GATE DEBT — one item left:** the DESIGN gate on V3 + I2 (blocked twice
  by the provider spend limit). Integration and security are discharged
  (`2026-07-29-*-owed-range.md`).
- **Task chips open:** stable `DndContext` ids; 24px targets for
  `.image-editor-check` + `.ve-toggle`; `image-editor.tsx` statusbar portal
  idiom (2026-07-19). The roving-tabindex chip was implemented directly in
  the main session (`9b255bd`) — if its worktree session produces a
  duplicate, discard that worktree rather than merging.
- **Owed from Sean:** real-mic dictation-meter spot-check; `dev:clean` on
  the wedged 5100 server.
- **I2 deferrals — CLEARED except one:** ImageSize/CanvasSize migrated onto
  `EditorDialog` (every dialog in both editors now has the focus trap; the
  old per-dialog CSS is gone), and the Space-pan BUTTON exemption landed.
  Still open: custom new-doc preset save.
- **Prompt-builder follow-ups:** proof scenarios with explicit
  context/target text still show "Use default" checked (cosmetic; needs the
  `proofDraft` schema widened); `restoreDraft` degradation unit test
  (blocked on the `@/`-alias runner gap).
- **Vector "Later" list:** gradients, dash/linecap, boolean ops, grouping,
  masks, snapping/smart guides, area text, text-to-outlines, local-space
  numeric edits for rotated objects — `docs/ROADMAP.md` §Later.
- **Still owed from before:** run `.ai/agent-evals/` fixtures against the
  gates; add fixtures for newer surfaces.
- **Pending amendments** (`npm run amendments`, owner consent): the
  standing queue (§2.3 bare-cast, affinity validator, §3.3 agent markers,
  motion/icon, `usePortalTarget`, DESIGN_DIRECTION ambiguities, micro-label
  tier — reinforced repeatedly today) **plus three new from this session's
  gates:** every `readStored<T[]>` list pairs with a shape-validating
  restore; every doc-growing affordance gates on the size ceilings at UI
  AND `document.ts`; every `MAX_*`/`clamp*` invariant gets ONE enforcement
  point covering create/update/load. Also proposed: a DESIGN_DIRECTION
  carve-out for canvas-drawn tool chrome over arbitrary imagery; and (new
  2026-07-29) any bitmap-rasterizing surface enforces a TOTAL pixel ceiling,
  not just per-side, re-clamped at the allocation site.
- **Settled (2026-07-29):** the security gate's open question on coordinate
  clamping — the convention IS document-wide now. `validatePoint` itself
  clamps, so shape positions, polygon points, anchors, and handles all
  inherit one enforcement point; rotation normalizes to one turn. Verified
  with a tampered doc (1e30 coords, 1e12° rotation): everything clamps to
  ±20000 / 280°, no Infinity or NaN reaches the DOM.
- **`npm run amendments` is line-wrap fragile** — candidate fix.
- **Deferred polish:** the sanctioned extraction backlog (ARCHITECTURE §3);
  `writeStoredOrThrow` for the architect save path.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. Feature program:
  `docs/ROADMAP.md` (now fully built; its "Later" section is the live
  wishlist). History: `.ai/notes/SESSIONS.md` (newest-first). Rules:
  `docs/STANDARDS.md`. Gate ledger: `.ai/notes/gate-reports/`. Domain
  language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
