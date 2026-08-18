---
gate: security
date: 2026-08-18
surface: "CRAFT deck art-pack picker (prompt-builder.tsx, prompt-builder-header.tsx, art-pack.ts, globals.css)"
result: PASS
findings: 1 Low (optional hardening, not applied)
---

# Security gate — art-pack picker

Trust boundary: the picker restores the active art pack from localStorage
(`digitools.prompt-builder.art-pack-v1`) and newly exposes fantasy/superhero
pack strings (names, bios) in the deck UI.

## Findings

| # | Severity | Finding | Disposition |
|---|----------|---------|-------------|
| 1 | Low | `activePack` is a module-level mutable singleton read by render-time resolvers, outside React state. Race-free today (the switch is fully synchronous, mutation before setState, no async step); a torn read becomes possible only if a Suspense/transition boundary is ever added around `<PromptBuilder>`. | Accepted as-is; if Suspense arrives, move to `useSyncExternalStore` (repo precedent: `use-portal-target.ts`, `use-media-query.ts`). |

## Verified clean

- **Poisoned localStorage**: `readStored<unknown>` (no `as T` cast) →
  `isArtPackId` (string check short-circuits object/array payloads; no merge or
  spread, so no prototype-pollution path) → `setActiveArtPack` independently
  re-validates against `PACKS`. Malformed JSON degrades to default via
  `readStored`'s try/catch. Unknown ids rejected twice.
- **Pack content → DOM**: bios render via `<p>{text}</p>` text nodes; picker
  labels via `{option.name}` text nodes; card-face `alt` is hardcoded `""`
  (`aria-hidden` wrapper) so pack alt text has no markup path. `option.id`
  never interpolated into class strings. S1 (`dangerouslySetInnerHTML`
  allowlist) passes. This closes the "dev-studio-only until a pack picker
  exists" carve-out in `2026-08-18-security-gate-fantasy-superhero-packs.md` —
  the picker routes through the same verified text-only path.
- **Session import / share links**: `PromptSession` has no pack field;
  `setActiveArtPack` / the storage key are referenced only by `art-pack.ts`
  and `prompt-builder.tsx` — no reachable write from import/decode surfaces.
- **No `loadedTheme`-style race**: the switch has no async step; every
  resolver and the `aria-pressed` highlight read the same already-mutated
  pack in one render pass. Packs are build-time JSON imports; nothing fetches.
- **No hydration mismatch**: restore is deferred (`setTimeout` in mount
  effect); SSR and first client paint both start from the sci-fi default.
- Card Studio write endpoint unchanged this diff; not re-audited.

Battery at audit time: `check:security` · `check:standards` · `data:validate`
all green.
