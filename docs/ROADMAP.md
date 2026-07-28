<!-- gov:node id=roadmap kind=doc title="ROADMAP.md (vector + image feature program, owner-approved)" reads=docs/STATE.md,docs/ARCHITECTURE.md -->

# Roadmap — Vector "Illustrator core" + Image precision pass

Feature sets designed with the owner on 2026-07-28 (voice-note brief + four
scoping decisions, all recommendations accepted). This doc is the WHAT/WHY a
build session starts from; each milestone still gets its own implementation
plan at build time. Current-state facts below were verified against the code
on the design day — re-verify before building.

## Owner decisions (2026-07-28)

1. **Build order:** Vector path core first (V1). The rest follows.
2. **Units:** per-document unit (px/in/cm/mm) + PPI, stored on the document,
   spoken by panels/dialogs/status bars/exports in BOTH editors. Pixels stay
   the master unit internally; physical units are a mapping through PPI.
3. **Type tool v1:** point text only (click-to-place, font family/size/
   weight/italic/color, edit in place). Area text later.
4. **Crop:** confirm-stage — drag region → adjust (handles + X/Y/W/H fields +
   aspect presets + thirds overlay) → Enter/✓ applies, Esc cancels. Dragging
   past the canvas still grows it, now visibly.

## The anchor-point model (the owner's vocabulary, mapped)

| Owner's term | Model term | Behavior |
|---|---|---|
| straight point | `corner` | no handles; segments meet hard |
| locked handle | `smooth` | both handles locked collinear through the point |
| double handle | `broken` | two handles, independently movable |
| auto handle | `auto` | handles computed from neighbors; editing demotes to smooth |
| "the chevron" | convert control | segmented control in the Design tab + Alt-click on canvas; switches a selected anchor between types |

## Milestone V1 — Vector path core (FIRST)

The foundation everything layers on. One coherent build:

- **`path` object kind** — bezier segments, open or closed, per-anchor
  `{ point, handleIn, handleOut, type }`. Extends the 9 exhaustive switches
  (`ShapeElement`, `objectToSvg`, `objectBounds`, `resizeShape`,
  `createShape`, `translateObject`, `fitObjectToBounds`, `validateObject`,
  `KIND_GLYPH`) — the compiler enumerates every integration point.
- **White arrow (`A`)** — direct selection: anchors + handles, drag to move,
  marquee over anchors; needs real **geometric hit-testing** (point-near-
  anchor, point-near-curve — the editor currently lets the DOM decide, which
  cannot find "the segment between two anchors").
- **Pen (`P`)** — click = corner, drag = smooth, click-first-anchor closes;
  Esc/Enter ends an open path. Polygon tool moves off `P` (new shortcut).
- **Convert-point control** — the chevron: Design-tab segmented control +
  Alt-click cycling on canvas.
- **Shapes convert to paths** — explicit "Convert to path" op (and implicit
  on white-arrow edit attempt): rect/ellipse/polygon/line → editable
  anchors, so no object is a dead end.
- **Object multi-select** — shift-click + marquee for the black arrow (V);
  group transforms of the existing kind (move; combined-bounds resize can
  follow later if it fights the schedule).
- Validator branches in `project-io.ts` for the new kind (the §2.3 pattern),
  history/autosave already generic.

## Milestone V2 — Type

- Point text as a first-class object kind (`<text>` in exports — real,
  selectable text in the SVG), font family (system list + safe fallbacks),
  size, weight, italic, fill; in-place editing on canvas; Design-tab fields.
- Outline-to-path and area text stay OUT (later section).

## Milestone V3 — Documents, units, vector export

- **Shared units module** (`src/lib/units.ts`): px ↔ in/cm/mm through
  per-document PPI. (If I1 ships before V3, the module lands with I1 —
  build it with whichever milestone needs it first.)
- **Artboard setup** — TODAY THE ARTBOARD HAS NO UI AT ALL (fixed 960×600):
  document-setup dialog (size in any unit, PPI, background incl. none/
  transparent) + editable fields in the Design tab's no-selection state.
- **Vector export dialog** — SVG (as-is) + bitmap (PNG/JPG) at chosen scale
  (1x/2x/3x/custom) or exact pixel/physical size; transparent-background
  option; replaces the silent hardcoded 2× PNG.
- **Document title** in the subbar (parity with image) feeding
  `slugifyFilename` — kills the hardcoded `vector-artboard.*` names.

## Milestone I1 — Image precision pass

- **Crop rework** per decision 4 (today: drag-only, commits on release, no
  numbers/handles/confirm; state is one ref in the canvas).
- **Canvas size dialog** — grow/trim around a 3×3 anchor grid, extension
  fill (transparent/color). The primitive `resizeCanvas(doc, w, h, ox, oy)`
  ALREADY EXISTS with zero UI callers besides crop — this is mostly dialog
  work.
- **Image size upgrade** — the Photoshop pair: units + PPI (via the shared
  module) + resample on/off toggle (off = document PPI changes only) +
  interpolation choice (smooth/pixelated; `imageSmoothingQuality` is never
  set today) + percent mode.

## Milestone I2 — Image export + new-doc

- **Export dialog** — format (PNG/JPG), JPG quality slider (hardcoded 0.92
  today), scale or exact output size in any unit, transparent-vs-matte for
  JPG. Same dialog pattern the vector tool uses in V3.
- **New-document upgrade** — units/PPI-aware presets (incl. print sizes),
  background choice (transparent/white/color), custom preset save.

## Continuity thread (woven into milestones, not a milestone)

- Vector adopts `EditorMenubar` (File/Edit/Object/View) — with V1.
- Zoom cluster parity (vector gains 100%; same placement/controls) and
  status-bar parity (zoom · dims **with unit** · tool) — with V1/V3.
- Shortcut harmony: V/A/P/T mean the same everywhere; resolve `L`
  (lasso vs line) and `P` (pen vs polygon) collisions — with V1.
- **One shared dialog primitive** (portal, backdrop, Esc, focus trap +
  restore — none of the three existing image dialogs trap focus) — first
  dialog milestone that touches it (I1 or V3), then both editors migrate.
- Dead CSS from the image editor's pre-menubar header
  (`.image-editor-subbar-tools`, `.image-editor-zoom-readout`,
  `.image-editor-menu*`) — sweep with the parity work.

## Later (explicitly out of the above)

Gradients, dash patterns/linecap/linejoin, boolean ops, grouping, masks,
symbols/defs, snapping + smart guides for vector, area text,
text-to-outlines, combined-bounds multi-resize (if deferred from V1),
local-space numeric edits for rotated objects (pre-existing gap),
PNG pHYs (embedded DPI metadata), export-selection-only.

## Standing constraints

- Both editors: shell contract (`docs/ARCHITECTURE.md`), gates before
  delivery (integration + design; security when trust boundaries move —
  project-io validators, export paths).
- Vector modules are `@/`-alias-blocked from the test runner (known wall);
  new pure logic (bezier math, units) should be authored alias-free like
  `prompt-defaults.ts` so it IS testable.
- Size ceilings live in `image-editor/types.ts` (12k/side, 40M px) and
  `vector-editor/project-io.ts` (`MAX_DIMENSION` 20k, 4MB budget) — new
  size UIs must respect them.
