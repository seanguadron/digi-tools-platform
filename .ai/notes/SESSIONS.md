# Sessions log

Newest-first ledger of notable decisions, learnings, and preferences —
appended by the sessions agent (see AGENTS.md → Learning loop). Lines ending
with the proposed-amendment flag are STANDARDS candidates;
`npm run amendments` lists the ones not yet annotated "→ landed in §X.Y".

## 2026-07-28: Prompt Builder defaults rework — use-default checkboxes, archetype-aware audience defaults, best-name downloads, dictation/dock fixes

**Context.** Sean's real workflow drove the session: he downloads prompt
Markdown files and reuses them across Claude/ChatGPT/Gemini by attaching
the file and typing the working context directly into the chat. One voice
note bundled five fixes: a frozen dictation audio meter, the Write/Cards
subnav under Context and Target audience ("no one's noticing it"), a "use
default" path so an empty Context/Target still exports a recyclable file,
downloads named after the prompt instead of `craft-prompt.md`, and the
output dock collapsing on archetype clicks.

**Decisions.** All four scoping questions answered via `AskUserQuestion`;
the owner picked the recommended option every time.
- "Use default" checkboxes start CHECKED so a fresh draft is export-ready
  immediately; typing custom text auto-unchecks; unchecked + empty still
  exports; clearing text back out never re-checks the box.
