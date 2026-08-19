---
gate: security
date: 2026-08-19
surface: "card-art route deck param + deck-parameterized store, art-pack key handling, dock localStorage, gallery pack free text, /studio/picture"
result: FAIL -> fixed (1 amendment proposed, needs consent)
findings: 0 high / 2 medium / 2 low
---

# Security gate: PICTURE deck trust boundaries (2026-08-19)

Audited `013843c..HEAD` — the PICTURE pack migration, the `deck`
parameterization of the app's one write endpoint, `/studio/picture`, the
gallery pack's 426 author-written strings, and the nav dock's new
localStorage key.

No High findings: deck isolation and path derivation trace cleanly end to
end (see PASSes).

## Findings and outcomes

| Sev | Finding | Outcome |
|---|---|---|
| Medium | `setBio` wrote pack bio text after only a length check. The value is spliced verbatim into a markdown line of the generated art doc by the same request's `refreshGeneratedDocs()`, so a bio containing newlines or backticks could forge a doc entry and break out of a fenced block — and `data:validate` would never catch it, because the doc is re-rendered from the same corrupted source and stays internally consistent. The agent reproduced this against `renderPictureArtDoc`. | **Fixed**: `setBio` now rejects `\r`, `\n`, and backticks with a 400 (`scripts/card-art-store.mjs`). The build-time backtick scan catches hand edits; this closes the write path. |
| Medium | `check:security`'s S1/S2 walk only `src/`, so `scripts/card-art-store.mjs`, `scripts/art-pack.mjs`, and `scripts/generate-picture-art-docs.mjs` — the entire implementation of the one server surface — sit outside the deterministic sweep. Manually grepped clean today; the automated net simply does not look there. | **Not changed — proposed amendment, needs the owner's consent.** STANDARDS §2.4 line 81 states the check "greps src"; widening the walk without amending that line would make the rulebook untrue, which §3.3 forbids. Queued for consent. |
| Low | `storeFor` indexed `stores` with a caller-controlled string behind a compile-time-only cast: `?deck=__proto__` (or `constructor`, `toString`, …) resolved to an inherited `Object.prototype` member, passed the truthy guard, and failed as an opaque 500 instead of a 400. No cross-store access or write was reachable. | **Fixed** (during the integration-gate pass): `Object.hasOwn` check in `src/app/api/card-art/route.ts`. |
| Low | `parseArtKey`'s grades index accepted an unbounded digit run and leading zeros; a long digit string parses to `Infinity`. Not reachable today — every write op requires the raw key to match a catalog-derived `findEntry` result first — but the module's stated job is to refuse suspect keys outright. | **Fixed**: index bounded to `0` or 1-3 digits without leading zeros (`scripts/art-pack.mjs`), with a regression test in `scripts/picture-data.test.mjs`. |

## PASSes worth recording

- **Deck isolation.** The `deck` param only selects between two pre-built
  stores; `createCardArtStore({deck})` is called exactly twice, both with
  hardcoded literals. Inside each store, `requireTheme` gates the theme id
  against that deck's own pack list AND filesystem existence under its own
  roots, so `deck=picture&theme=sci-fi` 404s before touching a path.
  `readCard`/`saveCard` throw unconditionally for the picture deck
  (`supportsCardEdits: false`) — the CRAFT catalog is never loaded on a
  picture-deck card request.
- **Key/path derivation.** `CRAFT_LETTER_PATTERN` is one anchored uppercase
  letter; the gallery pack's craft group holds exactly P,I,C,T,U,R,E and the
  on-disk files match. `ID_PATTERN` rejects traversal in every other group.
  `assertInside` is a third independent layer under every write.
- **Dock persistence.** `isDockCorner` is total against a fixed four-value
  enum, wrapped in try/catch with a default fallback; `corner` can only hold
  one of those literals, so its use in `data-corner` and the aria-label is
  safe by construction rather than by escaping.
- **Free-text rendering.** Schema `additionalProperties: false` plus the
  shared entry ceilings cover every field the gallery pack uses. No
  markdown-to-HTML renderer exists in the app; `alt` is never read
  (frames hardcode `alt=""` inside `aria-hidden` wrappers) and `prompt` is
  not rendered client-side.
- **Dev route parity.** `/studio/picture` carries the identical production
  guard as `/studio/cards`, and both talk to a route whose
  `isProduction()`/`isLocalRequest()` guard runs before `storeFor`.

## Pending amendment (owner consent)

Extend `check:security`'s S1/S2 file walk to `scripts/`, and amend
STANDARDS §2.4's "✓ check" line accordingly — `scripts/` now holds the
write endpoint's whole implementation and is in the gate's charter, but the
rulebook currently says the sweep covers `src`.

Battery after fixes: typecheck / lint / test 150 / data:validate /
check:standards / check:security all green.
