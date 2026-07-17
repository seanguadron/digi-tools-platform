---
gate: integration
date: 2026-07-16
surface: theme-bootstrap relocation — theme-script.tsx, layout.tsx, check-security allowlist, STANDARDS §2.4 text, ARCHITECTURE §6
result: pass (after fixes)
findings: 2 (1 Medium + 1 Low, both fixed before delivery)
---

# Integration audit: theme-bootstrap relocation

Run via the REGISTERED integration-gate subagent type (first registered run —
the 2026-07-15 YAML fix took effect). Original result FAIL (2 issues); both
required fixes were applied by the main agent before delivery, flipping the
surface to PASS.

| Rule | Status | Evidence | Fix |
|------|--------|----------|-----|
| §1.1 tool registration | N/A | No `src/lib/tool-registry.ts` or `src/app/tools/` change in this diff; not a tool surface. | — |
| §1.2/§1.3 design + a11y | N/A | `ThemeScript` renders `null`; the injected `<script>` has no DOM presence, no interactive/visible surface changed. Design gate correctly not triggered (AGENTS.md Rule 20 requires "visual presence"). | — |
| §1.4 shell contract / ARCHITECTURE accuracy | PASS | Not a "tool" — no registry entry or portal-slot surface touched. Verified ARCHITECTURE.md §6's rewritten sentence against code: `theme-script.tsx` exists at the stated path, uses `useServerInsertedHTML`, and `app-shell.tsx:19` is the toggle that writes the key. Confirmed "read pre-paint... injected into the streamed `<head>`" empirically: fetched the live dev server's raw SSR HTML — the `<script>` appears exactly once, unescaped, inside `<head>` before `<body>`. | — |
| §2.1/§2.2 catalogs/generated docs | N/A / PASS | No `src/data/` changes; drift check green. | — |
| §2.3 trust boundary | PASS | `theme-script.tsx:15-19` — `localStorage.getItem` checked against a strict `"light"|"dark"` allowlist, default `"dark"`, whole read wrapped in `try/catch`. Byte-identical to the pre-relocation logic (`git diff` confirms verbatim move). | — |
| §2.4 no injection primitives (code) | PASS | `check:security` green (reran independently). Grep of `src/` finds exactly one `dangerouslySetInnerHTML` — `theme-script.tsx` — matching the sole allowlist entries in `check-security.mjs` and `STANDARDS.md`, byte-for-byte identical path in all three places. | — |
| §2.4 allowlist consistency (docs) | LOW — FIXED | `.claude/agents/security-gate.md:32-33` still read "today: only the constant theme bootstrap in `src/app/layout.tsx`" — stale since the relocation; the Security gate's own spec contradicted the STANDARDS §2.4 text it defers to. | **Applied**: security-gate.md now names `src/components/theme-script.tsx`. |
| §3.1/§3.4 skill pins | N/A | No skill-directory changes. | — |
| §3.2 gate ledger | PASS | This report + the parallel security-gate report are the ledger entries. | — |
| §3.3 graph truth | PASS | `check:standards` green. Neither STANDARDS.md's nor ARCHITECTURE.md's gov:node marker changed — only body prose. `theme-script.tsx` is outside the §3.3 walker's scope, correctly needing no marker. | — |
| §4.1 consent gate | MEDIUM — FIXED | STANDARDS.md:11 makes any edit to that file consent-gated. At audit time, the §2.4 edit's only provenance was self-referential prose inside the rule itself; no SESSIONS.md entry existed. The 2026-07-15 precedent passed §4.1 specifically because the sessions entry provided the durable, independently-inspectable trace. | **Applied**: the 2026-07-16 SESSIONS.md entry now records the decision + consent basis (the owner-clicked task chip that explicitly scoped the allowlist update), closing the durable-trace gap before delivery. |
| Conventions | PASS | `theme-script.tsx` kebab-case; `"use client"` present only because `useRef`/`useServerInsertedHTML` require the client boundary. Component returns `null`; side effects confined to the `useServerInsertedHTML` callback. | — |

## Required fixes (ordered) — all applied before delivery

1. ~~`.claude/agents/security-gate.md:33` — `src/app/layout.tsx` → `src/components/theme-script.tsx`~~ **done**
2. ~~`.ai/notes/SESSIONS.md` — dated entry recording the §2.4 consent basis~~ **done** (2026-07-16 entry, via the sessions agent)

## Notes

- typecheck: clean. Independently reran and confirmed green: `check:standards`, `check:security`, `lint`, `npm test` (22/22).
- The agent ran `gate:sweep` for a heuristic read, noticed the `gate-status.json` write violated its read-only mandate, and reverted it — verified `git status` unchanged after.
- `gate-sweep`'s `TRIGGERS.security` globs don't cover `layout.tsx` or the check-security allowlist file itself — candidate heuristic improvement (recorded in the sessions entry as a learning, not an amendment).
- The Security judgment gate ran in parallel (registered type) and passed — see `2026-07-16-security-gate-theme-script-relocation.md`.
- STATE.md's dev-only-noise backlog line is resolved by this change (handled in the end-of-session STATE.md rewrite).
