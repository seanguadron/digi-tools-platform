---
gate: security
date: 2026-07-28
surface: Prompt Builder — use-default draft fields across localStorage/share/import, named download filenames, default-line injection
result: FAIL -> PASS
findings: 1 High + 1 Medium + 1 Low (all applied)
---

# Security gate — Prompt Builder defaults rework

Audited the session's trust-boundary changes: the two new `PromptDraft`
booleans crossing localStorage autosave, URL shares, session-file import, and
the prompt library; the best-name download filename chain; the default-line
injection into the assembled prompt; the new checkboxes; the audio-meter fix.

## Result: FAIL → PASS (all three findings applied)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | High | `loadSavedPrompt` restored a library entry via a bare `{ ...EMPTY_DRAFT, ...entry.draft }` spread and passed `entry.cardSystem` straight to `sanitizeCardSystemShape` — skipping the hardened coercion all three sibling restore paths use. A hand-edited/corrupted library entry (non-string `context`, non-array `roleIds`, null `cardSystem`) crashed the whole app on one click (no error boundary exists). | Applied: `loadSavedPrompt` now restores through `restoreDraft` + `restoreCardSystem` (the same validators the session-import path composes), and `listSavedPrompts()` shape-filters entries at the read boundary (`isSavedPromptShape`). Verified in the running app: the gate's exact corrupted-entry scenario now loads a clean default draft, no crash; malformed shells are dropped from the panel entirely. |
| 2 | Medium | `listCustomArchetypes()` entries were unvalidated (`Array.isArray` only) but feed two new consumers: `name` into the filename chain (`slugifyFilename(...).trim()` throws on non-string) and `defaultAudience` into `buildAudienceDefaultLine` (`?.trim()` guards null but not present-non-string). | Applied: `isStoredArchetypeShape` read-boundary filter (id/code/name/description/formatCode strings, roleIds/effects arrays, illustration object, action/formatNotes/defaultAudience string-or-absent), and `buildAudienceDefaultLine` now uses a `typeof === "string"` runtime guard regardless of caller. |
| 3 | Low | `sanitizeCardSystemShape` optional-chained past `.tracks` but not `state` itself, so its "callers pass a pre-built object" invariant was implicit — finding 1 showed a caller violating it. | Applied: parameter widened to `T \| null \| undefined`, all top-level derefs null-safe, degraded-path spread documented. |

## Verified safe (no findings)

- **Filenames** — every download name flows through the single
  `slugifyFilename` call (lowercase, collapse non-`[a-z0-9]` runs incl. path
  separators/control/RTLO chars, trim dashes, 100-char cap); `format` is a
  closed TS union from three fixed buttons; `anchor.download` is a DOM
  property assignment, no markup surface.
- **Default-line injection** — `CONTEXT_DEFAULT_TEXT` /
  `buildAudienceDefaultLine` / `archetypes.json` `defaultAudience` are
  repo-authored, schema-required strings rendered only as JSX text children
  (`<pre><code>{prompt}</code></pre>`); the repo still has exactly one
  sanctioned `dangerouslySetInnerHTML` (theme-script.tsx, §2.4).
- **Checkboxes** — native `event.target.checked` booleans, no parsing.
- **Audio meter** — `bar.style.transform` CSSOM writes of clamped finite
  numbers; division-by-zero structurally excluded; `getUserMedia` untouched.

## Deterministic half

`npm run check:security` — green (before and after; the skipped-validator
call is exactly the judgment-half class the script's own header disclaims).

## Follow-ups (not blocking)

- Proposed amendment (owner consent): every `readStored<T[]>`-backed list
  consumed by UI state must pair with a shape-validating restore mirroring
  `restoreDraft`/`restoreCardSystem`; `Array.isArray` alone is not §2.3
  compliance. Queued via the sessions log.
- Backlog: a unit test asserting `restoreDraft`/`loadSavedPrompt` degrade
  malformed entries to defaults (blocked on the `@/`-alias test-runner gap).
