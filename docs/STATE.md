<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-17 (end of the "mobile tool gate + portal hydration"
session).

## Now

Branch **`main`**, in sync with `origin/main` through `b69b570` (the
theme-script relocation, committed + merged + pushed at the top of this
session). This session's mobile-gate work is **UNCOMMITTED in the tree**,
green and gate-passed, awaiting the owner's word (see In flight).

**What this session changed.** Phones now get an honest gate instead of a
broken cockpit. At **below 768px**, the three full-bleed tools (Prompt
Builder, Architect Wizard, Image Editor) render an explainer card — what the
tool is, what it needs a bigger screen for, where the data lives — with a
**Preview anyway** override; Skills and Welcome are untouched because they
already work on a phone.

1. **The gate is registry-driven.** `mobileSupport: "gated"` +
   `mobileGateNotes` on `ToolDescriptor` are the whole opt-in; the shell
   renders `MobileToolGate` and the CSS does the rest. Both shell classes
   (`is-mobile-gated` / `is-mobile-preview`) are **INERT at 768px and
   above** — the media query is the only judge of "phone", so SSR output and
   desktop rendering are identical with or without them.
2. **The override is session-scoped.** `useMobilePreviewOverride`
   (sessionStorage, strict `=== "1"` read in try/catch) survives navigation
   and reloads, re-gates next visit. Preview mode shows the full tool plus a
   persistent squeeze-in chip.
3. **The outright phone breakages are triaged**, so the override lands on
   something usable: the Prompt Builder's C.R.A.F.T. workspace no longer
   computes to **0px wide**, the tool header no longer explodes the 42px
   context bar to **221px**, and the document scrolls again at phone widths
   (the pre-existing full-bleed `overflow: hidden` lock is desktop-only now).
4. **Top-bar tabs** no longer hide the last tab off-edge: the brand wordmark
   drops below 768px (the ≤640px precedent) and the clipped edge fades.

**Then the second half of the session fixed a bug the first half uncovered:
the saved light theme was ignored on all three cockpit routes** (they forced
dark; Welcome and Skills were fine). Not cosmetic — those routes were
throwing away their server rendering entirely.

- **Root cause:** `ToolSubbar` and the Prompt Builder's print-sheet portal
  read the DOM DURING RENDER, so the server rendered `null` and the client
  rendered a portal. That tree-shape mismatch made React discard the server
  HTML and client-render the document, which MOUNTS the `<html>` host
  singleton — and mounting calls `acquireSingletonInstance`, which **clears
  every attribute** and reapplies only the JSX props, reasserting
  `layout.tsx`'s hardcoded `data-theme="dark"` over the bootstrap's value.
  React logs NOTHING for this, which is why it survived unnoticed.
  `suppressHydrationWarning` was never relevant: this is an acquisition, not
  a hydration diff being patched.
- **Fix:** the new `usePortalTarget` hook (`useSyncExternalStore`, server
  snapshot `null`) resolves portal targets without lying to hydration; the
  portal still mounts before paint, so the bar never blanks.
  `theme-script.tsx` and `layout.tsx` are UNCHANGED — the §2.4 allowlist
  never moved.
- **Verified in a real production build**, 20/20: 5 surfaces × stored
  light/dark/invalid/absent.
- The integration gate then FAILED the fix and was right: the same idiom
  survived in `prompt-card-workbench.tsx`. Fixed. It was LATENT, and
  measuring why sharpened the rule — **the hazard is the inserted DOM, not
  the portal**: the print sheet adds real nodes to `<body>` during hydration
  (breaks it), while an idle dnd-kit `DragOverlay` adds none (inert), which
  is why the matrix passed with it still present.

**Third: light mode was fixed for real** — reaching those routes exposed that
its appearance there had never been looked at. A measured WCAG audit found
**~247 AA contrast failures in light**, dominated by `--brand-cyan` used as
TEXT (1.5–1.8:1 against a 4.5:1 floor). This landed the long-pending "cyan as
light-theme text" amendment (proposed 2026-07-14).

- Tokens now split by **job, not hue**: `--brand-cyan-text` /
  `--brand-magenta-text` for any text (darkened in light, IDENTICAL to the
  marker accent in dark, so dark rendering never changed),
  `--brand-cyan-foreground` for ink on a cyan fill (`--primary-foreground`
  was wrong there — it flips near-white in light, giving white-on-cyan at
  1.78:1), and `--warning-text` for the amber readiness chip.
- The **design gate then FAILED this and was right, twice.** (a) The
  sitewide `:focus-visible` ring measured **1.5:1** in light — the focus
  indicator was effectively invisible — and my own DESIGN_DIRECTION text
  asserted it was fine. Light `--brand-cyan` is retuned to
  `oklch(0.6 0.1 200)` (ring 3.16:1, WCAG 1.4.11); dark untouched. (b) The
  Architect's CANVAS node labels still had an inline accent at ~2.3:1 —
  invisible to my audit because **an empty canvas has no nodes to measure**.
