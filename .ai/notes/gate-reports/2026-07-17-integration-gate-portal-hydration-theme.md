---
gate: integration
date: 2026-07-17
surface: Portal hydration fix — usePortalTarget, ToolSubbar, PromptBuilder print sheet (restores the light theme on the three cockpit routes)
result: FAIL → PASS (gate found a real gap; fixed and re-verified)
findings: 1 High from the integration gate (latent portal), fixed
---

# Integration gate — portal hydration / theme fix

Shell-contract change (§1.4), audited against `docs/STANDARDS.md`.

## The bug

The saved light theme was ignored on the three full-bleed cockpit routes
(they forced dark; Welcome and Skills were fine). Pre-existing; found during
the mobile-gate session and confirmed in a real PRODUCTION build.

## Root cause (proven, not theorised)

`ToolSubbar` and `PromptBuilder`'s print-sheet portal read the DOM **during
render** (`typeof document === "undefined" ? null : document.body` /
`getElementById`). The server rendered `null`, the client rendered a portal —
different tree shapes, i.e. a hydration mismatch. React's only recovery at
the root is to discard the server HTML and client-render the document, which
MOUNTS the `<html>` host singleton. Mounting calls
`acquireSingletonInstance`, which **clears every attribute** on the element
and reapplies only the JSX props — reasserting `layout.tsx`'s hardcoded
`data-theme="dark"` over what the no-flash bootstrap had set.

Evidence chain:

1. A temporary probe proved the bootstrap RAN and set `light` (t≈600ms), then
   something set `dark` twice (t≈1800ms) — hydration time.
2. A `setAttribute` trap captured the stack: `acquireSingletonInstance →
   setInitialProperties → setValueForAttribute`, via
   `commitHostSingletonAcquisition`.
3. A probe attribute set by the bootstrap SURVIVED on `/tools/skills` (no
   portal → clean hydration) and was STRIPPED on `/tools/image-editor`
   (portal → acquisition). `<html>` was left carrying exactly the three JSX
   attributes.
4. No console errors at any point — React never logged this recovery, which
   is why it went unnoticed.

`suppressHydrationWarning` could not have helped: this is not a hydration
diff being patched, it is an acquisition.

## The fix

- NEW `src/hooks/use-portal-target.ts` — `usePortalTarget(elementId?)`, a
  `useSyncExternalStore` hook whose SERVER snapshot is `null`, so the
  hydration render matches the server exactly; the portal mounts before
  paint, so the bar still never blanks. Mirrors the existing `useMediaQuery`
  store idiom (first drafted with useState+useLayoutEffect; the React
  Compiler rule `react-hooks/set-state-in-effect` correctly rejected it).
- `tool-subbar.tsx` → `usePortalTarget("app-subbar-slot")`.
- `prompt-builder.tsx` → `usePortalTarget()` for the print sheet.
- `docs/ARCHITECTURE.md` §2 REWRITTEN: it previously mandated this exact
  anti-pattern ("No effect/mounted gate — deferring the portal blanks the bar
  for a frame"). It now requires `usePortalTarget` and explains why; §3's
  primitives table gained a `usePortalTarget` row.
- `theme-script.tsx` and `layout.tsx` are UNCHANGED — the §2.4 allowlist is
  untouched (still names only `theme-script.tsx`), so no security gate is
  owed by Rule 19 (no trust boundary moved).

- `prompt-card-workbench.tsx` → `usePortalTarget()` for its DragOverlay
  portal. **Added after the integration gate FAILED this change** (see
  Corrections below).

## Corrections — the gate caught a false claim in this report

An earlier draft of this report claimed "other portals were checked and are
safe: the dialogs, palettes and panels are gated behind an `open` state." The
integration gate proved that false for
`prompt-card-workbench.tsx:391` — its DragOverlay portal was gated by nothing
but `portalTarget` itself, the identical shape to the proven-buggy print
sheet, and the component IS mounted and SSR'd on first load (the C.R.A.F.T.
panels are hidden with `aria-hidden`/`inert`, not conditionally rendered).
Fixed.

It was a LATENT bug, not a live one, and measuring that sharpened the root
cause: **the hazard is the inserted DOM, not the portal.** `body >
.print-sheet` exists in the rendered document (real nodes added during
hydration → container diverges from the server → breakage), whereas the idle
DragOverlay inserts nothing (`body > [dnd overlay]` → absent), which is
exactly why the 20-case matrix passed 20/20 with the idiom still present. A
portal whose children render to nothing is inert; one that adds nodes is not.
`use-portal-target.ts` and ARCHITECTURE §2 now state this distinction
precisely rather than the looser "portals that render on first render".

The gate's sweep independently cleared the other 13 render-time `document`
reads across 12 files (dialogs/palettes default closed at their call sites,
the Image Editor's status portal is `doc`-gated, the rest run only in event
handlers) — so `prompt-card-workbench` was the sole remaining exception.

## Verification

Real production build (`npm run build` + `npm start`), 20-case matrix — 5
surfaces (`/`, `/tools/skills`, and the three cockpits) × stored theme
`light` / `dark` / invalid / absent: **20/20 PASS**. The subbar portals into
`#app-subbar-slot` on every cockpit load and the
`.context-bar:has(.prompt-subbar)` handshake still hides the default text
(computed `display: none`). No flash: the bootstrap's value now survives, so
`data-theme` never changes after first paint. `typecheck`, `lint`,
`check:standards`, `check:security` green.

Note for future debugging: dev-mode Fast Refresh triggers the same singleton
re-acquisition, so it resets the theme on ANY route after a hot update. That
made dev an unreliable place to verify this; the production build is the
honest test bed.

## Amendment flag (needs the owner's consent)

Candidate STANDARDS rule: "a portal that renders on first render must resolve
its target through `usePortalTarget`; never read the DOM during render." This
bug was invisible (no console error), cost three routes their SSR as well as
their theme, and the old ARCHITECTURE text actively instructed the
anti-pattern — a deterministic check (grep for the `typeof document ===
"undefined" ? null :` idiom in a render path) would be cheap.
