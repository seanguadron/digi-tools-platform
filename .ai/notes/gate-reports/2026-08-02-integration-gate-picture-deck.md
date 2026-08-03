---
gate: integration
date: 2026-08-02
surface: PICTURE Deck (Tool 06, /tools/picture-deck) + CRAFT Deck rename + card-engine extraction (commits e54d3dc..5bebe10)
result: FAIL -> fixes applied, re-verified
findings: 2 Medium (both fixed), 1 Low (fixed)
---

# Integration audit: PICTURE Deck (Tool 06)

Agent ran read-only over the full commit range with live check runs
(data:validate, check:standards, check:security, typecheck, 102/102 tests —
all green). Per-rule verdict:

| Rule | Verdict |
|---|---|
| §1.1 registration completeness | PASS (registry-driven nav/home, thin server page) |
| §1.4 portal-slot chrome | PASS (ToolSubbar + usePortalTarget print sheet) |
| §1.4 portal-target idiom | **FAIL Medium — fixed** |
| §1.4 per-tool modifier class | **FAIL Low — fixed** |
| §1.4 shared primitives reused | PASS (card-engine, workbench, proof lab, library panel, dock, dictation, flow nav all shared) |
| §2.1 catalog validation | PASS (both validators chained; 21 picture tests; same-change registration) |
| §2.3 trust boundaries (6 keys) | **FAIL Medium — fixed** (5/6 were validated; favorites-v1 was not) |
| §2.4 injection primitives | PASS |
| §3.3 governance graph | PASS |
| conventions | PASS |

## Findings and applied fixes

1. **Medium §2.3 — favorites-v1 read was a bare generic cast.**
   `readStored<string[]>` returned whatever JSON parsed; a tampered value
   (`"null"`, `"{}"`) became non-array state and `favorites.includes(...)`
   threw on first render, taking down the route (no error boundary exists).
   Present in the new `picture-archetype-toolbar.tsx` AND byte-identical in
   the CRAFT sibling. FIX: new `readStoredStringArray` helper in
   `src/lib/prompt-storage.ts` (Array.isArray + per-entry typeof filter);
   both toolbars now use it. Verified in-browser: `"null"` and `"{\"a\":1}"`
   written to both keys, both routes render (18/25 archetype buttons).

2. **Medium §1.4 — render-time portal target.**
   `typeof document === "undefined" ? null : document.body` in both
   archetype toolbars — the exact idiom ARCHITECTURE forbids for
   first-render portals. FIX: both use `usePortalTarget()`.

3. **Low §1.4 — missing per-tool sub-bar modifier class.**
   Both deck headers rendered `<ToolSubbar>` bare while the other three
   tools pass a modifier. FIX: `picture-deck-subbar` /
   `prompt-builder-subbar` added; verified in the DOM.

## Notes recorded for the backlog / sessions log

- The PICTURE art manifest's drift check runs through `data:validate`
  (checkDocs) rather than `check:standards` the way §2.2 names
  PROMPT_ROLES.md; both land on prebuild/pre-commit/CI. Amendment candidate:
  generalize §2.2's generated-doc rule.
- `CONTEXT.md` has no PICTURE Deck vocabulary yet (Subject, Intensity dial,
  Midjourney tail, panel letters, archetypes) — no rule requires it; noted
  as follow-up.
