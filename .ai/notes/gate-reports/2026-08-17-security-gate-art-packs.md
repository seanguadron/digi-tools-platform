---
gate: security
date: 2026-08-17
surface: the Card Studio's catalog-editing surface (card-record.mjs, saveCard/setBio/scaffoldPack/listPacks) + the art-pack model, audited at 32e0a04 + working tree
result: FAIL -> fixes applied, re-verified
findings: 5 Medium, 1 Low (all fixed)
---

# Security audit: the Card Studio's write surface

This session widens the one sanctioned exception to "src/data is build-time
trusted" — from a single `illustration.status` enum to a closed table of
catalog text fields, plus pack `status`/`bio`, plus whole new pack files.
Flagging that widening explicitly is the point of this report.

**The core mechanism held.** The gate traced it and confirmed: the writable
field table in `card-record.mjs` cannot be widened by a caller;
`parseArtKey`/`artPathFor` accept no key that produces `..`, `/`, or an
absolute segment; `saveCard` is gated by a deep-cloned candidate run through
the SAME `validateCatalog` the build runs; every handler including the five
new ops sits inside the production + loopback guard, and S4 still matches it.
The findings were all about the edges of that widening.

## Applied

1. **Medium — two writes skipped `assertInside`.** `saveCard`'s catalog write
   and `scaffoldPack`'s pack write built a path and called `writeFile`
   directly, making the module's own stated invariant ("each resolved path is
   asserted inside its own root") false for exactly the two newest writers.
   Both now assert, so containment is a property of this module rather than of
   two lookup tables staying well-behaved.
2. **Medium — `scaffoldPack` was the only pack write outside the queue.** Its
   "does this pack already exist" check and its write were not atomic, so two
   requests for the same brand-new world could both see "no" and the second
   would clobber the first — defeating the 409 that exists to prevent exactly
   that. Now serialized, with a test that races two scaffolds and asserts
   exactly one wins.
3. **Medium — the two queues fanned out to one unprotected file.**
   `catalogQueue` and `packQueue` each protected their own JSON, but both
   ended in `generateCraftArtDocs()` writing the same doc, and
   `selectVariant`/`clearLive` called it *outside* their queued slot. Two
   overlapping renders could tear a doc that `prebuild` then drift-checks.
   Collapsed to ONE write queue with the doc render inside it: this is a
   single-author local tool, so full serialization costs nothing and removes
   the class.
4. **Medium — no length ceiling on catalog free text.** `setBio` capped at 240
   for the panel that clips, but `saveCard` could write an arbitrarily long
   string into any card field. `MAX_FIELD_LENGTH` added in `card-record.mjs`
   at 1200 — roughly double the longest value the catalog actually ships
   (measured: 608, an archetype's action text), so it stops runaway input
   without standing in the way of editing. This is the "shared length ceiling
   for free-text fields" already queued as a pending amendment.
5. **Medium — the new operations had no filesystem tests.** Seven added; see
   the integration report. Findings 1-3 are exactly the class those tests
   exist to catch.
6. **Low — `scaffoldPack` wrote without validating what it built.**
   `artPackShapeErrors` exported from the validator and run over the
   constructed pack before the write, matching `saveCard`'s
   validate-then-write discipline.

## Also fixed while in here

`scaffoldPack` asked `installedArtPackIds()` (always the repo root) whether a
pack existed, then wrote to the store's own root. Consistent in production
where the two are the same, but the check and the write should name one
directory. The store now has its own root-relative `installedPackIds()`.

## Verified clean (do not re-litigate)

The closed `FIELDS` table; `parseArtKey`'s grammar; the production +
loopback guards on all handlers and the page; S4 still matching; no injection
primitives; the prior gate's fixes (magic-byte sniffing, exclusive-create,
`verifiedCwd`, generic error disclosure) all intact.

## Proposed amendment (owner consent)

Land finding 4's ceiling as a STANDARDS rule covering both session drafts and
catalog fields, so it is not rediscovered a third time.
