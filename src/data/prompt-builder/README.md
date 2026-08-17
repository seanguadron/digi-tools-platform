# CRAFT Deck Data

This directory is the editable source of truth for the CRAFT Deck catalog
(tool id `prompt-builder` — the directory keeps the id name).
Application behavior remains in `src/lib`; these files contain only declarative
content and configuration.

## Files

- `roles.json` - role cards and categories
- `tracks.json` - tuning tracks, snap vocabulary, and slot budgets
- `formats.json` - output types, modifiers, and recommended track values
- `cards.json` - tactic and modifier card lineages and grades
- `archetypes.json` - preset C.R.A.F.T. loadouts that leave Context and Target details for the user
- `suggestions.json` - role, category, and audience suggestions
- `builder.json` - C.R.A.F.T. labels, defaults, and example draft
- `proof-scenarios.json` - Proof Lab configurations

## Art packs

Card art and bios are NOT in these files. They live per world in
`art-themes/<pack>.json`, keyed by entry (`roles.researcher`,
`grades.context-scope[0]`), and carry a prompt, alt text, an optional bio,
and a status. A pack stores no path: `scripts/art-pack.mjs` derives every
path from the pack id plus the key. See `docs/ARCHITECTURE.md` §1.

The catalog decides WHICH images a pack owes and in what order; the pack
supplies every word. A pack that falls behind the catalog fails
`npm run data:validate`.

Generated images are only the artwork inside a card image frame. A pack's
shared style paragraph must include: `no text, no letters, no numbers, no
logos, no readable symbols, no UI labels, no card frame`.

## Editing

1. Keep existing IDs stable. Saved browser loadouts refer to role and card IDs.
2. Use strict JSON. Comments and trailing commas are not supported.
3. Run `npm run data:generate` after changing roles.
4. Run `npm run data:validate` before committing.

The validator checks JSON Schema rules, duplicate IDs, broken references, snap
ranges, card grades, slot budgets, scenarios, and generated documentation.
`npm run build` runs the same validation automatically.
