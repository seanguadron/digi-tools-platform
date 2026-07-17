---
gate: integration
date: 2026-07-17
surface: Registry-driven mobile tool gate (below 768px) + session-scoped preview override
result: PASS
findings: 2 required fixes (both applied)
---

# Integration gate — mobile tool gate

Audited the working tree against `docs/STANDARDS.md`.

## Result: PASS

| Rule | Status | Note |
|---|---|---|
| §1.1 Tool registered, not improvised | PASS | No new `ToolId`; the new fields only extend existing descriptors. Skills correctly has no `mobileSupport` (document pages don't gate). The gate's only link points at `/`. |
| §1.4 Shell contract conformance | PASS | Shell-level addition, documented in ARCHITECTURE §2 with a recyclable-primitive row for `useMediaQuery` and an updated add-a-tool recipe. Specificity of the `.is-mobile-gated` overrides correctly beats the `:has()` sub-bar handshake by one class. Every `createPortal` overlay across the three gated tools defaults closed and can only open from now-hidden controls, so none can leak past the gate. |
| §2.1 Catalogs validated | N/A | No `src/data/` file touched. |
| §2.2 Generated docs never drift | N/A | `roles.json` / `PROMPT_ROLES.md` untouched. |
| §2.3 Trust boundary validated | PASS | The sessionStorage override is a strict `=== "1"` check in try/catch, not a cast; `useMediaQuery` guards both `matchMedia` call sites. Corroborated by the same-day security gate. |
| §2.4 No injection primitives | PASS | No `eval`/`new Function`/`dangerouslySetInnerHTML` in the diff; allowlist unchanged (`theme-script.tsx` only). |
| §3.3 Graph must be true | PASS | `check:standards` green; ARCHITECTURE's gov:node marker untouched and its target exists. |
| §3.4 Two skill homes | N/A | No skill changed. |
| Conventions | PASS | kebab-case files, `use-*` hooks, `MobileToolGate` takes plain props, `"use client"` only where browser APIs demand it. |

## Required fixes (both applied)

1. **ARCHITECTURE.md line wrap** — "document" / "-style pages" split across a
   line break rendered as "document -style pages". Rejoined.
2. **Ledger** — this report plus the design-gate report are now filed
   (STANDARDS §3.2). The design gate ran and returned FAIL → all four
   findings fixed and re-verified; see
   `2026-07-17-design-gate-mobile-tool-gate.md`.

## Notes acted on

- The gate's flagged 760px/767.98px threshold mismatch is resolved: one
  `PHONE_MEDIA_QUERY` constant in `tool-registry.ts` now feeds both.
- ARCHITECTURE §5's globals.css zone map now names the trailing "Mobile tool
  gate" zone and says why it must stay last (source-order overrides).
- The gate asked for a manual check of Architect + Image Editor at 375px with
  the override ON — done: both stack and scroll, no horizontal scroll. The
  Image Editor's canvas remains a poor phone workflow by nature, which is
  what the gate exists to say.

## Health

`typecheck`, `lint`, `test` (22), `data:validate`, `check:standards`,
`check:security` all green.
