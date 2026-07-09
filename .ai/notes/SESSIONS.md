# Sessions log

Newest-first ledger of notable decisions, learnings, and preferences —
appended by the sessions agent (see AGENTS.md → Learning loop). Lines ending
with the proposed-amendment flag are STANDARDS candidates;
`npm run amendments` lists the ones not yet annotated "→ landed in §X.Y".

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
  opacity/transform-only for larger settle/panel motion. (proposed
  amendment, needs the owner's consent)
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
  remains the open half.

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
