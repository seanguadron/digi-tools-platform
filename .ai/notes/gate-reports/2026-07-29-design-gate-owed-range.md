---
gate: design
date: 2026-07-29
surface: V3 vector documents + I2 image export/new-doc + roving-radiogroup (3cc425e, 315c7fa, 9b255bd)
result: BLOCKED (agent) — still OWED
findings: none produced; agent terminated on the provider spend limit
---

# Design gate — the owed range — STILL BLOCKED

The design-gate agent was relaunched on 2026-07-29 alongside the
integration and security re-runs (both of which completed and are now
discharged). It terminated early on the provider's monthly spend limit
before producing a report — the same cause that blocked it on 2026-07-28.

**This is the one gate still owed.** Everything else in the 2026-07-28
GATE DEBT list is now discharged:

| Owed run | Status |
|---|---|
| V2 integration | DISCHARGED (`2026-07-29-integration-gate-owed-range.md`) |
| V3 integration + I2 integration | DISCHARGED (same report) |
| V3 security + I2 security | DISCHARGED (`2026-07-29-security-gate-owed-range.md`) |
| V3 design + I2 design | **STILL OWED — this entry** |

## What partially covers it in the meantime

- The 2026-07-29 integration gate independently caught and forced a fix on
  the one finding that was really design-shaped: canvas-overlay contrast
  against the now user-editable artboard background (the palette now flips
  by background luminance).
- V2's design gate DID complete on 2026-07-28 (FAIL→PASS, 5 findings
  applied), so the point-text surface has a real design audit.
- Main-agent inline review + live browser verification are recorded in
  `2026-07-28-gates-vector-documents.md` and
  `2026-07-28-gates-image-export-newdoc.md`.

## Un-audited by a design agent

The V3/I2 dialog chrome (`.editor-dialog-*` cluster), the vector subbar
title input's hover-reveal affordance, the unit-aware statusbar, the
Design-tab Artboard section, the image New-doc preset grid, and the export
dialogs' layout in both themes.

Re-run when capacity returns.
