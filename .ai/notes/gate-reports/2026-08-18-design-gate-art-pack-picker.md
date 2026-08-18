---
gate: design
date: 2026-08-18
surface: "CRAFT deck art-pack picker (.art-pack-switch in the prompt subbar)"
result: FAIL -> fixed same session (1 High applied, 1 Low verified, 0 open)
findings: 1 High (applied), 2 Low (1 verified in browser, 1 noted)
---

# Design gate — art-pack picker

## Findings and dispositions

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | High | The picker invented a third segmented-button idiom: 999px pill, 24px height, bordered tray, no pressed state, no transition. The app's existing idiom is `.editor-dialog-seg` / `.editor-dialog-seg-btn` (bare group, 8px radius, 28px min-height). | **Applied.** `.art-pack-switch` restyled to the bare-group idiom: tray chrome removed (`inline-flex; gap: 4px`), options now 8px radius / 28px min-height / weight 700 / `var(--input)` border / `var(--background)` fill, plus `:active:not(.is-active) { scale(0.97) }` and 150ms color/background/border transitions (reduced-motion-safe via the sitewide rule). Browser-verified: computed styles match the template control exactly. |
| 2 | Low | Responsive claim unverified by the agent (no browser). | **Verified in browser**: 900px — renders, no overlap with title/history/continue, within the bar; 768px — renders, no overlap, no horizontal document scroll; 375px — the whole `.prompt-subbar` is `display:none` per the pre-existing mobile tool gate, so the control is correctly desktop-only. |
| 3 | Low (note) | DESIGN_DIRECTION.md has no section describing the world-switch control; `role="group"`+`aria-pressed` vs. the role-tabs `tablist` convention is a consistency question, not a defect. | Flagged for the sessions log as a proposed amendment (document the control in DESIGN_DIRECTION's CRAFT section, owner consent). The agent's note that Fantasy/Superhero were 0/226 was stale — both packs generated 226/226 this session. |

## Passing checks

Color tokens (theme vars only, cyan marker/text split — byte-match of the
seg-btn recipe); typography (inherits Open Sans, 0.72rem matches existing
compact tokens); accessibility grammar (real buttons, `aria-pressed`, state
never color-only, sitewide focus ring); motion (instant re-render, no
unearned choreography); voice (plain labels).

Verification: computed-style parity + three-tier responsive sweep in the
running dev server (Turbopack needed a content-hash jolt + reload to serve
the edited stylesheet — the known staleness failure, worked around without
restarting Sean's server).
