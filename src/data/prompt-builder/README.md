# Prompt Builder Data

This directory is the editable source of truth for the Prompt Builder catalog.
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

## Illustration metadata

Roles, card lineages, card grades, and archetypes may include an
`illustration` object. These entries reserve future image paths while the app
continues to render all titles, labels, definitions, bullets, codes, numbers,
and card chrome as text and CSS.

Generated images are only the artwork inside a card image frame. Every image
prompt must include: `no text, no letters, no numbers, no logos, no readable
symbols, no UI labels, no card frame`.

## Editing

1. Keep existing IDs stable. Saved browser loadouts refer to role and card IDs.
2. Use strict JSON. Comments and trailing commas are not supported.
3. Run `npm run data:generate` after changing roles.
4. Run `npm run data:validate` before committing.

The validator checks JSON Schema rules, duplicate IDs, broken references, snap
ranges, card grades, slot budgets, scenarios, and generated documentation.
`npm run build` runs the same validation automatically.
