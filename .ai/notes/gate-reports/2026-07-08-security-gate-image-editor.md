---
gate: security
date: 2026-07-08
surface: Image Editor trust boundaries — project .json import/export, localStorage autosave, image ingest, downloads (project-io.ts, use-image-editor-persistence.ts, raster.ts decodeImageFile, browser-download.ts, image-editor.tsx)
result: pass-after-fixes
findings: 1 Medium + 3 Low — all fixed this session
---

# Security gate — Image Editor (first raster/canvas + first inbound-image surface)

The `security-gate` judgment agent ran fully (no limits) and returned 4
findings. All were valid and are **fixed**; `check:security` (deterministic
half) and the production build are green.

**Finding 1 — Medium (fixed): resource-exhaustion via a shape-valid project.**
`deserializeDoc` capped the doc's declared width/height once, then allocated a
full doc-sized canvas *per layer* with no cap on layer count and no check of each
embedded image's own decoded size — a ~150 KB `.json` with hundreds of layers
could request tens of GB and crash the tab (same path reachable from the
localStorage autosave restore). Fix: added `MAX_DOC_LAYERS = 64` and
`MAX_TOTAL_PIXELS = 160_000_000` in `types.ts`; `deserializeDoc` now rejects when
`layers.length` exceeds the cap or `width*height*layers.length` exceeds the total
budget, and `dataUrlToCanvas` rejects a layer whose own `naturalWidth*naturalHeight`
exceeds `MAX_DOC_PIXELS` (`project-io.ts`). Covers both the project-open and
autosave-restore callers (one function).

**Finding 2 — Low (fixed):** `openProjectFile`'s `await file.text()` wasn't in
try/catch → an unhandled rejection on a read failure. Now wrapped; failures route
to the same "could not be read" notice (`image-editor.tsx`).

**Finding 3 — Low (fixed):** no upfront byte-size ceiling before reading a `.json`
project into memory. Added `MAX_PROJECT_BYTES = 96_000_000`; `openProjectFile`
rejects oversize files before `file.text()` (`image-editor.tsx`).

**Finding 4 — Low (fixed):** `slugifyFilename` had no length cap. Now truncated to
100 chars (`browser-download.ts`).

Verified sound (agent, for the record): the trust boundary is genuine validation
(not the known-latent cast pattern) and is a good reference for hardening
`prompt-session.ts`/`prompt-storage.ts`; direct image ingest checks the *decoded*
bitmap size; no injection surface added (text via `fillText`/React text nodes,
never `innerHTML`); object URLs paired+revoked; export filenames uniformly
sanitized; `next.config.ts` untouched.

**Proposed STANDARDS amendment (flag only, needs owner consent):** §2.3's check
today reads as parse-safety. Finding 1 shows a shape-valid *field* (declared
dimensions) can size a *multiplied* allocation (per-layer × unbounded count).
Consider amending §2.3 so any validated field used to size an allocation must
bound the **total** (dimensions × count), not the field in isolation. Recorded in
SESSIONS.
