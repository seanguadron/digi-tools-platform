---
gate: security
date: 2026-07-16
surface: theme-bootstrap relocation — layout.tsx inline script → theme-script.tsx via useServerInsertedHTML; §2.4 allowlist relocated 1:1
result: pass
findings: 1 (Low; call-site comment applied)
---

# Security audit: theme-bootstrap relocation (`useServerInsertedHTML`)

Run via the REGISTERED security-gate subagent type (first registered run —
the 2026-07-15 YAML fix took effect).

## Result: PASS (1 Low finding)

| # | Severity | Finding | Evidence | Fix |
|---|----------|---------|----------|-----|
| 1 | Low | `<ThemeScript />`'s JSX position (top of `<body>`) doesn't match where its script actually lands in the DOM (`<head>`, before `<body>`). A future edit that adds `document.body`-dependent logic to `THEME_SCRIPT`, reasoning from the JSX call site, would silently break (script runs before `<body>` parses) | `src/app/layout.tsx` renders `<ThemeScript />` inside `<body>`; live server HTML (curled `/` and `/tools/prompt-builder` against the running :5100 dev server) places the script immediately before `</head>`, both routes, single occurrence each | **Applied**: one-line reminder comment at the `<ThemeScript />` call site in `layout.tsx` (the header comment in `theme-script.tsx:6-11` already documented it) |

## Notes

- **(1) Input surface** — unchanged and still constant. `THEME_SCRIPT` in `src/components/theme-script.tsx:12-22` is byte-identical to the removed `themeScript` constant (verified via diff and via the live-served HTML matching verbatim). `ThemeScript()` takes no props, closes over nothing but the module constant, and the ref guard (`inserted.current`) only controls *whether* the fixed string is emitted, never *what* is emitted. No new dynamic input path exists.
- **(2) `useServerInsertedHTML` risk delta** — none found. Confirmed it's a genuine first-party Next 16.2.9 export (`node_modules/next/dist/client/components/navigation.js:81-82`), the same mechanism styled-components/emotion/MUI use in production for exactly this "runs in the SSR stream, never enters the hydrated tree" pattern. `next.config.ts` defines no CSP/nonce (untouched by this diff), so the escaping/execution semantics of an inline `<script>` are identical before and after; only the insertion *point* moved. One genuine, minor positive: the S1 allowlist exemption now covers a single 39-line file dedicated solely to this script, versus previously exempting all of root `layout.tsx` — smaller blast radius for the same exemption.
- **(3) Allowlist relocation correctness** — confirmed 1:1, not accumulated. `check-security.mjs`'s `ALLOWLIST` Set diff shows the old entry replaced, not appended. Full-tree grep for `dangerouslySetInnerHTML` across `src/` returns exactly two lines, both in `src/components/theme-script.tsx` (one comment, one real usage); `src/app/layout.tsx` now has zero injection primitives. `npm run check:security` passes.
- **(4) STANDARDS §2.4 text vs. deterministic half** — they agree; `check:standards` and `check:security` both green. `docs/ARCHITECTURE.md` §6's updated sentence is accurate against code: `app-shell.tsx:19` writes `digitools.theme`, `theme-script.tsx` reads it, both using the same two literal values.
- Verified server-rendered placement independently: curled the live dev server for `/` and `/tools/prompt-builder`. Both show exactly one `digitools.theme` occurrence, inside a `<script>` immediately preceding `</head>`. No duplication across routes.
- The React-warning-gone claim was verified by the main agent in the browser (zero console errors across 6+ full loads); this agent verified the architectural reason (content injected outside the React element tree the client hydrates against) and the HTML mechanics directly.
- Consent-trace limitation noted by the agent (a diff-only audit cannot attest to in-conversation approval) — resolved by the durable §4.1 consent record in `.ai/notes/SESSIONS.md` (2026-07-16 entry), as required by the integration gate.
