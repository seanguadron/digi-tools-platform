---
gate: integration
date: 2026-08-17
surface: Card Art Studio (/studio/card-art + src/app/api/card-art/route.ts + scripts/card-art-store.mjs), audited at 65b8298
result: FAIL -> fixes applied, re-verified
findings: 4 (all fixed) + 2 recommendations (both applied)
---

# Integration audit: Card Art Studio

| Rule | Verdict |
|---|---|
| §1.1 registration | PASS — not a tool, not registered, and nothing links to it. §1.1 scopes itself to tools; the enforcement clause ("nothing links to an unregistered tool") holds |
| §1.4 shell contract | PASS (correctly exempt) — an unregistered route gets `fullBleed: false` and no gate; the page carries its own in-content header rather than faking tool chrome |
| ARCHITECTURE accuracy | PASS after a completeness fix (see 4) |
| §2.1 catalog pipeline | **FAIL — fixed** |
| §2.2 generated docs | **FAIL — fixed** |
| §2.3 trust boundary | **FAIL — fixed** |
| §2.4 injection | PASS |
| §3.3 governance graph | PASS deterministically; **doc-truth FAIL — fixed** |
| conventions | PASS |

## Applied

1. **§2.2 — the one that was actively biting.** `docs/PROMPT_ROLES.md` also
   embeds `illustration.status`, but the store only regenerated the art
   pack. Real art made through the studio therefore left that doc stale and
   failed `check:standards`. Status flips now refresh every generated doc
   that quotes the entry — the art pack always, plus the role docs when a
   role moved.
2. **§2.1 — a brittle test fixture.** `card-art-store.test.mjs` copied the
   real catalog and asserted an ABSOLUTE count of generated entries, so the
   suite broke the moment the studio was used for its actual purpose. The
   fixture now normalizes every status to `planned` first, making the tests
   describe the store rather than how much art exists.
3. **§2.3 — bare casts on fetch responses.** The studio cast its own
   manifest responses with `as`. Now shape-checked (`isManifest`) and
   degraded to the error path on mismatch.
4. **§3.3 doc truth.** `.claude/agents/integration-gate.md` still described
   the app as "no backend" — the gate's own charter contradicting the commit
   it was auditing. Updated, along with ARCHITECTURE's under-description of
   the status write (it also flips back to `planned`).

## Recommendations, applied
- `npm run lint` now covers `scripts/`, which is live-imported by a route
  handler rather than offline tooling (it was already clean).

## Noted, not a defect
`craft.*` and `shared.*` entries have no catalog record, so "Use this"
writes their live webp but cannot move a status or the progress count.
Self-documented in the store; the acronym art is not wired to the UI yet.

## Proposed amendment (owner consent)
§1.1 is written around "a tool". A one-line addition making authoring
surfaces explicitly exempt when nothing links to them would save the next
one of these needing a fresh interpretive call.
