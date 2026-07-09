---
gate: security
date: 2026-07-04
surface: session restore trust boundary (prompt-builder-state restoreCardSystem, prompt-session, prompt-builder apply paths, prompt-card-system sanitizeCardSystemShape) + rewritten catalog content
result: deterministic-pass / judgment-agent-blocked
findings: agent run aborted by provider monthly spend limit; inline self-audit found 1 Low (equipped duplicates) — fixed
---

# Security gate — restore sanitizing + catalog rewrite

The judgment agent (`security-gate`) was launched and aborted by the
provider's monthly subagent spend limit before it could audit. Re-run when
subagent capacity is available if a judgment pass is wanted retroactively.

What did run and pass:

- `npm run check:security` (deterministic half) — via `prebuild` during the
  verified production build.

Inline self-audit (main agent), against the repo's real threat surface:

- **Malformed/hostile stored state** (localStorage, session import, `?p=`
  links, library, custom archetypes): all five paths now flow through
  `sanitizeCardSystemShape` — unknown/wrong-section card ids dropped, slots
  clamped to budgets, track values coerced to finite integers in range,
  unknown TrackIds shed, snap memory reset. Verified live by injecting a
  hostile payload (ghost ids, wrong-section id, `practicality`, values 4/9,
  bogus overrides) → app loads clean, autosave persists the sanitized state.
- **Finding (Low, fixed):** equipped arrays were not deduplicated — a
  doctored save could seat the same card in two slots. Dedupe added in
  `sanitizeCardSystemShape` (`src/lib/prompt-card-system.ts`); typecheck +
  6/6 data tests re-run green.
- **Prompt-content injection:** card instructions render via React text
  nodes / `<pre>` only; no `dangerouslySetInnerHTML` on this surface; catalog
  is static JSON, not user input.
- **Parse failures:** session import and share-link decode remain inside
  try/catch with user-facing fallbacks (unchanged behavior, re-verified).
- **Standing point advanced:** the SESSIONS 2026-07-04 governance entry
  flagged the bare-cast restore boundary; the cardSystem half is now
  shape-validated. The draft half (`restoreDraft`) still spreads a bare
  `JSON.parse` cast (roles filtered, other fields trusted) — unchanged this
  session, remains the open §2.3 audit point.
