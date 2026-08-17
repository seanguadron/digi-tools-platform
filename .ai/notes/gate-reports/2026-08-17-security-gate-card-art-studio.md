---
gate: security
date: 2026-08-17
surface: Card Art Studio — the app's first server surface (/studio/card-art, src/app/api/card-art/route.ts, scripts/card-art-store.mjs), audited at 65b8298
result: FAIL -> fixes applied, re-verified
findings: 3 High, 3 Medium, 3 Low (7 fixed, 2 accepted with rationale)
---

# Security audit: Card Art Studio

The gate's own charter was rewritten in the same commit so this endpoint is
in scope — it previously instructed the gate NOT to audit backend threats.

**The core design claim held.** The agent traced `theme`, `key`, `variantId`
and `dataUrl` end to end and could not construct a traversal; live probes
with `../`-shaped keys, variants, and themes all 404'd. Callers name a
catalog entry and the server derives every path. The findings were about
what surrounds that core.

## Applied

1. **High — no network boundary.** `next dev` binds every interface and
   `allowedDevOrigins` does not gate application routes (it only unblocks
   `/_next`), so anything on the LAN could reach the writer. Handlers now
   require a loopback `Host`. Documented as narrowing, not sealing: a raw
   client can forge the header, so the real boundary remains "do not run the
   dev server on a network you distrust". `next.config.ts`'s comment no
   longer implies it is a safety mechanism.
2. **High — resource exhaustion.** Payloads were decoded before the size
   check, and `request.json()` had no ceiling. Now: bodies over 48MB are
   refused on `content-length`, and the base64 string is length-checked
   before `Buffer.from`.
3. **High — S4 did not verify what it claimed.** It skipped files whose
   handlers use `export const GET = ...`, and tested the guard against the
   whole file, so one guarded handler vouched for an unguarded sibling.
   Now matches both export styles and checks each handler's own body,
   accepting a call to a local helper that carries the check.
4. **Medium — catalog write integrity.** `setStatus` trusted `src`
   uniqueness and field ordering it did not verify, and an independent read
   made concurrent flips lose updates. Now: refuses a non-unique `src`,
   validates the current enum, and all catalog writes are serialized.
5. **Medium — unverified projectRoot fallback.** `process.cwd()` is now
   verified against `package.json` name, with a clear error instead of
   silently writing into whatever project sits there.
6. **Medium — content sniffing.** Payloads are validated by magic bytes
   against their claimed type, and variant responses carry
   `x-content-type-options: nosniff`.
7. **Medium — error disclosure.** Non-`CardArtError` failures no longer echo
   fs messages carrying absolute paths; they log server-side and return a
   generic message.
8. **Low — exclusive create.** Variant writes use `flag: "wx"` with retry, so
   a double paste cannot silently overwrite.

## Accepted, not fixed

- **Low — `assertInside` is lexical, not `realpath`.** A symlink planted
  inside the working tree would be followed. This presupposes an attacker who
  can already write to the repo, which is a larger compromise on its own.
  ARCHITECTURE.md now says "lexically" rather than implying otherwise.
- **Rate limiting.** Not added: single-author local tool, and the size caps
  plus loopback check cover the realistic case.

## Verified clean (do not re-litigate)
Keys-never-paths; the API cannot craft a new catalog entry (entries are a
pure function of the on-disk catalog, and only `status` is writable, always
with a hardcoded value); no injection primitives; `URLSearchParams` rather
than string interpolation for variant URLs.

## Proposed amendment (owner consent)
STANDARDS has no rule for this surface — only ARCHITECTURE prose and the
gate charter. A consent-gated entry should codify the three properties
(production guard, keys-never-paths, narrow status write) with S4 as the
deterministic half.
