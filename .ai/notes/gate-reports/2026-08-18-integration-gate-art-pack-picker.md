---
gate: integration
date: 2026-08-18
surface: "CRAFT deck art-pack picker + the fantasy/superhero generation run shipping with it"
result: PASS
findings: 0 required; 4 notes (2 acted on, 2 accepted)
---

# Integration gate — art-pack picker

Per-rule verdicts, all PASS or N/A:

- **§1.4 shell contract** — the picker portals through the shared
  `<ToolSubbar>` as a sanctioned "arbitrary child between title and actions"
  (ARCHITECTURE.md); persistence reuses `readStored`/`writeStored` (the
  discrete-preference precedent, correctly not `useLocalDraft`); CSS reuses
  the `.editor-dialog-seg` idiom byte-for-byte (verified post design-gate
  fix); `role="group"` + `aria-pressed` matches existing segmented controls.
- **§2.1 coverage** — all three packs loop through `craftArtCoverageErrors`;
  226/226 generated in each; 226 files per pack directory on disk.
- **§2.2 doc drift** — `data:validate`'s `generateCraftArtDocs({check:true})`
  passed, independently re-verified byte-identical in an isolated re-run.
- **§2.3 trust boundary** — validate-then-use on the localStorage read
  (typed `unknown`, `isArtPackId`, double validation); degrades to default.
- **§2.4 injection** — no primitives; pack names render as JSX text.
- **§3.3 graph** — no governance file touched; parse clean.
- Battery fresh at audit: typecheck · lint · 148/148 tests · data:validate ·
  check:standards · check:security all green.

## Notes and dispositions

1. **First-paint flash** for returning Fantasy/Superhero users (saved pack
   applies after the mount effect, so sci-fi paints first). Accepted: it
   mirrors the deferred-restore pattern for saved prompts/archetypes and no
   rule mandates otherwise. Revisit with a theme-script-style pre-hydration
   snippet if it bothers in practice.
2. **ARCHITECTURE.md art-pack section stale** — updated same session: §1 now
   names the three packs, the picker, `setActiveArtPack`/`isArtPackId`, and
   the persistence key.
3. **`DEFAULT_ART_PACK_ID` dead export** — removed same session (PACKS[0]
   remains the single source of the default inside the module).
4. **§2.2 rule under-names the CRAFT_ART_* doc family** — pre-existing
   pending amendment, already in the consent queue.

Covers commits `8c39625` (the art pass — pack JSONs, generated docs, public
art all audited per the "diff is larger than the four files" note above) and
`d0fd854` (the picker), which landed after this report was first saved.
