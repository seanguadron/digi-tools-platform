---
gate: security
date: 2026-08-02
surface: PICTURE Deck trust boundaries (6 localStorage keys, ?p= share param, session import, downloads, rendered prompt, catalog pipeline) + touched shared code, commits e54d3dc..5bebe10
result: FAIL -> fixes applied in fa577a4, re-verified
findings: 2 High (fixed), 2 Medium (fixed), 3 Low (2 fixed, 1 deferred to amendment)
---

# Security audit: PICTURE Deck

Read-only agent audit at HEAD 5bebe10 with git-diff verification against the
pre-refactor commits. Findings and outcomes:

1. **High — favorites-v1 unvalidated read** (crash + persistent route
   lockout via tampered localStorage; no error boundary exists). FIXED in
   fa577a4 via `readStoredStringArray` (also found by the integration gate).
   Verified in-browser on both decks with `"null"`/`"{}"` payloads.
2. **High — custom-archetype shape check ignored `equipped` and `effects`
   elements**; render-phase crash on hover/focus (`Object.values(null)`),
   React-child crash on object effects, and `createEquippedSlots(null)`
   throwing one expression before the sanitizer ran (in BOTH decks). FIXED:
   shape checks now require equipped to be object-or-absent and every effect
   a string; preview counters use `equipped ?? {}`; the engine's
   `createEquippedSlots` accepts null. Verified in-browser: hostile presets
   filtered on read, survivor hover/apply safe.
3. **Medium — CRAFT session importer had no tool discriminator**: a PICTURE
   export imported into CRAFT silently emptied the draft behind "Session
   imported." FIXED: CRAFT sessions now serialize `tool: "craft-deck"` and
   the importer rejects a PRESENT foreign tag while accepting legacy
   tag-less files.
4. **Medium — the UI tail setter bypassed the range clamps** every restore
   path enforced. FIXED: `clampTailValue` in picture-deck-state is now the
   one enforcement point; `setTailNumber` routes through it.
5. **Low — JSON-null payloads threw raw TypeErrors** (caught upstream but
   wrong error). FIXED: object guards in restorePictureSession /
   restorePictureDraft / restorePictureCardSystem / restorePromptSession.
6. **Low — no length ceiling on subject/negative.** Verified non-breaking
   (one-line invariant and filename cap hold; quota errors degrade).
   DEFERRED to the standing STANDARDS amendment queue (matches CRAFT
   precedent; a shared cap belongs to both decks in one change).
7. **Low — loadSavedPrompt lacked a defensive try/catch.** FIXED (PICTURE).

## Verified clean (do not re-litigate)
- `sanitizeCardSystemShape` extraction is byte-equivalent to pre-refactor
  behavior (diffed against e54d3dc^).
- No prototype-pollution vector in the untrusted-data spreads.
- Aspect ratio is double-gated (allowlist on restore + `^\d+:\d+$` at emit).
- `slugifyFilename` fully neutralizes filename inputs.
- Catalog pipeline AJV-strict + referential, static imports only.
- §2.4 allowlist unchanged (theme-script.tsx only).
- base64url codec extraction byte-equivalent; all decoders wrapped.
- Prompt content renders only as JSX text; the one-line invariant holds
  structurally via cleanFragment.

## Proposed amendments (owner consent, added to the queue)
- Every `readStored<T[]>` call site routes through a shared validated-array
  helper (readStoredStringArray now exists; generalize as
  `readStoredArray(key, isShape)`), instead of per-call-site vigilance.
- Cross-tool session/share files agree on a `tool` discriminator convention
  in both directions (now true for both decks; make it a rule for future
  decks).
- A shared length ceiling for free-text draft fields across both decks
  (finding 6).
