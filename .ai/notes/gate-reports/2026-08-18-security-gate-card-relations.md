---
gate: security
date: 2026-08-18
surface: the card-art write path under this session's additions — relations (9a63b31), pack scaffolds (e90c35b), the 226-image local write (62f2e52), Card Studio (b5318c5)
result: PASS -> the three Low findings fixed anyway
findings: 0 High, 0 Medium, 3 Low — all applied
---

# Security audit: the Card Studio post-widening

Every mechanism the previous gate certified still holds, re-verified rather
than taken on trust: closed `assertInside` containment, the closed
`FIELDS`/`CATALOG_FOR_GROUP` tables, `validateCatalog` as a pure
validate-then-write gate, magic-byte-sniffed size-capped image payloads, and
the production + loopback guard that `check:security` S4 matches.

**The question this session raised.** The 226 images were landed by a node
script calling `addVariant`/`selectVariant` directly, bypassing the HTTP
route — so does the route carry a check the store does not? **No gap.**
`MAX_BODY_BYTES`, `isProduction` and `isLocalRequest` are transport concerns,
meaningless in-process; the checks that protect data integrity — magic-byte
sniffing, the size cap, webp-only on the live path, and `assertInside` — all
live inside `createCardArtStore()` and therefore applied to the script too.
Verified by byte-scanning the result: all 226 files under
`public/card-art/sci-fi/` are genuine WEBP, correctly extensioned, max 267KB;
all 494 under `card-art-source/sci-fi/` are genuine PNG, max 8MB. Zero
mismatches across 720 files.

## Applied

1. **Low — `setBio` skipped the catalog cross-reference every sibling used.**
   `addVariant`, `saveCrop`, `deleteVariant`, `selectVariant` and `clearLive`
   all run `loadContext` + `findEntry` first, proving the key names an entry
   the catalog currently owns. `setBio` went straight from the raw key to
   `parseArtKey` and indexed the pack directly, so a bio could land on a pack
   record the catalog had stopped owning — an orphaned grade slot left behind
   by a lineage that shrank — which every other op would have refused. It now
   cross-references first. The test covering this was widened rather than
   relaxed: it now asserts both refusals (unknown-to-catalog, and
   known-but-absent-from-pack) plus the malformed-key case.

2. **Low — a malformed key produced a 500 instead of a 400.** `saveCard` and
   `setBio` let `ArtPackKeyError` escape from `catalogKeyForEntry` /
   `parseArtKey`; the route only special-cases `CardArtError`, so the caller
   saw a generic failure where every other bad input answers 400. Both call
   sites now convert, the way `readCard` already did.

3. **Low — the pack schema capped `bio` but not `prompt`/`alt`.** The
   free-text ceiling discipline had a real hole for two fields. Not reachable
   today (no `op` accepts them), but capped now, before a future studio
   editor reopens it. Ceilings were measured, not guessed: the longest
   shipped values are 222 chars (`prompt`) and 65 (`alt`); caps set to
   2000/300.

## Verified clean

- **Pack strings never reach the DOM as markup or the assembled prompt.**
  `bio` renders through one component as a plain JSX text node. `alt` is
  never rendered anywhere — both renderers hardcode `alt=""` and
  `aria-hidden`. `prompt` (the image brief, unrelated to the assembled
  language-model prompt) renders only as text in the studio. The app has
  exactly one `dangerouslySetInnerHTML`, the allowlisted `theme-script.tsx`.
- **Prototype pollution is unreachable**: a `__proto__`-keyed edits payload
  is rejected by the closed-table `byId.get(id)` lookup before any assignment.
- **`CATALOG_FOR_GROUP`** only ever names four real catalog keys; the other
  data files are unreachable from this endpoint by construction.
- **`buildRelations`** writes nothing; the client shape-checks the payload and
  renders every label as text.
- **The scaffolds** are inert: 226/226 entries each, all `status: "planned"`,
  `draft: true`, every key well-formed.
- **`62f2e52` touched only `status`** — confirmed by diffing and excluding
  `"status"` lines, leaving an empty diff, rather than trusting the message.
- **Dev-only gating unchanged**: `isProduction()` guards both verbs, the page
  guard matches, and S4 still matches the helper form.

## Notes

- `src/lib/prompt-session.ts` and `src/lib/prompt-storage.ts` (known latent
  unvalidated-cast findings) are untouched by these commits and stay open for
  whenever those files next change.
- Raised for the owner: when the queued free-text-ceiling amendment lands, it
  should name art-pack `prompt`/`alt` explicitly, not just catalog fields and
  session drafts. (proposed amendment, needs the owner's consent)