- The Architect's per-block accents come from data and were applied inline,
  which no theme rule could reach; the component now passes
  `--glyph-accent` and CSS darkens it in light theme, per-block hue intact.
- The rule is recorded in `docs/DESIGN_DIRECTION.md` → "Accent colors mark;
  they do not spell".
- **5 surfaces × both themes, INCLUDING the Architect with 10 nodes on the
  canvas: 0 contrast failures, 0 theme failures** (was ~247 in light).
- Two verification lessons, both earned the hard way and now in
  DESIGN_DIRECTION: **text and non-text are different floors AND different
  measurements** (4.5:1 text-on-background vs 3:1 border-against-adjacent —
  a text-only sweep passes a page whose focus rings are invisible), and
  **audit a surface with CONTENT in it**, not its default empty state.

Health: `typecheck`, `lint`, `test` (22), `data:validate`, `check:standards`,
`check:security` all green as of this rewrite.

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one. Never `npm run build` while a dev
  server may be live (shared `.next/`).
- **If CSS edits stop taking effect:** `npm run dev:clean` (clears `.next`,
  then starts dev). A stale Turbopack cache can serve old CSS forever — see
  the gotchas below.
- **`StartDigiTools.bat` now health-CHECKS port 5100** rather than trusting
  that the socket is held: a wedged dev server keeps listening while
  answering nothing, and the old check happily said "already running" and
  opened a browser onto a dead server. It now curls the port, and offers to
  end a non-responding process before starting fresh.
