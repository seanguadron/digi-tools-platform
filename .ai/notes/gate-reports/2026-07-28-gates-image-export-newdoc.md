---
gate: integration+security+design (judgment agents BLOCKED — spend limit)
date: 2026-07-28
surface: Image Editor — export dialog + new-doc upgrade + continuity sweep (I2)
result: deterministic halves PASS + main-agent inline review; agent re-runs OWED
findings: inline review notes below
---

# Gates — Image Editor export/new-doc (I2) — agents blocked

Same posture as V3: the monthly subagent spend limit blocks judgment
agents; deterministic halves + inline review recorded, agent re-runs owed.

## Deterministic halves — all green

typecheck · lint · test (53) · data:validate · check:standards ·
check:security.

## Main-agent inline review

- **§1.4** — both dialogs (Export NEW, New-doc REWRITTEN) build on the
  shared `EditorDialog` primitive (focus trap + restore), which begins the
  planned migration of the image editor's dialogs; ImageSize/CanvasSize
  stay on the older pattern deliberately (rebuilt and gate-passed earlier
  TODAY — migrating them without judgment gates available adds risk; listed
  in the backlog). `slugifyFilename` names both export paths.
- **§2.3** — no new external reads: the export options are typed
  numbers/enums produced by fixed controls; output dims validity-gated at
  the button AND capped at 12000/side; JPEG quality clamped 0.5–1; the
  new-doc background is a color-input value handed to canvas fillStyle
  (never markup).
- **§2.4** — no new interpolation into markup anywhere in the diff.
- **§5** — `.editor-dialog-presets/-preset` extend the shared-chrome
  cluster; DEAD CSS REMOVED (the pre-menubar `.image-editor-subbar-tools`,
  `.image-editor-zoom-readout`, `.image-editor-menu*` blocks + the stale
  comment in editor-menubar.tsx) — zero TSX references confirmed by grep
  before deletion.
- **Design notes** — the new-doc print presets (Letter/A4 @300) express the
  units program in the entry point; JPG's no-alpha matte behavior is stated
  in plain copy; the format/scale/background segmented rows reuse the
  established pattern (counted into the chipped roving-tabindex fix).

## Browser verification (running dev server)

New… → 6 presets; Letter preset → 2550×3300 @300 + White background creates
correctly (statusbar confirms). Export → JPG shows the quality slider +
matte hint; exact width 1275 aspect-locks height to 1650; filename preview
`untitled.jpg`. Focus trap inherited from EditorDialog (verified on the
vector dialogs, same component).

## Owed

Integration + security + design agent runs for I2 (with V2's integration
re-run and V3's three) when subagent capacity returns. Deferred to backlog:
migrating ImageSize/CanvasSize onto EditorDialog; custom new-doc preset
save.
