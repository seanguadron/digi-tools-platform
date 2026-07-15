---
gate: security
date: 2026-07-15
surface: framework unification — useLocalDraft + the three persistence adapters (localStorage trust boundary), save-status.ts, tool-subbar.tsx
result: pass
findings: 1 (Low, comment fix applied)
---

# Security audit: core framework unification — `use-local-draft.ts` + the three persistence adapters (localStorage trust boundary), plus `save-status.ts` / `tool-subbar.tsx`

## Result: PASS (1 finding)

| # | Severity | Finding | Evidence | Fix |
|---|----------|---------|----------|-----|
| 1 | Low | The new `useLocalDraft` contract documents "throw for storage failure (maps to 'unavailable')", but the Architect adapter's `save` writes via `writeStored`, which swallows quota/blocked-storage errors — so on quota exhaustion the chip reports "Saved <time>" with nothing written, and "unavailable" is unreachable from the Architect save path. Pre-existing behavior faithfully preserved (the pre-refactor `catch` block was equally unreachable for the same reason — `git diff HEAD` confirms), but the refactor's new contract comment documents semantics this one adapter silently doesn't deliver; the other two adapters (raw `setItem`) do. | `src/hooks/use-local-draft.ts:24-26` (contract); `src/hooks/use-architect-persistence.ts` save via `writeStored`; `src/lib/prompt-storage.ts:25-29` (silent swallow) | **Applied (minimum fix):** a comment on the Architect `save` notes the swallow so the contract mismatch is visible. Optional future hardening: a throwing `writeStoredOrThrow` variant used by the Architect adapter only, keeping the JSON-quoted byte format. |

## Invariant verification (the read/validation paths, vs `git diff HEAD -- src/hooks/`)

- **`use-local-draft.ts` performs zero storage I/O** — grep-verified: no `localStorage`/`sessionStorage`/`indexedDB`/`innerHTML` in it or in any other changed file outside the three adapters. It owns timing and the status machine only.
- **Prompt Builder** (`use-prompt-builder-persistence.ts`): restore is statement-identical — same 3 keys, raw `getItem`, `restoreDraft`/`restoreCardSystem` shape-validation, and the corrupt-data catch still clears all three keys and degrades to `"unavailable"`. Save: same `JSON.stringify` triple, raw-ISO saved-at, sync-write + deferred status commit. `src/lib/prompt-session.ts` byte-identical to HEAD.
- **Architect** (`use-architect-persistence.ts`): `coerceProject(readStored<unknown>(PROJECT_KEY, null))` v1→v2 migration + normalize untouched; saved-at stays JSON-quoted via `readStored`/`writeStored`, and the adapter comment explicitly warns against unifying. Throw-in-restore now lands in `useLocalDraft`'s catch → `"unavailable"` with the ready gate opened — same outcome as the old `finally`.
- **Image Editor** (`use-image-editor-persistence.ts`): `JSON.parse` → async `deserializeDoc` (the path the 2026-07-08 gate approved; `project-io.ts` byte-identical to HEAD) inside the same try/catch; cancellation checked before any state commit (`return null` keeps the ready gate closed — StrictMode-safe); name/saved-at reads in their own try/catch; fresh-doc seeding preserved. Save: same 4,000,000-char budget → `"large"` without write, same 1200 ms debounce, same 3 keys/raw-ISO format, quota throw → `"unavailable"`.
- **Ordering/gate semantics preserved:** the save effect cannot fire before restore commits (`restoredRef` set synchronously in the same batch as the restore setStates), so a default in-memory state can never clobber saved work pre-restore — the same guarantee as the old per-hook `restoredRef`. Callback stability verified at call sites, so no new re-run/re-write loops.
- **Ancillary surfaces:** `save-status.ts` is pure formatting; `tool-subbar.tsx` portals into the shell's own `#app-subbar-slot` and renders everything as JSX text — no markup path, no new §2.4 primitive. `src/data/` untouched.

## Deterministic half

`npm run check:security` — green.

## Notes

- **Pre-existing, confirmed NOT worsened (not findings of this change):**
  1. `src/lib/prompt-storage.ts:14` — `readStored` returns `JSON.parse(raw) as T` without validation. Within this surface it is mitigated: the PROJECT_KEY result immediately passes through `coerceProject`, and SAVED_AT_KEY flows only into `new Date(...)`.
  2. Architect `coerceProject` casts-then-normalizes after the version discriminant — byte-identical, untouched.
  3. `new Date(savedAt)` on unvalidated stored strings (PB/IE raw, Architect via `readStored`) → the "Saved Invalid Date" label class; degrades (`toLocaleTimeString` on an Invalid Date returns a string, never throws). Now centralized in `formatSaveStatusLabel` — same reachability, but a future fix is now a one-place change.
- IE `save`'s `!value.doc → "saved"` branch is unreachable (`canSave` gates null docs) and performs no write; documented in-code.
- Hardening guidance for a future fourth adapter: `useLocalDraft`'s save effect re-runs on `save`/`canSave` identity change; an inline-lambda adapter would rewrite storage every render (debounce 0). Consider ref-wrapping the callbacks inside the hook if the adapter count grows.
- No proposed STANDARDS amendments; the change conforms to §2.3 (validated reads, degrade-to-defaults) and adds nothing to the §2.4 allowlist.
