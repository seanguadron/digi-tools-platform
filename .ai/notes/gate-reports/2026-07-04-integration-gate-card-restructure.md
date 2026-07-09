---
gate: integration
date: 2026-07-04
surface: Prompt Builder card-catalog restructure (cards/tracks/archetypes/formats/proof-scenarios/schema + prompt-card-system, prompt-builder-state, prompt-builder, prompt-card-workbench, prompt-data tests)
result: deterministic-pass / judgment-agent-blocked
findings: agent run aborted by provider monthly spend limit before producing a report; deterministic half passed
---

# Integration gate — card restructure

The judgment agent (`integration-gate`) was launched and aborted by the
provider's monthly subagent spend limit before it could audit. No agent
findings exist for this run; re-run the agent when subagent capacity is
available if a judgment pass is wanted retroactively.

What did run and pass:

- `npm run check:standards` (deterministic half) — via `prebuild` during the
  verified production build.
- `npm run data:validate` — full catalog schema + referential invariants
  (30 lineages × 4 grades, 21 archetypes, refs/budgets/unique art paths).
- `npm run data:test` — 6/6, including new guards: 30/120/21 counts, every
  lineage exactly 4 grades, no instruction contains the removed
  "Focus on these outcomes" boilerplate.
- `typecheck`, `lint`, `build` clean; browser smoke verified sliders (8 tracks
  × 4 points, Action = 2 sliders), new cards in decks, 21 archetype buttons,
  new-archetype application, and clean assembled output.

Inline self-review note (main agent): catalog IDs changed by design
(target-tone/target-direct → target-stance; practicality removed); every
consumer surface was updated (formats, proof-scenarios, schema enums,
loadExample equips) and `rg` confirms zero stale references in `src/`.