- Default CONTEXT text reads as an instruction TO the AI ("the working
  context is provided outside this file — treat the request that
  accompanies this prompt as the task context...") rather than a fill-in
  placeholder, matching how the file is actually consumed.
- Default TARGET text is archetype-aware: 25 authored `defaultAudience`
  one-liners in `archetypes.json` complete "Otherwise assume: ..."; a
  generic infer-and-state fallback covers no-archetype-active and custom
  presets (which have no authored line).
- Downloads use a best-name chain — archetype name → loaded/saved library
  name → lead role → "craft" fallback — reproducing legacy filenames
  exactly when nothing is active; applied to .md/.txt/.json + the session
  export via the shared `slugifyFilename`.
- Design-model change, `docs/DESIGN_DIRECTION.md` updated in place: 8
  slider panels → 6. Context and Target audience are now single panels
  shaped like Action (card workbench first, optional custom text below);
  the Write/Cards subnav pattern is retired entirely. Completion semantics
  moved with it — C/T count complete when text is present OR use-default
  is on — so a fresh reset now reads "2 missing" (Role, Action), not 4.

**Learnings.**
- The frozen audio meter was a buffer-allocation-order bug:
  `new Uint8Array(analyser.frequencyBinCount)` ran BEFORE `analyser.fftSize
  = 64` was set, sizing the buffer off the default 2048 (1024 bins) while
  only 32 ever filled — bucket math against the stale length only ever
  mapped bar 0 into live data. Fixed by setting `fftSize` (now 256) before
  allocating, plus per-bar averaging over the lower third of the spectrum
  (the voice band). Web Audio buffer sizing depends on analyser config
  applied first — worth a habitual double-check.
- The dock-collapse bug was exactly one line — `setOutputExpanded(false)`
  inside `applyArchetype`, sitting among otherwise-intentional writers of
  the same tri-state. An unintentional write to a shared state setter
  reads identically to an intentional one at a glance.
- The proof-scenario panel fixtures were authored against the LEGACY
  6-panel layout, which `getLegacyProofPanel` translated into the (until
  now) 8-panel one; the new merged 6-panel layout turned out
  byte-identical to that legacy shape, so migrating the fixtures was
  deleting the translator — zero data churn. When a translator function
  exists, check whether the destination shape has quietly become the
  source shape again before assuming a rewrite is needed.
- `@dnd-kit`'s `useUniqueId` is a module-global counter, so SSR ids drift
  from client ids by design — a pre-existing Prompt Builder dev-mode
  hydration warning, predating this session (task-chipped; the fix is
  stable `id` props on `DndContext`).
- Headless-preview harness: `javascript_tool` keeps top-level `const`
  declarations alive across evals on the same page — wrap probe scripts in
  IIFEs. A promise that never resolves (a `find()` returning empty inside
  nested `setTimeout`s) hangs the tool to its 30s timeout; return an early
  probe result instead of assuming elements exist.

**Gates.** Reports in
`.ai/notes/gate-reports/2026-07-28-*-prompt-builder-defaults.md`.
- Security: FAIL → PASS. High — `loadSavedPrompt` restored library entries
  via a bare spread, skipping `restoreDraft`/`restoreCardSystem`; with no
  error boundary anywhere in the app, one corrupted saved entry crashed
  it — fixed by routing through the shared validators and shape-filtering
  both `readStored`-backed lists on read. Medium — custom-archetype
  entries were unvalidated into the new name/audience consumers; fixed the
  same way plus a `typeof` guard in `buildAudienceDefaultLine`. Low —
  `sanitizeCardSystemShape` made null-safe at its own parameter.
- Integration: FAIL → PASS, 1 Medium — the SAME `loadSavedPrompt` defect,
  independently found by both gates. This session also closes the
  2026-07-04 §2.3 "`restoreDraft` remains the open half" flag (see that
  entry, now annotated landed).
- Design: PASS, 1 Low applied — a 24px minimum tap target on the new
  checkbox; two pre-existing sibling checkbox classes with the same
  shortfall were spun off as a task chip rather than fixed inline.
- Two gates converging independently on the same defect (security High =
  integration Medium) is the gate system working as designed — the
  trust-boundary rule and the shell-conformance rule describe the same
  underlying invariant from two angles.

**Preferences / proposed amendments (need owner consent).**
- From the security gate: every `readStored<T[]>`-backed list consumed by
  UI state (prompt-library, prompt-custom-archetypes, and future ones)
  should pair with a shape-validating restore mirroring
  `restoreDraft`/`restoreCardSystem` — `Array.isArray` alone is not §2.3
  compliance. (proposed amendment, needs the owner's consent)
- Sean answers batched option questions decisively — all four
  recommendations accepted this session, continuing the standing
  clarify-to-95%-confidence pattern.
- Voice-note transcripts carry phonetic artifacts worth reading literally
  before asking for clarification ("writing cards" = "Write/Cards", "the
  right option" = "the write option", "contacts" = "context" — all
  resolved correctly this session without re-asking).

One trigger recurred this session, folded into its original entry rather
than duplicated here: the micro-label 0.58–0.72rem typography-tier flag
(2026-07-19 entry, now reinforced a second time by the new use-default
checkbox label — not re-flagged here).

### Second act (same day): vector + image roadmap

**Context.** The same working day continued into a second scoping
session, this time on the two visual-canvas tools rather than the Prompt
Builder. Sean's voice-note brief opened with a tool-by-tool comparison to
a reference product: the vector editor is "pretty basic — it needs to be
way more like Illustrator" — a black arrow and a white arrow, anchor
points with editable handles in his own vocabulary (locked handle, auto
handle, double handle, straight point, and "that chevron icon" to convert
between them), a pen tool, basic shapes, and type. Beyond the vector
tool: the Design tab shows raw pixels but should connect to
inches/centimeters, the image editor's crop couldn't take exact numbers,
and export needed to hit specific resolutions/sizes, including exporting
vector work as a bitmap. The session's output is `docs/ROADMAP.md`; this
entry records the decisions and the why, not the milestone-by-milestone
WHAT, which lives in that doc.

**Decisions.** Four `AskUserQuestion` scoping questions; the owner
accepted the recommended option on all four — the second time in one day
this session ran that exact pattern.
- Build order: Vector path core first (Milestone V1) — the pen tool, the
  white arrow (direct/anchor selection), the anchor-type model,
  shapes-to-paths conversion, and multi-select all land before anything
  else in the program.
- Units: a per-document unit (px/in/cm/mm) plus PPI, stored on the
  document and spoken by panels, dialogs, status bars, and exports in
  BOTH editors; pixels stay the master unit internally, and physical
  units are only ever a mapping through PPI.
- Type tool v1 scope: point text only, edited in place; area text is
  explicitly deferred to later.
- Crop rework: a confirm-stage model — drag a region, then adjust it via
  handles, numeric X/Y/W/H fields, and aspect presets, then Enter applies
  and Esc cancels — replacing today's commit-on-pointer-release drag.

Two decisions of record beyond the four scoping questions: Sean's handle
vocabulary was mapped onto a five-type anchor model — corner / smooth /
broken / auto, plus a convert control — and written into
`docs/ROADMAP.md` as the project's domain language for anchors from here
on; and the roadmap doc itself was created carrying a gov:node marker
(`id=roadmap`, `reads=docs/STATE.md,docs/ARCHITECTURE.md`), so the
deterministic §3.3 graph-accuracy check passes with it from the day it
landed.

**Learnings.** Exploration facts that shaped the design, worth keeping
past this session:
- The vector editor's artboard has NO resize UI at all —
  `createEmptyDocument`'s 960×600 is fixed for the document's life, and
  the Design tab shows it read-only. "Connect the Design tab to
  inches/cm" and "let me set the artboard size" turned out to be one
  feature, not two.
- The vector PNG export silently renders at 2× (`rasterizePng`'s default
  `scale=2`, called with no argument at the call site) into hardcoded
  `vector-artboard.*` filenames — `slugifyFilename` has three consumers
  today, and the vector editor isn't one of them.
- The image editor's `resizeCanvas(doc, w, h, ox, oy)` primitive already
  supports arbitrary anchor offsets but has exactly ONE caller
  (`cropDoc`) and no UI of its own — a canvas-size dialog is mostly
  dialog work; the engine already exists.
- The image crop is one ref inside the canvas component: no state, no
  numbers, no confirm stage — pointer-up IS the commit. Dragging outside
  the canvas is the only path that reaches `resizeCanvas`'s extend
  behavior today — a hidden feature worth making visible.
- Neither editor has any DPI/unit concept anywhere in the codebase — a
  repo-wide grep turned up only `devicePixelRatio` (HiDPI screen backing,
  unrelated to document units).
- Vector hit-testing is delegated entirely to the DOM
  (`closest("[data-object-id]")`) — there is no geometric hit-test
  function anywhere, which is the real new work a pen tool needs (anchor
  picking, point-near-curve).
- The vector modules already run 9 exhaustive switches over the
  shape-kind union — a new `path` kind will fail compilation at every one
  of those integration points, which is the built-in safety net for V1.
- Shortcut collisions exist between the two editors today: `L` means
  lasso in the image editor and line in the vector editor; `P` means
  polygon in the vector editor, exactly where the pen tool needs to
  live — harmonizing them is folded into the roadmap's continuity thread.

**Preferences.**
- Sean opens large feature asks with a tool-by-tool comparison to a
  reference product ("way more like Illustrator") and wants co-design
  rather than a spec handed down — a feature map plus batched scoping
  questions worked well here too. He accepted every recommendation again
  (two-for-two today), reinforcing the standing clarify-to-95%-confidence
  / decisive-batched-answers pattern rather than establishing a new one.

No new proposed-amendment flags from this act — a build-planning session
that produced a roadmap doc, not a rule change; the amendment queue is
unchanged.

### Third act (same day): the roadmap, executed

**Context.** With `docs/ROADMAP.md` in hand (second act), the owner said
"Do it all," then later "keep going" — a full autonomous-execution grant
across the whole program. Six feature milestones shipped in this same
session, each its own commit, alongside the roadmap doc itself:
prompt-builder defaults (58e53f1), `docs/ROADMAP.md` (140aedb), V1 vector
path core (323a553), I1 image precision (84eada7), V2 vector point text
(e5dac08), V3 vector documents/units/export (3cc425e), I2 image
export/new-doc (315c7fa). Every milestone ran the same loop: build →
browser-verify headlessly → gate → apply findings → ledger → commit.

**Decisions.**
- Cadence for a multi-milestone marathon: judgment gates + a ledger entry +
  a surgical STATE.md update per MILESTONE commit, one sessions-log entry
  at the end of the whole session rather than per milestone — kept each
  milestone's diff reviewable without fragmenting the log. Worked well.
- The provider's monthly subagent spend limit killed V2's integration gate
  mid-run. Followed the 2026-07-19 precedent deliberately: deterministic
  halves + main-agent inline review standing in for the judgment half,
  plus an honest OWED ledger note for what the missing gate would have
  covered — V2's integration half, and all three gates for V3 and I2.
  That gap is now the top backlog item, **GATE DEBT**.
- I2 scope call: left the pre-existing ImageSize/CanvasSize dialogs off
  the new shared `EditorDialog` — they'd already been rebuilt and
  gate-passed the same day, and migrating them with no judgment gate
  available (see above) trades real risk for no user-facing gain.
  New/rewritten dialogs (both vector dialogs, the image editor's Export
  and New dialogs) adopt `EditorDialog` from day one; the two older ones
  migrate later, gated.

**Learnings.**
- Gates keep converging independently on the same real defect: I1's
  security Medium and integration Medium were both the missing crop-size
  ceiling, echoing the first act's `loadSavedPrompt` convergence.
  Independent-gate convergence is signal, not coincidence.
- I1's design-gate High: `.image-editor-select`, a generically-named
  class, was already taken by the Layers blend-mode wrapper — CSS is
  additive, so both rules rendered and the collision was invisible until
  a static cascade read caught it. Grep for a class name before coining
  it.
- V2's design gate: a custom property declared on the `<svg>` never
  reached a stage-level SIBLING, and a CSS fallback that happened to
  match the intended value masked the gap silently. Declare shared tokens
  on the common ancestor; don't lean on a fallback that coincidentally
  looks right — it hides exactly this class of bug.
- V2 also: a capture-phase window Enter listener that only exempted
  INPUT/TEXTAREA stole native button activation page-wide. Any global
  key-shortcut listener needs to exempt BUTTON/SELECT too.
- Writing a regex control-character class through `node -e` collapses
  backslashes across the shell layer and can embed raw control characters
  into source, which the tool-approval layer then rejects outright. Write
  the fixer as a script FILE and run it instead (now in STATE's runbook).
- A stale Turbopack cache replayed old COMPILE ERRORS in the console
  indefinitely while serving the already-fixed app; `console.clear()` +
  reload didn't help, only `dev:clean` did. Verify disk + typecheck
  first — don't chase console ghosts.
- A headless eval spanning `location.reload()` dies ("target navigated");
  return before the reload and read again in a fresh eval afterward.

**Preferences / proposed amendments (need owner consent).**
- "Do it all" followed by "keep going" is a full autonomy grant across
  every remaining milestone, including making the per-milestone commits —
  no check-in wanted between milestones.
- Every doc-growing affordance (crop, canvas resize, resample, etc.)
  should gate its size ceiling at BOTH layers — the UI control and the
  underlying pure `document.ts` operation, not one alone.
  (proposed amendment, needs the owner's consent)
- Every `MAX_*`/`clamp*` invariant should have exactly ONE enforcement
  point covering create, update, AND load, not scattered per-call guards.
  (proposed amendment, needs the owner's consent)
- `docs/DESIGN_DIRECTION.md` should carve out canvas-drawn tool chrome
  (artboard overlays, handles, guides) over arbitrary user imagery/color
  as exempt from the theme-reactive-color default — it has to stay
  legible against ANY canvas content, not just the app's own theme
  surfaces.
  (proposed amendment, needs the owner's consent)

The `readStored` shape-validation flag already sits in this entry's first
act, not repeated here.

## 2026-07-19: Vector Editor ships — fifth tool, a native-SVG "Illustrator-lite" built from the Image Editor's shell

**Context.** The owner asked to build an SVG vector editor "like
Illustrator," using the Image Editor as a guide. A clarify round (the
standing clarify-to-95%-confidence preference) settled v1 scope =
**"Core shapes + styling"** (no bezier pen/text yet) and render model =
**native SVG DOM**, not canvas — then the owner said "keep going all
phases."

**Decisions.**
- New tool `vector-editor`, the 5th registry entry — full-bleed,
  mobile-gated, built strictly to the ARCHITECTURE.md add-a-tool recipe.
  Objects are real SVG elements, not canvas pixels, so the edited scene
  and the exported artifact are the same thing.
- Reused every shell primitive rather than reinventing chrome:
  `ToolSubbar` (via `usePortalTarget`), `useUndoableState`,
  `useLocalDraft`, `browser-download`, `save-status`, the mobile gate.
- Shipped across all phases: rect/ellipse/line/polygon draw-by-drag;
  select + move/resize(rotation-aware)/rotate/delete; a Design panel
  (fill/stroke/opacity/transform) and a Layers panel
  (reorder/lock/hide/delete) sharing `EditorTabs`; undo/redo, autosave,
  pan/zoom + minimap, SVG+PNG export; keyboard V/R/O/L/P, Delete, Esc,
  Enter (drop a shape at center), Ctrl/⌘+Z/Y.

**Learnings.**
- Three end-to-end bugs, none visible from a code read alone: (1) draw
  committed TWICE — a side effect (`onDraw`) inside a `setDraft` updater,
  which React double-invokes in dev StrictMode — moved the commit out to
  a ref; (2) fresh edits vanished — the `useLocalDraft` `restore`/`save`
  callbacks were inline (a new identity every render), so the restore
  effect re-ran every render and re-loaded the last-saved snapshot over
  live edits; memoized them, per the hook's own documented call for
  memoized adapters; (3) an inline `<svg>` with `max-width`/`max-height`
  distorted aspect ratio — switched to a full-stage SVG with
  `preserveAspectRatio`, which also set up Phase 5's pan/zoom viewBox
  cleanly.
- A string-built export needs escaping even when the live app is safe:
  the SVG export concatenates colors into attributes; the live React
  render escapes automatically but the export string doesn't — a
  tampered-localStorage color could inject markup into an exported file.
  Pre-empted with `escapeAttr` (serializer) + a `safeColor` allowlist
  (loader); the security gate confirmed the two are redundant-safe.
- "Audit with content" has a second level. The 2026-07-17 lesson (see
  that entry, not restated here) was "audit a populated surface, not the
  empty state." This session the Design gate sharpened it further: a
  *populated* surface can still hide CONDITIONALLY-rendered subtrees —
  the first "0 contrast failures" pass missed `.ve-layer-row.is-selected`
  (needs the Layers tab + a selection) and the Fill/Stroke property
  sub-fields (gated on a non-null fill/stroke). Re-running with those
  painted, both themes, still confirmed 0 — but the gap was real.
- Verification-harness artifacts to distrust, now in STATE.md's gotchas:
  synthetic `dispatchEvent` sets `event.target` to the element
  dispatched-on (not the coordinate target), so hit-testing must dispatch
  on the actual shape/handle element; and live-toggling `data-theme`
  mid-audit catches buttons mid `background-color` transition as a false
  low-contrast reading (set theme via localStorage + reload instead).
- Editing `globals.css` programmatically: use node/utf8, never
  PowerShell `Get-Content`/`Set-Content` (mojibake) — used a node script
  to reorder the CSS zones, with a character-multiset sanity check.

**Gates.** All three ran as real registered subagents; reports in
`.ai/notes/gate-reports/2026-07-19-*-vector-editor.md`.
- Security: PASS (1 Low fixed — clamp validated sizes so a tampered
  width/height can't ask the PNG canvas for a ~2e9-px allocation).
- Integration: FAIL → PASS. (1) The tool's globals.css block was
  appended AFTER the mobile-gate zone, but ARCHITECTURE §5 requires that
  zone stay LAST (its overrides win on source order) — moved the block
  before it. (2) `.button-small` was an unprefixed primitive stranded in
  the tool banner — graduated to shared `.button.button-small` (also
  fixes a specificity loss to `.prompt-flow-header-actions .button`).
- Design: FAIL → PASS (1 High + 6 Medium + 3 Low). High: no non-pointer
  create path — added Enter-to-drop-at-center, mirroring the
  Architect's click-to-add. Medium: toggle `accent-color`, toggle
  accessible names, replace the color-emoji lock glyph with a themed
  `■`/`□`, add `role="application"` to the interactive artboard, and the
  contrast re-sweep above. Low: drop box-shadows for Image-Editor
  parity; delete the dead `.vector-editor-dock-head`.

**Preferences / proposed amendments (need owner consent).**
- The 0.68rem property/dock micro-labels sit under the documented
  0.75rem Caption floor but match a pre-existing undocumented
  micro-label tier (e.g. `.image-editor-field-caption` at 0.62rem) —
  propose codifying a "micro-label 0.58–0.72rem" tier in
  DESIGN_DIRECTION Typography. **Reinforced 2026-07-28:** the Prompt
  Builder defaults session's new use-default checkbox label sits in the
  same tier too — a third independent data point. (proposed amendment,
  needs the owner's consent)

Two more triggers recurred this session; folded into their original
entries rather than duplicated here, not re-flagged: the base-`.button`
hover-transition vs. Motion clash (2026-07-08 entry, now reinforced a
third time) and the rule that a first-render portal must use
`usePortalTarget` (2026-07-17 entry — the vector editor followed it
correctly from the start; `image-editor.tsx` still doesn't).

## 2026-07-17: Cyan-as-text amendment lands — ~247 light-theme AA failures fixed; dev-server health-check hardened

**Context.** Fixing the portal-hydration bug (entry below) made light theme
reachable on the three full-bleed cockpit routes for the first time — and
its appearance there had never actually been examined. The owner said "fix
it so it all works in dark/light mode." Separately, two dev-environment
root causes were fixed at the owner's request.

**Decisions.**
- A measured audit (canvas-based WCAG relative-luminance check over every
  visible text element and its effective background, production build,
  both themes, all 5 tool surfaces) found **~247 AA failures in light
  mode** — Prompt Builder 198, Skills 24, Welcome 11, Architect 11, Image
  Editor 3 — dominated by `--brand-cyan` used as **text** at 1.5–1.8:1
  against a 4.5:1 floor.
- This is the 2026-07-14 Design-gate amendment ("cyan is a focus/marker/
  active color, not a light-theme text color") that had sat in the consent
  queue ever since; it landed into `docs/DESIGN_DIRECTION.md` (the
  canonical design source, not STANDARDS) as a new subsection, "Accent
  colors mark; they do not spell (resolved 2026-07-17)." The 2026-07-14
  flag is annotated landed accordingly.
- Fix shape — tokens split by JOB, not hue: (1) `--brand-cyan-text` /
  `--brand-magenta-text` for any text, incl. inside `color-mix()`, darkened
  in light theme (`--brand-cyan-text` measured at least 4.9:1 and
  `--brand-magenta-text` at least 5.2:1 on every light surface token) but
  IDENTICAL to the marker accent in dark theme, so dark rendering never
  changed; (2) `--on-brand-cyan` — dark ink in BOTH themes for text on a
  bright cyan fill, because `--primary-foreground` was wrong there
  precisely for theme-flipping (dark-on-cyan is fine in dark mode,
  near-white-on-cyan measured 1.78:1 in light) — a token that flips is
  wrong exactly when what it sits on does not; (3) all 164 non-text cyan
  uses (borders, rings, fills, markers) keep the bright accent, untouched;
  (4) the Architect wizard's per-block accents come from data (`blocks.ts`)
  and were applied as an inline `color`, unreachable by any theme rule —
  now passed as a `--glyph-accent` custom property that CSS darkens in
  light theme, each block keeping its own hue.
- `StartDigiTools.bat` now health-CHECKS port 5100 (curls it) instead of
  trusting `netstat ... LISTENING`. Port-held is not the same as working: a
  2-day-old wedged server kept the socket open while answering nothing, and
  the old check cheerfully said "already running" and opened a browser onto
  a dead server; it now offers to end a non-responding process.
- `npm run dev:clean` added for the stale-Turbopack-cache trap (see the
  mobile-tool-gate entry's ~40-minute debugging session, below).

**Learnings.**
- Two of this session's bugs were invisible for the same structural reason:
  **a defect in a state nobody can reach is a defect nobody reports.** The
  hydration bug hid the light theme; the light theme hid ~247 contrast
  failures. Fixing the first is what made the second findable — worth
  remembering whenever a fix "reveals" a pile of new problems: they were
  always there.

**Verification.** Production build, 5 surfaces × both themes: 0 contrast
failures, 0 theme failures (from ~247). The healthy path of the new
`StartDigiTools.bat` check was verified directly; the wedged-server path is
new code with no live wedged server available to reproduce against.

No new amendment flags in this entry — the open portal-target flag is
reinforced in the entry below, not duplicated here.

## 2026-07-17: Cockpit light-theme bug fixed — portal-during-render hydration failure, not the theme script

**Context.** Later in the same session as the mobile-tool-gate work (entry
below), the owner clicked the task chip that entry filed — "saved light
theme ignored on the three full-bleed cockpit routes" — and asked for the
actual root cause rather than a workaround. The leading hypothesis recorded
in that entry, `layout.tsx`'s hardcoded `data-theme="dark"` plus
`suppressHydrationWarning` masking a mismatch, turned out to be WRONG on
both counts.

**Decisions.**
- Root cause, proven empirically: `ToolSubbar` and the Prompt Builder's
  print-sheet portal both resolve their portal target by reading the DOM
  DURING RENDER (the `typeof document === "undefined" ? null :
  document.body` / `getElementById` idiom). The server renders `null`; the
  client renders a portal — different tree shapes, a hydration mismatch
  React can only recover from at the root by discarding the server HTML and
  client-rendering the whole document. That MOUNTS the `<html>` host
  singleton, and mounting calls `acquireSingletonInstance`, which clears
  every attribute on the element and reapplies only the JSX props —
  reasserting `layout.tsx`'s `data-theme="dark"` over whatever the
  bootstrap script had set. React logs nothing for this: no console error,
  ever, on any affected route, which is why it went unnoticed.
- The 2026-07-16 theme-script relocation was never at fault, and
  `suppressHydrationWarning` was never relevant — this is a singleton
  *acquisition* clearing attributes, not a hydration diff being patched.
- The kicker: `docs/ARCHITECTURE.md` §2 explicitly MANDATED the anti-pattern
  that caused this — "No effect/mounted gate — deferring the portal blanks
  the bar for a frame." The documented shell contract caused the bug; §2 is
  REWRITTEN to require the opposite and explain why, so a future tool built
  to spec doesn't reintroduce it.
- Fix: new `src/hooks/use-portal-target.ts` — `usePortalTarget(elementId?)`
  on `useSyncExternalStore` with a `null` SERVER snapshot, so the hydration
  render matches the server and the portal still mounts before paint (no
  blank-bar frame — the exact concern the old anti-pattern was guarding
  against). Adopted in `tool-subbar.tsx` and `prompt-builder.tsx` (later
  extended to `prompt-card-workbench.tsx` too — see the Correction below).
  `theme-script.tsx` and `layout.tsx` are untouched, so the §2.4 allowlist
  does not move again.

**Learnings.**
- Method worth keeping for the next silent-corruption bug: (1) a temporary
  probe inside the theme script showed it ran and set `light` at ~600ms,
  then something set `dark` twice at ~1800ms (hydration time); (2) patching
  `Element.prototype.setAttribute` captured a synchronous stack —
  `MutationObserver` is useless here since its callback is async and loses
  the mutator's stack — naming `acquireSingletonInstance →
  setInitialProperties → setValueForAttribute`; (3) a probe attribute set by
  the bootstrap SURVIVED on `/tools/skills` (no portal → clean hydration)
  but was STRIPPED on `/tools/image-editor` (portal → acquisition), leaving
  `<html>` with exactly its three JSX attributes — that contrast located
  the trigger precisely.
- **Dev mode is the wrong place to verify hydration/theme work.** Fast
  Refresh re-acquires the `<html>` singleton on every hot update, resetting
  `data-theme` on ANY route — it poisoned a 20-case matrix with incoherent
  results (Skills "failing" despite never portaling; an invalid stored
  value somehow yielding `light`). The incoherence is what exposed the
  harness as the problem, not the app. Verify hydration-sensitive work in a
  production build, not dev — sharpens the 2026-07-16 entry's verification
  note.
- Only portals that render on FIRST render are dangerous this way — one
  gated behind an `open`/`null` state renders nothing on both sides and is
  safe, which is why the dialogs, palettes, and the Image Editor's
  `doc`-gated status portal were all fine already. **Refined the same
  day** (see Correction below): the operative test turned out to be
  whether the portal inserts DOM at rest, not render timing — an
  always-mounted portal that outputs nothing while idle is equally safe.
- A documented architecture contract can itself be the bug: the
  ARCHITECTURE.md handshake section was precise, confident, load-bearing,
  and wrong.

**Verification.** Real production build, 20/20 across 5 surfaces × stored
light/dark/invalid/absent, subbar portaled, and the
`.context-bar:has(.prompt-subbar)` handshake still hiding the default text.
Integration gate: initial PASS, then FAILED on a same-day re-check (see
Correction below) and re-verified PASS after the fix — report at
`.ai/notes/gate-reports/2026-07-17-integration-gate-portal-hydration-theme.md`.
No security gate owed — no trust boundary moved (Rule 19).

**Correction, same day (integration gate catch).** A follow-up integration
gate run FAILED this same fix: `src/components/prompt-card-workbench.tsx:391`
still fed its dnd-kit `DragOverlay` portal through the exact `typeof
document === "undefined" ? null : document.body` idiom this session was
meant to eliminate — and the component turned out to be mounted and SSR'd
on first load (the C.R.A.F.T. panels are hidden via `aria-hidden`/`inert`,
not conditional rendering), so the "gated behind an open/null state"
reasoning in the Learnings above doesn't cover it. The gate report's own
claim that "other portals are safe, gated behind an `open` state" was
FALSE; fixed by adopting `usePortalTarget` here too, and the report gained
a "Corrections" section recording the miss rather than quietly editing the
claim away.

Asking WHY the 20/20 matrix above hadn't caught this sharpened the root
cause: **the hazard is the INSERTED DOM, not the portal.** `body >
.print-sheet` is real nodes added during hydration — the container diverges
from the server, which is what breaks; the idle `DragOverlay` inserts
nothing at rest (verified: no overlay node in `body`), which is exactly why
the matrix passed 20/20 with the idiom still live in this file. A portal
whose children render to nothing is inert; one that adds nodes is not.
`use-portal-target.ts` and `docs/ARCHITECTURE.md` §2 now state that
distinction instead of the "renders on first render" framing above. The
lesson: a gate's High finding can be right about the code and wrong about
the severity — checking which is what turns a fix into an understanding.

**Preferences / proposed amendments (need owner consent).**
- A portal that renders on first render must resolve its target through
  `usePortalTarget` (the `useSyncExternalStore`-with-`null`-server-snapshot
  idiom); never read the DOM during render. Cheap to enforce
  deterministically (grep the `typeof document === "undefined"` idiom in
  render paths outside hook files), and this bug proved the failure mode is
  silent — no console error at any point — and expensive: three routes lost
  their entire server-rendered HTML on every load, indefinitely.
  **Reinforced same day:** this exact gap — a render-time `document.body`
  read in `prompt-card-workbench.tsx` — survived both the original fix and
  its own gate review (see Correction above), because neither
  `check:standards` nor `check:security` greps for the idiom today; the
  cheap deterministic check doesn't exist yet, which is exactly how it
  slipped through twice in one day. **Reinforced again 2026-07-19:** the
  new Vector Editor followed this rule correctly from the start, but
  auditing it found the same idiom still latent in `image-editor.tsx`
  (already task-chipped, not yet fixed) — the deterministic check
  proposed here still doesn't exist. (proposed amendment, needs the
  owner's consent)

## 2026-07-17: Mobile tool gate — cockpits gate below 768px, Skills and Welcome exempt

**Context.** The owner reported that several tabs were "pretty bad" viewed
on a phone — naming the C.R.A.F.T. Prompt Builder specifically ("the craft,
everything, but the skills in the main introduction page was an issue").
The proposal that became the design: pages that don't work on mobile should
instead explain what the app is and say to launch it on tablet/desktop,
with an override button, and "restrict quite a few features so it becomes
more of a preview thing." A 375px audit ran before any building: Welcome
and Skills were genuinely fine, matching the owner's read; the other three
were broken, not merely cramped — the Prompt Builder's C.R.A.F.T. flow
track computed to 0px wide and the main grid degenerated to `2px + 363px`;
the Architect Wizard's tool header wrapped until the context bar hit 221px
against its documented 42px contract; the Image Editor rendered but became
a 1161px scroll stack fighting canvas-drag.

**Decisions.** From a 4-question clarify round (the standing
clarify-to-95%-confidence preference), the owner chose:
- Full tool + a persistent "built for desktop" framing chip + CSS triage of
  the measured breakages — not curated per-tool preview modes (rejected as
  scope creep into per-tool product design) and not banner-only.
- Breakpoint below 768px (767.98px in the actual media query); tablets at
  768px+ pass through unaffected.
- Override persisted per-tool in sessionStorage — re-gates on the next
  visit, deliberately not "forever."
- Also fixed, same pass: the top-bar tab strip overflow (the Image tab hid
  off-edge with no scroll affordance).
- Shipped as `mobileSupport` / `mobileGateNotes` on `ToolDescriptor`
  (`src/lib/tool-registry.ts`), rendered by a new `MobileToolGate`
  (`src/components/mobile-tool-gate.tsx`: gate notes as a bulleted list,
  "Preview anyway"/"Back to Welcome"; once overridden, a small "Squeeze-in
  preview — built for tablet and desktop widths" chip, not a restricted
  feature set), plus two new hooks — `useMobilePreviewOverride(toolId)`
  (`src/hooks/use-mobile-preview.ts`, sessionStorage + an in-memory
  fallback for the current page) and `useMediaQuery(query)`
  (`src/hooks/use-media-query.ts`, both on `useSyncExternalStore` so the
  client re-reads before paint and a phone never flashes the desktop
  branch). Prompt Builder, Architect Wizard, and Image Editor gate; Skills
  doesn't. The new CSS (`.is-mobile-gated`/`.is-mobile-preview`) is inert
  at 768px+, so desktop SSR output and rendering are byte-identical
  whether or not the feature exists — confirmed by the integration and
  design gates.
- `docs/ARCHITECTURE.md` updated to match: §2 gains `useMediaQuery` as a
  recyclable primitive plus an updated add-a-tool note, and §5's
  globals.css zone map names the trailing "Mobile tool gate" zone and why
  it must stay last (source-order overrides).

**Learnings.**
- A stale Turbopack cache silently served old CSS for ~40 minutes of
  debugging: edits to `globals.css` stopped compiling while JS kept
  hot-reloading, so the browser computed `overflow: hidden auto` (an
  earlier edit's value) while the file on disk said `overflow: visible` —
  survived a full dev-server restart; only `rm -rf .next` fixed it.
  Diagnostic that broke the stall: fetch the served stylesheet with
  `cache: 'no-store'` and grep the compiled rule directly, rather than
  trusting `getComputedStyle`. Reach for this first on the next "my CSS
  isn't applying" report.
- `overflow: visible` is the correct undo for a `:has()` overflow lock, not
  `overflow-x: hidden; overflow-y: auto`. Overflow set on `html` stops
  propagating to the viewport, so an explicit html+body scroller competes
  with the real one and pins the page a few pixels down (observed: clamped
  at 44px of a 318px scroll range).
- Another entry for the standing headless-preview RAF/smooth-scroll quirks
  list (07-09/07-14/07-15 entries): `window.scrollTo(x, y)` silently
  no-ops because `html { scroll-behavior: smooth }` is RAF-driven. Use
  `scrollTo({ top, behavior: 'instant' })` to verify scroll reachability
  headlessly.
- The Design gate's High finding was real but its arithmetic was wrong —
  it estimated a 450–500px card and predicted failure at 660×375
  landscape; the card is actually 211px there and fits. The bug reproduces
  at genuinely short viewports instead (375×380; a 568×320 phone in
  landscape). Lesson: a gate reasoning from the CSS cascade without a
  browser gets the mechanism right and the trigger wrong — the empirical
  check found the true failure window.
- Both judgment gates independently flagged the same threshold drift (the
  gate's CSS at 767.98px vs. the Prompt Builder dock default at 760px) — a
  good multi-gate signal for the fix that landed: one `PHONE_MEDIA_QUERY`
  constant in `tool-registry.ts` now feeds both.

**A pre-existing bug found, then fixed later the same session — see the
entry above.** The saved light theme was ignored on exactly the three
full-bleed cockpit routes (they forced dark; Welcome and Skills honored
it). Proven pre-existing by reproducing with the entire session's WIP
stashed, on a fresh server with `.next` cleared. The leading hypothesis
recorded here at the time — `layout.tsx`'s hardcoded `data-theme="dark"`
plus `suppressHydrationWarning` masking a mismatch — was WRONG; the actual
mechanism was a portal-during-render hydration failure that re-acquires
the `<html>` singleton, root-caused and fixed the same day (entry above).
That also resolves the "undetermined" tension noted here against the
2026-07-16 entry's restore-matrix claim: that verification was accurate as
far as it went (it just never exercised a portaling route), so the
theme-script relocation was never at fault.

**Gates.** All three ran as registered subagents; reports in
`.ai/notes/gate-reports/2026-07-17-*-mobile-tool-gate.md`. Security: PASS
(1 Low — `useMediaQuery`'s `matchMedia` calls were unguarded in a render
path with no error boundary anywhere in the app; fixed, mirroring the
existing storage guard). Integration: PASS (2 required fixes: an
ARCHITECTURE.md line-wrap typo, and filing this session's own reports to
the ledger). Design: FAIL → PASS — 1 High (the gate's own "Preview
anyway"/"Back to Welcome" buttons were unreachable on short screens
because the pre-existing full-bleed `html:has(.page-stage.is-fluid) {
overflow: hidden }` lock is unscoped and every gated tool is `fullBleed`;
fixed by restoring `overflow: visible` for both mobile-gate states — see
the proposed amendment below); 1 Medium (nav leaned on horizontal scroll
instead of reclaiming room; fixed by hiding the wordmark ≤767.98px,
extending the existing ≤640px precedent); 2 Low (the threshold drift
above, and a missing `list-style: none` reset on the notes list).

**Preferences / proposed amendments (need owner consent).**
- DESIGN_DIRECTION §Layout's "Navigation remains usable without horizontal
  page scrolling" doesn't say whether it governs the top-bar tab strip
  (which scrolls internally by design at phone widths, while the page
  itself never scrolls sideways) or only the tool work area — both
  readings are defensible; the line should say which. (proposed amendment,
  needs the owner's consent)
- A gated/full-bleed surface must not depend on the unscoped
  `html:has(.page-stage.is-fluid) { overflow: hidden }` lock — any state
  that renders a document-shaped card inside a full-bleed stage must
  restore scrolling. This session's Design-gate High came directly from
  that trap. (proposed amendment, needs the owner's consent)

## 2026-07-16: Theme-bootstrap relocation — React 19 script-tag warning fixed, §2.4 allowlist relocated (consent trace)

**Context.** React 19.2 + Next 16.2 logged a dev-only warning ("Encountered a
script tag while rendering React component") on every page load, sourced from
the no-flash theme-bootstrap `<script dangerouslySetInnerHTML>` in
`src/app/layout.tsx`'s head. The owner clicked the task chip (created
2026-07-15, spawned from STATE.md's dev-only-noise backlog item) whose text
explicitly scoped the fix: preserve zero theme flash, keep STANDARDS §2.4
green, and noted the allowlist "may need updating in
`scripts/check-security.mjs` with owner consent."

**Decisions.**
- The bootstrap moved 1:1 into a new `src/components/theme-script.tsx` client
  component that injects the byte-identical constant script into the
  streamed `<head>` via `useServerInsertedHTML` — the first-party Next
  mechanism CSS-in-JS libraries use, outside the hydrated React tree (so the
  React 19 warning cannot fire) and still parse-blocking in `<head>` (so
  zero-flash is preserved).
- **CONSENT RECORD (this entry is the durable §4.1 trace).** The §2.4
  allowlist entry was RELOCATED, not grown: `scripts/check-security.mjs` S1
  and the STANDARDS §2.4 text now name `src/components/theme-script.tsx`
  instead of `src/app/layout.tsx`; `layout.tsx` no longer contains any
  injection primitive. Consent basis: the owner-clicked task chip explicitly
  authorized the allowlist-update path for this exact fix — recorded here
  per §4.1 ("every rule traces to a consented decision"), mirroring the
  2026-07-15 precedent where an in-session consent got its durable anchor via
  the sessions entry. The 2026-07-16 integration gate REQUIRED this entry
  before delivery (its §4.1 row failed Medium until recorded) — the
  consent-gate machinery working as designed.

**Learnings.**
- First session where gates ran through the REAL registered subagent types
  (integration-gate, security-gate) — the 2026-07-15 YAML fix took effect.
  Both agents registered and ran with their own toolsets; the integration
  gate independently caught a stale `layout.tsx` mention inside
  security-gate.md's own spec (fixed) and the missing consent trace (this
  entry); the security gate independently curl-verified the emitted HTML.
- Gate agents may invoke `gate:sweep` as part of their own verification: the
  security gate did, noticed the write to `gate-status.json` violated its
  read-only mandate, and reverted it — worth knowing for future gate runs;
  their reports note it.
- Verification pattern for pre-paint scripts: assert the raw server HTML
  (curl) contains the unescaped script inside `<head>` before `<body>` — that
  IS the no-flash proof; browser console cleanliness across multiple full
  loads proves the warning fix; a light/dark/invalid-localStorage matrix
  proves the two-value guard.
- `gate-sweep`'s `TRIGGERS.security` globs don't cover `layout.tsx` or the
  check-security allowlist file itself (integration-gate note) — a candidate
  heuristic improvement, not flagged as an amendment.

No new amendment flags this session.

## 2026-07-15: Orchestration review — ARCHITECTURE.md, gate-registration bug fixed, shell-contract extraction, dead practices revived

**Context.** The owner asked for an orchestration review — "CLAUDE.md looks
oddly small — is agents set up properly? are we using skills properly?" —
and offered to let the repo be refactored into a documented "DigiTools Core
Framework" so an AI building any new tool inherits the shared
top/context/status bars, tool-owned left/right rails, and code recycling
instead of reinventing chrome. The owner again invoked the
clarifying-questions pattern ("ask until 90% sure") before the plan was
finalized.

**Decisions.** All confirmed via `AskUserQuestion`; the owner accepted every
recommended option.
- Refactor scope: extract only the top 4 duplicated primitives
  (`ToolSubbar`, the save-status formatter, `useUndoableState`,
  `useLocalDraft`); defer the rest (output docks, dialog portals, the
  prompt-role-workbench tablist) — documented as sanctioned backlog in the
  new `docs/ARCHITECTURE.md` §3 rather than silently dropped.
- Commit order: land the two pending 07-14 bodies of work first, as two
  separate commits (`6ca8b83` image editor, `87b90cd` prompt catalog), then
  do this session's extraction on a clean tree — keeps each effort a
  readable diff.
- CONSENT GRANTED for a new **STANDARDS §1.4**, "a tool conforms to the
  shell contract" (judgment rule; Integration gate audits new/changed tools
  against `docs/ARCHITECTURE.md`; mirrored as AGENTS.md Rule 22). §1.4 was
  proposed and consented within this single session (plan approval + an
  explicit "Approve both" answer) rather than via a prior flagged line, so
  per STANDARDS §4.1's trace requirement this entry IS its consent record.
- Also landed, same consent round: the **§2.4 clarification** ("pure
  catalog data through unchanged render paths needs only the deterministic
  halves"). This lands the 07-14 flag, which already carries its own
  "→ landed in §2.4" annotation on that entry's line — not re-flagged here.
- Revive two practices dead since their 07-04 creation: the **skill log**
  (`npm run skill:log`) is honored going forward with no forced retroactive
  backfill (none logged this session — no installed skill materially drove
  the work); **agent-evals** (`.ai/agent-evals/`) run in the next fresh
  session now that the gate agents actually register (see Learnings), plus
  new fixtures for surfaces built since 07-04.

**Learnings.**
- Root cause of every gate report to date coming from the general-purpose
  fallback rather than a truly registered gate agent: all three gate
  agents' YAML frontmatter `description:` fields contained an unquoted
  colon-space ("Read-only: it reports…"), which breaks frontmatter parsing
  and silently drops the agent from Claude Code's subagent list (confirmed
  with a js-yaml parse). `sessions.md` never had the problem — its
  description has no colon. Broken since creation on 2026-07-04; the
  symptom is the agent type missing from the Agent tool's list, the fix is
  an em dash or quoting.
- Audit baseline: skill pins were 100% compliant in both homes
  (`.agents/skills/`, `.claude/skills/`); despite that, `skill:log` had
  never once been invoked (no `.ai/notes/skill-log.jsonl`), and
  `.ai/agent-evals/` fixtures were frozen since 07-04, never run against a
  genuinely registered agent.
- Chrome was duplicated three times over (once per tool) for sub-bar
  shells, save-status formatters, undo/redo hooks, and autosave hooks — one
  of the three copies even had a comment admitting it was mirroring
  another tool's hook.
- No-op extraction bar: per-tool `.prompt-subbar` `outerHTML` captured live
  before and after migration was byte-identical for all three tools;
  undo/redo, template-load-then-undo, and persistence-reload round-trips
  were DOM-verified under unchanged localStorage keys, including the image
  editor's 1200ms autosave debounce.
- Adapter strategy: keep each tool's existing hook API, rebase its
  internals on the new generic primitive — zero call-site churn. The image
  editor's undo hook (tags, seal, jump, depth/position, isEmpty) was the
  richest of the three and became the generalization's superset.
- Headless-preview quirks list grows: the preview pane can report a 0×0
  viewport (drive it via DOM reads, not clicks/screenshots), and a React
  state read taken immediately after a programmatic `.click()` can be
  stale — defer the read a tick. Same family as the standing RAF-canvas
  notes (07-08/07-09/07-14 entries; also STATE.md's runbook).
- Storage-format landmine, now documented in `docs/ARCHITECTURE.md` §6: the
  Architect wizard's saved-at timestamp is JSON-quoted (via `writeStored`)
  while the Prompt Builder's and Image Editor's are raw ISO strings —
  unifying the format would silently orphan users' existing saved
  timestamps, so the extraction left the formats as-is.

**Preferences / proposed amendments (need owner consent).**
- The owner's ask-clarifying-questions-until-confident pattern is now
  standing practice for plan-shaped work in this repo — the second session
  running it was explicitly invoked (see the 07-14 entry, where it also
  became the Prompt Builder's ASK card; not re-detailed here).
- From the 2026-07-15 Integration gate: STANDARDS §3.3 ("the graph must be
  true") should additionally require every `.claude/agents/*.md` file to
  carry a gov:node marker, so a future markerless agent can't silently
  escape the graph walk — today all four agent files carry markers and the
  walker simply skips markerless ones by design, so this hardens rather
  than fixes a live gap. (proposed amendment, needs the owner's consent)

## 2026-07-14: Prompt Builder — app/skill/gate/social archetypes, clarify + tiers cards, rail reorder

**Context.** The owner brought a real artifact — their YABL Portal Platform
Master Handoff v3 (a self-contained Markdown "build this app" handoff for an
AI agent) — and asked for an archetype that reproduces that document shape
for any future app, plus archetypes for agent skills and social-media
write-ups, plus a rail reorder. Mid-planning, after reviewing the first
plan, the owner added three more asks: the "ask clarifying questions until
95% confidence" success pattern, a "three tiers of information" pattern, and
an "agent gate" archetype.

**Decisions.** All confirmed via clarifying questions the owner explicitly
requested — "ask me clarifying questions until you have 95% confidence in
the answer" — before the plan was finalized.
- New ACTION card lineage `action-clarify`/ASK, driven by Autonomy (the
  owner's own instinct — "it should be a card under actions"). Grades: Full
  Interview → 95% Confidence Check (grade 1, the owner's exact phrase) →
  Blocking Questions Only → Assume & Log; pre-equipped in the three
  agent/build archetypes (APP/SKILL/GATE), all pinned at autonomy 1 so the
  95% grade is what loads. NOT a new "end-flags/mutator" UI mechanism —
  C.R.A.F.T. stays five sections (owner explicitly didn't want to lose the
  acronym).
- At interview grades, written Context may stay thin and the questions
  gather it instead — the interview can REPLACE written Context
  (owner-confirmed), reflected in those archetypes' effects copy.
- New FORMAT card lineage `format-tiers`/TIER, driven by Structure, meaning
  depth layering (essentials / working detail / deep+edge). Kept
  deliberately separate from the App-build-handoff archetype's own baked-in
  SCOPE tiers (build now / model for later / explicitly excluded) — two
  different tier meanings, not merged (owner-confirmed).
- The "agent gate" archetype produces a judgment-gate agent definition
  (identity, checks, a High/Medium/Low severity ladder, path:line evidence
  rules, a report the orchestrator consumes, read-only hard limits, and
  orchestrator run notes) — mirrors this repo's own gate pattern but stays
  portable (owner-confirmed).
- Rail order: daily drivers first (Executive summary, Creative concept,
  Note taker, Message & email, Prompt improver, Learning guide — the
  owner's stated most-used), new block at 7–10, tail grouped
  think→write→build ("a bit of your call so the order looks natural").
- Reorder implemented via a deterministic Node script (parse → insert →
  reorder by ID list → re-stringify), not hand-editing 1200 lines;
  integration gate verified the 21 pre-existing archetypes stayed
  byte-identical through the insert + reorder pass.

**Learnings.**
- The Prompt Builder flow-panel carousel scrolls via RAF/smooth-scroll, so
  off-screen panels are unreachable by clicks in the headless preview — the
  same class of quirk as the Image Editor canvas. Verify loadout/prompt
  state via DOM queries instead. Recorded in STATE.md's runbook.
- The gate agents in `.claude/agents/` were not registered as subagent
  types this session; the working fallback was a general-purpose agent run
  read-only with the gate `.md`'s contents as its instructions. Also
  recorded in STATE.md.
- Integration gate: PASS, 0 findings
  (`.ai/notes/gate-reports/2026-07-14-integration-gate-prompt-builder-catalog.md`);
  its Notes section raised a judgment worth the amendment flag below.

**Preferences / proposed amendments (need owner consent).**
- The owner sources new archetypes from a real artifact they already
  produced (here, their own handoff doc) and asks for its shape to be
  generalized, rather than describing the archetype in the abstract.
- The rail-order delegation ("a bit of your call so the order looks
  natural") reinforces the 2026-07-04 preference of leaving
  ordering/curation calls to the model once constraints are scoped — see
  that entry, not re-detailed here.
- From the Integration gate's Notes: clarify the Security gate's trigger
  scope — "pure catalog data flowing through unchanged render paths needs
  only the deterministic halves; the 'rendered prompt content' clause
  targets rendering-path changes."
  (proposed amendment, needs the owner's consent) → landed in §2.4 (2026-07-15)

## 2026-07-14: Image Editor — Photopea-alignment redesign (layout, channels, stencils, export)

**Context.** The owner directed a Photopea/Photoshop-alignment redesign of
the Image Editor (`/tools/image-editor`), pointing at the deployed site and
photopea.com, then chose the most ambitious option at every scoping fork.

**Decisions.**
- Scope: functional Channels (per-channel view + load-as-selection, not just
  visual), brush stencils = built-in presets + PNG import, export manifest =
  **both** JSON and Markdown, and a full menu bar.
- Explicit layout directives implemented: color selection moved to the right
  dock; right panel is now multi-tab (Layers / Channels "RGB alpha" /
  Properties); Properties holds color + brush + brush size + a stencil
  picker; Adjust became a right-dock tab; the left bar is now a narrow
  Photoshop-style tool strip; zoom (−/+/Fit/100%) lower-left + a
  preview/minimap lower-right, explicitly echoing the Architect wizard's
  zoom/preview idiom "for continuity"; image-size properties moved into the
  bottom status bar (middle); export is PNG plus all layers separately in a
  ZIP with a JSON or MD manifest.
- Delivered in 6 phases (scaffolding → layout → channels → stencils → export
  → gates), each typecheck/lint-verified and DOM-verified in the running dev
  server.
- Zero new runtime dependencies: layered ZIP export uses a hand-rolled
  store-only ZIP writer (`src/lib/zip.ts`) — PNGs are already compressed, so
  no deflate needed — keeping the project's 5-dep minimalism (Rule 17).
  Verified as a valid PK zip: per-layer PNGs + `flattened.png` +
  `layers.json` + `layers.md`.

**Learnings.**
- "Reuse the Architect zoom controls" was a look-alike request, not a
  literal-reuse one: the wizard's zoom cluster + preview are stock React
  Flow `<Controls>`/`<MiniMap>`, hard-coupled to a React Flow instance and
  unusable over a raster canvas. Continuity came instead from reusing the
  existing `useCanvasViewport` hook + matching CSS tokens, plus one small
  custom minimap built from scratch.
- Sharpens the standing image-editor canvas-verification note: the main
  canvas is RAF-driven and does not repaint headlessly (verify via
  DOM/computed-style + direct pixel reads), but the minimap, thumbnails, and
  stencil previews draw directly in `useEffect` and DO render headlessly —
  the same tool now needs two different verification strategies depending
  on the surface.
- All three gates passed after fixes. Security Medium: layer/doc names
  flowed unescaped into `layers.md` → fixed with an `mdCell()` escaper.
  Design Medium: the new active-tab cyan label failed WCAG AA in light
  theme → switched to `--foreground` text + a cyan marker bar instead of
  cyan text.

**Preferences / proposed amendments (need owner consent).**
- Cross-tool interaction continuity is an explicit, named goal: when a new
  tool needs a UI idiom another tool already established, match it by
  reusing the underlying hook/tokens even when the concrete implementation
  can't be shared, rather than inventing a new pattern.
- Uncommitted on `governance/aos-uplift`, same branch as the governance
  uplift (2026-07-04 entry) — committing/pushing is the owner's call.
- The Design gate flagged a systemic, pre-existing issue distinct from the
  fix above: `color: var(--brand-cyan)` used as **text** computes ~1.5–1.8:1
  contrast in light theme across 20+ selectors app-wide (home spec, skills
  headings, `.role-category-tab span`, craft method,
  `.image-editor-panel-label`, `.editor-menu-check`), failing WCAG 2.2 AA
  while "both modes first-class" (DESIGN_DIRECTION) and WCAG AA (PRODUCT.md)
  are both stated goals; only the new active-tab label was fixed this
  session. Proposed rule: cyan is a focus/marker/active color, not a
  light-theme text color — label text uses `--foreground` or a darkened
  `--brand-cyan-text` token. (proposed amendment, needs the owner's consent) → landed in `docs/DESIGN_DIRECTION.md`, "Accent colors mark; they do not spell" (2026-07-17).

## 2026-07-09: Session-continuity process landed (owner consent)

**Context.** The owner's cross-project continuity process landed here (same
change as YABL-Platform, AmazingOS-Personal, WebAppStarterProject).

**Decisions.**
- docs/STATE.md landed: the rewrite-in-place current-state snapshot. Claude
  Code auto-loads it via the CLAUDE.md include; Codex sessions read it first
  per AGENTS.md ("Session continuity"). STANDARDS §3.5 landed with the
  owner's consent.
- AGENTS.md gained the resume procedure + end-of-session checklist;
  gate-sweep.mjs warns (never fails) when STATE.md is missing or stale; the
  sessions agent now reminds callers that STATE.md is the main agent's file.

**Learnings.**
- STATE.md is snapshot, SESSIONS.md is history: never merged. The
  Now/Built/Backlog sections are stubs until the next Digi Tools session.

---

## 2026-07-09: Image Editor — second 12-feature batch ("G-features")

**Context.** A second "12 new features" pass on the Image Editor (mirroring
the 2026-07-08 batch), model-chosen with fresh eyes.

**Decisions.** Shipped 12: (1) add/subtract selection (Shift/Alt); (2) a
Select menu (invert/feather/grow/shrink); (3) stroke selection edge; (4)
clone stamp; (5) smudge; (6) per-layer transparency lock; (7) clipping mask;
(8) Levels; (9) Posterize + Threshold; (10) a History panel with
click-to-jump; (11) grid overlay + snap; (12) draggable guides + snap (drag
to reposition with the Move tool, drag off-canvas to remove — the Design gate
found the original add-at-center/clear-all scope fell short of the intended
Photoshop-guide interaction, so it was implemented properly rather than
deferred). The one architectural decision worth naming: extracted a single
paint-commit choke point — `commitPaintedBitmap(doc, layerId, working,
clipToSelection?)` in `src/lib/image-editor/document.ts` — that every
paint/fill/stroke commit now routes through, so selection-clip and
transparency-lock can't be forgotten per call site (fixed the Integration
gate's High, where the new stroke-selection-edge op was defeating the new
transparency lock, and collapsed 3 duplicated copies of the same commit
logic). Pattern: when two features interact through a shared commit,
centralize the commit rather than threading both rules through every call
site.

**Learnings.**
- All three judgment gates ran fully; every High/Medium fixed before
  delivery. Build, typecheck, lint, and the deterministic
  `check:standards`/`check:security` gates all green. Reports:
  `.ai/notes/gate-reports/2026-07-09-*-image-editor-g-features.md`.
  Integration: 1 High + 2 Medium (both above, plus a WCAG AA miss worth
  remembering — stacking `opacity: 0.72` on the `--muted-foreground` token
  for the History panel's "future" steps dropped it below 4.5:1; the token
  alone is already the AA-safe de-emphasis, don't compound it with opacity).
  Security: 0 High/Medium, 1 Low (`composite()` was reallocating a scratch
  canvas per clipped layer on the ~60fps stroke hot path; hoisted to one
  reusable canvas); the gate flagged the new persisted `locked`/`clipped`
  booleans in `project-io.ts` (strict `=== true` coercion off
  `Record<string, unknown>`) as "the pattern to imitate" for future persisted
  fields. Design: 3 Medium + 5 Low (4 fixed, 1 deferred — the motion
  amendment, below).
- While verifying the guide-drag interaction, the Design gate surfaced a real
  pre-existing bug: the RAF-deferred overlay `drawOverlay` read
  `grid`/`guides` from the render closure instead of a ref, so adding a guide
  or toggling the grid didn't repaint until the next pan/zoom. Fixed by
  reading `grid`/`guides` from refs inside `drawOverlay` — the same pattern
  already used for `doc`/`view`/`tool` — plus an explicit `[grid, guides]`
  repaint effect. Any state the RAF draw loop reads must come from a ref, not
  the closure.
- Preview-MCP canvas verification: a rendered guide read as "blank" for
  several attempts purely because the zoom/pan transform placed it outside
  the backing-buffer scan region; resolved with a temporary debug log plus a
  "Fit" reset before concluding "not rendered." Sharpens the standing
  headless-canvas-verification lesson — reset to Fit / compute the expected
  backing coords first, don't trust a blank pixel scan alone.

**Preferences.**
- The DESIGN_DIRECTION motion-rule flag from 2026-07-08 is reinforced, not
  duplicated: this session's Design gate independently flagged the same
  `background-color`/`border-color` hover/selected transitions as an
  amendment candidate. Folded a sharper, scoped proposal into that entry's
  line rather than re-flagging here — see 2026-07-08 ("a new from-scratch
  'simple Photoshop' tool").

## 2026-07-08: Image Editor — 12 pro-tool features

**Context.** Right after the base Image Editor shipped, the owner asked for "12
new features" (mirroring the Architect Wizard's 12-feature pass). The 12 were
model-chosen with fresh eyes.

**Decisions.** Shipped 12: (1) foreground/background colors with swap (X) /
reset (D); (2) fill shortcuts (Alt+⌫ fg, Ctrl+⌫ bg, selection-aware); (3) a
gradient tool (linear/radial, fg→bg and fg→transparent); (4) ellipse marquee +
magic-wand select-by-color; (5) copy/cut/paste (selection → new layer, in-app
clipboard); (6) arrow-key nudge (1/10px, layer or selection); (7) Shift-constrain
(straight strokes, square/circle shapes, 45° lines/gradients); (8) a pro
keyboard pack ([ ] size, Ctrl+J/E/Shift+N, Ctrl+0 fit, Ctrl+1 100%, Ctrl+Shift+E
flatten); (9) canvas flip H/V + rotate 90° (a subbar Canvas menu); (10) an Image
Size resample dialog with aspect-lock; (11) recent-color swatches; (12)
Hue/Saturation added to the Adjust dialog. Still **zero new dependencies** — all
on the Canvas 2D API and the existing COW/onCommitDoc architecture.

**Learnings / governance.**
- The base tool's 3 judgment gates already passed with fixes. These 12 are
  additive and introduce **no new trust boundary** (magic-wand reads the
  in-memory composite; copy/paste is an in-app clipboard; canvas transforms +
  resample are internal; no new file import/download/localStorage path — the
  gated project-io/persistence surface is unchanged), so the Security surface is
  materially the same. The new modal (Image Size) was wired into the existing
  keyboard-suspend guard + autofocus, so the Design gate's earlier High
  (shortcuts leaking behind modals) does not regress. Deterministic
  `check:standards` + `check:security` pass via the build.
- **Judgment gates were NOT re-run on the new UI this pass** (toolbar swatches,
  gradient segmented control, Canvas dropdown, recent-colors) — owed if the
  owner wants an independent design/integration pass; offered.
- Verified in-browser with pixel assertions: gradient is monotonic dark→light;
  magic-wand select + Delete clears the region; flip H swaps sides; Hue +120°
  rotates blue→(255,17,102). typecheck/lint/build clean.

## 2026-07-08: Image Editor — a new from-scratch "simple Photoshop" tool

**Context.** The owner asked for a 4th tool tab: a browser image editor with
"the capabilities of Photopea" (paint, edit, select, layers, history). After
scoping questions the owner chose **build from scratch** (over embedding
Photopea or pulling a graphics library) and a **full v1** (core + all four
extras: selections, filters, shapes/text, transform/crop).

**Decisions.**
- Built entirely on the native Canvas 2D API with **zero new dependencies**
  (Rule 17) — no fabric/konva, no hosted embed. Fully local/offline, mirroring
  the Architect Wizard's orchestrator + panels + full-bleed cockpit and reusing
  its history/persistence/download machinery.
- **Copy-on-write immutable layer bitmaps:** every pixel edit produces a new
  offscreen canvas + a new `ImageDoc`, so undo/redo snapshots the whole doc by
  reference (unchanged layers share memory) — the Architect history hook worked
  almost verbatim.
- **`onCommitDoc(mutate, tag?)` single contract:** the canvas commits every edit
  (brush/fill/shape/text/select/move/transform/crop) as one atomic doc transform
  through the orchestrator's checkpoint+setDoc, instead of many bespoke
  callbacks. Selection-aware ops clip via `applySelectionClip`.
- **Persistence:** debounced, quota-guarded localStorage autosave
  (`digitools.image-editor.doc-v1`, layers as PNG data URLs) with a size budget
  that degrades to "use Save"; the durable path is a downloadable `.json`
  project. IndexedDB deferred (kept the codebase's localStorage convention).
- Fixed a real React-19 lesson: synthetic pointer handlers read **live props by
  closure** (not mirror-refs), so a tool/color switch is never one render stale;
  refs are only for the rAF draw loop.

**Learnings.**
- All three judgment gates ran fully this session (no spend limit). Integration
  = PASS. Security found 1 Medium (a shape-valid `.json` project could bypass the
  once-checked dimension cap via unbounded layer count → multi-GB allocation) +
  3 Low — all fixed (MAX_DOC_LAYERS/MAX_TOTAL_PIXELS + per-image size check +
  file-size ceiling + try/catch + filename cap). Design found 1 High (global
  shortcuts leaked to the canvas behind open modals) + 1 Medium (no single-column
  collapse <900px) + 2 Low — all fixed. Every phase was pixel-verified in-browser
  (the preview stage renders ~1px wide headless, so verification read
  `getImageData`/`toDataURL`, not screenshots — same limitation noted for React
  Flow).

**Preferences / proposed amendments (need owner consent).**
- §2.3 hardening: a validated field used to size an allocation must bound the
  **total** (dimensions × count), not the field in isolation — narrower
  shape-validation missed the layer-count multiplier. (proposed amendment, needs
  the owner's consent)
- DESIGN_DIRECTION "motion: opacity or transform only" conflicts with the
  sitewide `.button` border/background transitions. Sharpened 2026-07-09,
  reinforced independently by that session's Design gate: permit
  `background-color`/`border-color` micro-transitions (150–200ms) for
  hover/selected affordances specifically, keeping strict
  opacity/transform-only for larger settle/panel motion. Reinforced a
  third time 2026-07-19, same trigger, by the Vector Editor's Design
  gate — still pending. (proposed amendment, needs the owner's consent)
- No icon-language rule exists for mixed SVG-vs-Unicode glyph toolbars.
  (proposed amendment, needs the owner's consent)

## 2026-07-04: Card system restructure — sliders, catalog, archetypes, restore hardening

**Context.** The owner asked the new model to re-examine the prompt-builder
card system with fresh eyes and restructure it: sliders, card content, prompt
outcomes, and the archetype set. Owner confirmed full-restructure ambition
(IDs may change, old saves degrade gracefully) and the archetype curation
(cut one, add four).

**Decisions.**
- Card goals are UI flavor only: `getEquippedInstructions` no longer appends
  "Focus on these outcomes: …" to every card — instructions carry the full
  weight in the assembled prompt (guard test added).
- `practicality` track removed (weak 3-point axis overlapping autonomy);
  every remaining track standardized to exactly 4 points; Action section now
  runs on autonomy + challenge only. Schema tightened to 0–3 / 4-point.
- All ~120 grade instructions rewritten as escalating behavioral directives;
  target-tone + target-direct merged into target-stance; four lineages added
  (context-exclusions, action-ideate, action-explain, format-length) →
  30 lineages × 4 grades.
- Archetypes 18 → 21: business-opportunity cut (decision-advisor +
  build-plan in a suit); explain-code, spec-prd, risk-premortem, and
  prompt-improver added; all retuned to the new catalog.
- Affinity policy: a card's affinity may not gate on its own driver track —
  driver-bound affinities made low grades unreachable dead content; only the
  cross-track kind (e.g. assumptions gated by contextDepth) is kept.
  Candidate validator rule (proposed amendment, needs the owner's consent)
- Every card-system restore/apply path (autosave, session import, share
  links, library, custom archetypes) now flows through
  `sanitizeCardSystemShape`, fixing the pre-existing ghost-slot bug and
  making catalog changes non-breaking by construction. This closes the
  cardSystem half of the standing §2.3 bare-cast audit point; `restoreDraft`
  remains the open half. (→ landed 2026-07-28: `restoreDraft` now coerces
  field-by-field, and `loadSavedPrompt` restores through it.)

**Learnings.**
- The judgment gates (integration, security) were launched but aborted by
  the provider's monthly subagent spend limit; the deterministic halves held
  via prebuild — exactly the "holds without reinforcement" design. Ledger
  entries record the blocked runs honestly; re-run the agents when capacity
  returns.
- Live migration proof: injecting a hostile stored state (ghost ids,
  removed track, out-of-range values) reloads clean and autosaves the
  sanitized shape.

**Preferences.**
- The owner delegates content curation to the model after scoping questions
  (ambition + which archetypes) rather than reviewing card-by-card.

## 2026-07-04: Governance uplift — gates, learning loop, and the Claude bridge

**Context.** The AOS-generation governance layer retrofitted onto this repo's
existing Codex-first AI Stack, on branch `governance/aos-uplift` (five staged
commits, not pushed).

**Decisions.**
- `docs/STANDARDS.md` adopted with the owner's consent (bundled in the
  approved plan): tool-registry wiring, catalog pipeline coverage,
  PROMPT_ROLES drift, browser trust boundary, no injection primitives, skill
  pins, gate ledger, gov:node graph truth, two skill homes, consent gate.
- Two skill homes (STANDARDS §3.4): `.agents/skills/` stays the untouched
  Codex set; `.claude/skills/` carries the curated sharp set (12 bridged
  byte-identical + 3 additions + the `/digi` router). GSAP suite and Taste
  collection deliberately not bridged (no gsap dependency).
- Full wiring from day one: both checks on `prebuild` (joining
  `data:validate`), `.githooks/pre-commit`, and CI.
- AGENTS.md upgraded in place; rules 1-17, the three layers, and skill
  routing preserved verbatim (verified by diff). Rules 18-21 added for the
  gates + graph truth.
- The theme-bootstrap `dangerouslySetInnerHTML` in `src/app/layout.tsx` is
  the sole §2.4 allowlist entry (module-level constant, two-value
  localStorage check); growing the list needs consent.

**Learnings.**
- The repo's own generator already had a `--check` mode
  (`generateRoleDocs({check:true})`) — the drift gate reuses it instead of
  duplicating render logic.
- The browser trust boundary is currently a bare cast:
  `src/lib/prompt-session.ts` (`JSON.parse(...) as Partial<PromptSession>`)
  and `src/lib/prompt-storage.ts` (`JSON.parse(raw) as T`) validate nothing.
  Recorded as standing audit points in the security gate. Hardening them —
  sharpening §2.3 from "validated" to "validated via the catalog schema or a
  typed guard" — is the first recommended follow-up (proposed amendment,
  needs the owner's consent).

**Preferences.**
- Branch + staged commits, no push: pushing/merging `governance/aos-uplift`
  is the owner's call.
