---
gate: security
date: 2026-07-17
surface: Registry-driven mobile tool gate (below 768px) + session-scoped "Preview anyway" override
result: PASS
findings: 1 Low (fixed)
---

# Security gate — mobile tool gate

Audited the uncommitted working tree on `main`: the registry-driven mobile
gate (`mobileSupport` / `mobileGateNotes` on `ToolDescriptor`), the
`MobileToolGate` component, the sessionStorage-backed override hook, the
`useMediaQuery` hook, the Prompt Builder dock default, the globals.css
triage + gate section, and the ARCHITECTURE.md updates.

## Result: PASS (1 Low, fixed before delivery)

| # | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | Low | `useMediaQuery` called `window.matchMedia` unguarded in both the subscribe path and the client snapshot. It runs during render and the app has no error boundary, so a locked-down webview that blocks the API would take the Prompt Builder down over a layout preference. | `src/hooks/use-media-query.ts:11`, `:20` (pre-fix) | FIXED — both calls wrapped, refusal resolves to `false`, mirroring the storage guard in `use-mobile-preview.ts:37-41`. |

No High or Medium findings. No new injection primitives: the §2.4 allowlist
is unchanged and still names only `src/components/theme-script.tsx`.

## Why it passes on the merits

- **The new sessionStorage read clears §2.3 by construction.** The override
  is a strict `getItem(...) === "1"` two-value comparison, not a bare cast —
  a corrupted, missing, or tampered value resolves to `false` (the safe
  default) with no parse and no throw. The read and the write are both
  inside try/catch, so storage refusal (privacy mode, sandboxed iframe)
  costs persistence and nothing else. The gate flagged this as the pattern
  to imitate when the known latent findings in `prompt-session.ts` /
  `prompt-storage.ts` are eventually hardened.
- **The storage key can only take three values.** `toolId` reaches
  `storageKey()` only from `activeTool.id`, matched against the closed
  compile-time `ToolId` union via `TOOLS.find((tool) => pathname ===
  tool.href)`. No path admits an arbitrary string.
- **All gate-screen strings are first-party catalog literals** (`tool.name`,
  `tool.tagline`, `mobileGateNotes`) rendered as React-escaped JSX text —
  the same trust class as the existing registry fields, disconnected from
  the session-import path.
- **The gate is UX, not access control.** No auth, no privileged data: a
  bypass (devtools, forged flag, spoofed viewport, or resizing the window)
  reveals only what a desktop visitor already reaches directly. Recorded
  explicitly so it is never later mistaken for a security boundary.
- CSS changes are inert (no remote `url()`/`@import`, no `expression()`);
  `next.config.ts`, `browser-download.ts`, `prompt-session.ts`, and
  `prompt-storage.ts` are untouched.

## Amendments

None proposed. This change needed none of the judgment calls §2.3/§2.4
exist to adjudicate — a closed-set flag plus static text.
