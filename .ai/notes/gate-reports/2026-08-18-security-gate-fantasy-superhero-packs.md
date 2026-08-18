---
gate: security
date: 2026-08-18
surface: Fantasy + Superhero pack data (452 new free-text strings), the Card Studio loadedTheme flow, the two new generated docs; audited against the working tree over 3a4a62e
result: PASS -> both findings fixed before commit
findings: 1 Medium (fixed), 1 Low (fixed)
---

# Security audit: the authored packs and the pack-switch data flow

## Applied

1. **Medium - a write could target a different pack than the entries it was
   clicked on.** The read side had just moved to `loadedTheme` (the manifest's
   own theme) but every write still posted the ambient selected `theme`, so a
   click landing in the tab-switch window could write one pack's bytes or bio
   into another pack's record. `set-bio` was reachable TODAY (all three packs
   carry bios); `select`/`crop` were latent until the new packs gain variants
   - which is the very next step in the backlog. Two fixes, both verified:
   `send()` now defaults its POST body to `manifest?.theme ?? theme`, so a
   read+write pair can never split across packs (`scaffold-pack` passes its
   own explicit theme and overrides the default); and `refresh()` gained a
   monotonic sequence guard so an out-of-order response cannot pin the
   manifest to a stale pack beyond one render. Browser-verified end to end:
   the studio's own Save button wrote a fantasy bio through the patched path
   and only `fantasy.json` changed on disk. Server-side authorization was
   never in question - every op still validates the theme against the real
   installed-pack list - this was a client state-consistency gap.

2. **Low - the generated art docs fence pack strings with bare backticks.**
   A backtick run inside a prompt would close a fence early. No shipped
   string contains one; that is now a validator guarantee rather than luck:
   `validateArtPacks` scans style, every prompt, alt, and bio in every
   installed pack and refuses any backtick. Proven live: an injected backtick
   fails `data:validate` with the entry named
   ("art-themes/fantasy.json has backticks in free text ... roles.researcher.alt").

## Verified clean

- **The ~500 new strings never reach the DOM as markup.** `prompt` renders
  only as a JSX text node; `bio` only reaches a controlled `<textarea>`;
  every `<img>` in the studio hardcodes `alt=""`, so pack alts are inert. The
  repo still has exactly one `dangerouslySetInnerHTML`, the allowlisted
  `theme-script.tsx`. And `src/lib/art-pack.ts` hardcodes the sci-fi import,
  so the shipped app cannot reach the new strings at all yet - they are
  dev-studio-only until a pack picker exists.
- **Schema ceilings bind everywhere**: maxima 196/75/109 against caps
  2000/300/240; bios on exactly the same 98 keys as sci-fi, none in grades.
- **`loadedTheme` carries no injection risk**: its only sources are the
  client's own installed-pack-constrained state and the server's validated
  echo; it feeds `URLSearchParams` construction only.
- **Removing `draft` gated nothing security-relevant**: writes were already
  allowed for draft packs (gated on file existence), and the flag only
  activated the illustration-rule and doc-coverage content checks - both now
  passing.

## Notes

- `card-art-source/` (untracked PNG tree) out of scope; separately tracked.
- Raised for the owner, not applied: a STANDARDS rule of the shape "a client
  action that reads pack-scoped data via one server-echoed identifier must
  reuse that same identifier for any write it triggers, never a
  separately-tracked current-selection value" - it would have caught the
  Medium by construction. (proposed amendment, needs the owner's consent)
