---
gate: integration
date: 2026-08-19
surface: "PICTURE art-pack migration + /studio/picture + both guide pages, the CRAFT style tier, the movable dock, the all-roles role filter"
result: FAIL -> fixed
findings: 2 FAIL / 3 follow-ups
---

# Integration gate: PICTURE pack + guides (2026-08-19)

Audited commits `ab93126` (PICTURE onto the pack model), `25b1776` (419
briefs + flavor lines), `cd31a10` (`/studio/picture`), `e29d7a8` (pack
complete at 426, guides rebuilt, style tier, movable dock, all-roles filter)
against docs/STANDARDS.md.

## Findings and outcomes

| Rule | Finding | Outcome |
|---|---|---|
| §3.3 doc currency | `docs/ARCHITECTURE.md:103` still claimed "the PICTURE deck keeps its inline illustrations" — false since `ab93126`; the gallery pack and `src/lib/picture-art-pack.ts` were undocumented | Fixed: §1 now documents PICTURE's single pack, why it has no picker, its acronym-letter entries, and `packArtFor` |
| §3.3 doc currency | `docs/ARCHITECTURE.md:106-107` still described the dock as "pinned to `.flow-workspace`'s bottom-right" — false since `e29d7a8` | Fixed: documents the drag handle, quadrant snap, FLIP settle, arrow keys, and the `digitools.flow-dock-corner-v1` / `isDockCorner` persistence contract |
| §3.2 gate ledger | No Security-gate entry postdates the `deck` parameterization of the write endpoint | Security gate was already running when this landed; its report files alongside this one |
| Comment accuracy | `generate-picture-art-docs.mjs` claimed the picture deck "never uses the craft/roles/shared groups" while the same file populates `craft.<letter>` and reads `shared` | Fixed: only `roles` is unused |
| Doc wording | The manifest's progress line and "Later: per-grade variants" header now also cover the 7 acronym cards | Fixed: "later images", with a sentence saying the acronym cards belong to the guide page |

Two items raised in the gate's Notes were also fixed while in the files:

- **`storeFor` prototype lookup** (`src/app/api/card-art/route.ts`): a bare
  bracket lookup meant `?deck=__proto__` resolved to `Object.prototype`,
  passed the truthy guard, and would fail as an unhandled 500 rather than a
  400. Now an `Object.hasOwn` check. Dev-only and loopback-gated, so impact
  was crash-only, but the fix is one line.
- **`prompt-role-workbench.tsx` portal target**: resolved `document.body`
  inline rather than through `usePortalTarget`, the exact pattern
  ARCHITECTURE.md §2 warns against. Pre-existing, but the file was
  substantially rewritten this session, so it was swapped.

## PASSes worth recording

Registration (the studio is deliberately not a tool and nothing links to
it), the shell contract (dev-only guard mirrors `/studio/cards`, portal
slot, shared save-state chip, correct CSS zone order), catalog validation
wired into `validateCatalog`, generated-doc drift checked in
`data:validate`, trust-boundary shape checks on every fetch response and on
the new localStorage key, no injection primitives, gov:node edges all true,
kebab-case conventions.

The collector's ordering claim was verified by hand: lineages(100) +
archetypes(18) + shared(1) + grades(300) are pushed before the 7 letters, so
sequence numbers 1-419 never moved and the letters land at 420-426.

Battery after fixes: typecheck / lint / test 149 / data:validate /
check:standards / check:security all green.

## Still owed

The **draggable nav dock's design-gate pass** — launched twice, killed by a
provider spend limit before reporting. Tracked in `docs/STATE.md`.