- **Framework:** read `docs/ARCHITECTURE.md` before building or changing a
  tool — registry, portal slots, ToolSubbar, useUndoableState/useLocalDraft,
  the mobile gate (§2), the add-a-tool recipe. STANDARDS §1.4 gates
  conformance. The theme bootstrap lives in `src/components/theme-script.tsx`
  (the repo's ONE sanctioned `dangerouslySetInnerHTML`, §2.4).
- **Checks:** `npm run typecheck` · `npm run lint` · `npm test` ·
  `npm run data:validate` · `npm run check:standards && npm run check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` Codex (36),
  `.claude/skills/` Claude Code (16 incl. `/digi`); never cross-install.
  Log material skill use: `npm run skill:log -- <skill> "<surface>"`.
- **Gate agents:** `integration-gate`, `security-gate`, `design-gate` all
  register as subagent types (re-confirmed 2026-07-17 — all three ran) —
  invoke them via the Agent tool; they are read-only and save nothing
  themselves (the main agent writes the ledger reports).
- **Headless preview gotchas** (this list keeps earning its keep):
  - The pane can report a 0×0 viewport — drive and verify via
    DOM/`javascript_tool`, not screenshots. `computer{action:"screenshot"}`
    may simply time out.
  - The Image Editor's canvas is RAF-driven (no repaint headless); the
    Prompt Builder's flow-panel carousel scrolls via RAF too.
  - React reads after a `.click()` need a deferred read (setTimeout).
  - **`window.scrollTo(x, y)` silently no-ops** — `html` has
    `scroll-behavior: smooth`, which is RAF-driven. Use
    `scrollTo({ top, behavior: "instant" })` to verify scroll reachability.
  - **A stale `.next` Turbopack cache can serve old CSS indefinitely** while
    JS keeps hot-reloading, and it SURVIVES a dev-server restart. Symptom:
    `getComputedStyle` disagrees with the file on disk. Confirm by fetching
    the served stylesheet with `cache: "no-store"` and grepping the compiled
    rule; fix with `rm -rf .next` (gitignored) while the server is stopped.
  - **Dev is the WRONG place to verify hydration or theme behavior.** Fast
    Refresh re-acquires the `<html>` singleton on every hot update, which
    resets `data-theme` on any route and silently poisons a test matrix. Use
    a production build (`npm run build` + `npm start`, dev server stopped
    first — they share `.next/`).

## Built

Four tools registered in `src/lib/tool-registry.ts` (Prompt Builder,
Architect Wizard, Skills Wiki, Image Editor); the shell contract and shared
primitives are documented in `docs/ARCHITECTURE.md`. The Prompt Builder is
the flagship (C.R.A.F.T. prompts from explicit card choices; see `PRODUCT.md`
+ `CONTEXT.md`).

**Prompt Builder catalog:** 35 roles, 32 card lineages (4 grades each), 8
output types, 25 archetypes (daily drivers first, then App build
handoff/Agent skill/Agent gate/Social post at 7–10). The `action-clarify`/ASK
card (grade 1 = the owner's "ask me clarifying questions until you have 95%
confidence" pattern) and `format-tiers`/TIER card are equipped by the
APP/SKILL/GATE archetypes.

**Image Editor:** Photopea-style cockpit — menubar in the context subbar,
tool strip, docked canvas + minimap, tabbed right dock, statusbar in the
global footer, PNG/JPG/layered-.zip export.

**Shared framework:** `ToolSubbar` (+Title/Chip/Actions), `save-status`,
`useUndoableState`, `useLocalDraft`, `ThemeScript`, `EditorMenubar`,
`EditorTabs`+`tabPanelProps`, `zip.ts`, `browser-download.ts`,
`prompt-storage.ts`, and now `MobileToolGate` + `useMediaQuery` +
`useMobilePreviewOverride` (phone threshold = `PHONE_MEDIA_QUERY` in
`tool-registry.ts`, the ONE source of truth, byte-identical to the CSS).

## Backlog / in flight

- **In flight — TWO commits' worth of work, uncommitted** (awaiting the
  owner's word). They are separable and should probably land as two commits:
  1. **The mobile tool gate** — `mobile-tool-gate.tsx`, `use-media-query.ts`,
     `use-mobile-preview.ts` (new), `app-shell.tsx`, `tool-registry.ts`,
     `globals.css`, plus the three `2026-07-17-*-mobile-tool-gate` reports.
  2. **The portal hydration / theme fix** — `use-portal-target.ts` (new),
     `tool-subbar.tsx`, `prompt-card-workbench.tsx`, `prompt-builder.tsx`
     (also carries the gate's `PHONE_MEDIA_QUERY` change), plus
     `2026-07-17-integration-gate-portal-hydration-theme.md`.
  3. **The light-theme accent tokens** — `globals.css` (the three new
     tokens + 63 text swaps), `architect-wizard.tsx`,
     `docs/DESIGN_DIRECTION.md`.
  4. **Dev-environment hardening** — `StartDigiTools.bat` (health check),
     `package.json` (`dev:clean`).
  Shared: `docs/ARCHITECTURE.md`, `docs/STATE.md`, `.ai/notes/SESSIONS.md`.
- **The cockpit light-theme bug is FIXED** (see Now). It was never the theme
  script's fault: the 2026-07-16 relocation was sound, and the earlier
  restore-matrix claim was simply only ever checked on the home page. The
  real culprit was the render-time portal read that ARCHITECTURE.md itself
  used to mandate.
- **Next session:** run the `.ai/agent-evals/` fixtures against the
  registered gates (they have still never run through it) and add fixtures
  for the newer surfaces (image editor, prompt catalog, framework).
- **Archetype card art:** all illustration entries remain `status: planned`.
- **Pending amendments** (`npm run amendments`, owner consent needed): ~~cyan
  as light-theme text color~~ → LANDED 2026-07-17 in DESIGN_DIRECTION
  ("Accent colors mark; they do not spell"); §2.3 bare-cast hardening;
  cardSystem affinity validator rule; §3.3 "every agent file must carry a
  gov:node marker"; one motion/icon item from earlier sessions; plus these
  raised this session — a candidate rule that a first-render portal must use
  `usePortalTarget` (cheap to enforce: grep the render-time `document` read),
  and —
  DESIGN_DIRECTION's "no horizontal page scrolling" line is ambiguous about
  the top-bar tab strip, and a candidate rule that a full-bleed surface must
  not depend on the unscoped `overflow: hidden` lock.
- **`npm run amendments` is line-wrap fragile** (found 2026-07-17): its regex
  matches line by line, but SESSIONS.md is hard-wrapped at ~76 chars, so a
  flag split across a wrap is INVISIBLE to the consent queue. Two were
  hiding that way and are now rejoined (the queue reads 8, not 6). The
  script should normalise whitespace before matching; it also prints only
  the flag's tail line, so one entry shows as a contextless bullet.
  Candidate fix — the consent gate is only as good as this scanner.
- **Deferred polish:** unify the "Restoring..." vs "Restoring…" glyph (needs
  owner sign-off); optional `writeStoredOrThrow` for the architect save path;
  output docks + dialog portals + prompt-role-workbench tablist remain the
  sanctioned extraction backlog (ARCHITECTURE §3). gate-sweep's
  `TRIGGERS.security` globs don't cover the check-security allowlist file
  itself — candidate heuristic improvement.

## Pointers

- Framework contract: `docs/ARCHITECTURE.md`. History:
  `.ai/notes/SESSIONS.md` (newest-first). Rules: `docs/STANDARDS.md`. Gate
  ledger: `.ai/notes/gate-reports/`. Domain language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
