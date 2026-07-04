<!-- gov:node id=standards kind=doc title="STANDARDS (consent-gated rules)" reads=docs/DESIGN_DIRECTION.md,docs/AI_STACK.md -->

# STANDARDS

The consent-gated rulebook. Every rule is either **deterministic** (a script
enforces it: `npm run check:standards` / `check:security`, wired to
`prebuild`, the pre-commit hook, and CI) or **judgment** (a gate agent in
`.claude/agents/` verifies it). Each rule carries a `✓ check` naming the
concrete signal.

**Changing this file requires the owner's explicit consent.** Candidates
arrive as flagged lines in `.ai/notes/SESSIONS.md` (`npm run amendments`
lists what is pending); once a rule lands here, annotate the flag
"→ landed in §X.Y".

Adopted 2026-07-04 with consent (the governance-uplift plan approval).

---

## §1 Surfaces

**§1.1 A tool is registered, not improvised (judgment + grep).** A new tool =
an entry in `src/lib/tool-registry.ts` + a page under `src/app/tools/<id>/`.
Navigation, numbering, and shell presence come from the registry; nothing
links to an unregistered tool.
✓ check: the registry entry and the route exist together.

**§1.2 UI conforms to the design direction (judgment).**
`docs/DESIGN_DIRECTION.md` is canonical (AGENTS.md skill-routing precedence).
The Design gate audits changed UI against it: typography, color roles, density,
motion level, voice, and the anti-goals.
✓ check: the Design gate's report, saved to the gate ledger.

**§1.3 Accessibility intent holds (judgment).** WCAG 2.2 AA is the stated
target: contrast, keyboard paths, focus visibility, labels, reduced-motion
respect. The `audit` skill runs before anything client-facing ships.
✓ check: keyboard-only pass on changed surfaces; audit findings addressed.

## §2 Data

**§2.1 Catalogs are validated, always (deterministic via the existing
pipeline).** Every JSON catalog under `src/data/` is covered by
`npm run data:validate` (schema + referential checks) and its tests. Adding a
catalog means registering it in the validate script in the same change.
✓ check: `data:validate` green on prebuild/commit/CI; a new `src/data/*.json`
without pipeline coverage fails review.

**§2.2 Generated docs never drift (deterministic).**
`docs/PROMPT_ROLES.md` is generated from `roles.json` by `data:generate`;
the committed file must byte-match the generator's output.
✓ check: `check:standards` regenerates to a temp file and compares.

**§2.3 The browser trust boundary is validated (judgment + grep).** Anything
entering the app from outside its own code — imported session JSON,
localStorage reads, pasted content — is shape-validated before use (the AJV
schema or an explicit shape check), and failures degrade to defaults, never
crashes.
✓ check: `JSON.parse` of external input is followed by validation, not cast.

**§2.4 No script-injection primitives (deterministic).** No `eval`, no
`new Function`, no `dangerouslySetInnerHTML` outside an explicit allowlist.
Prompt content renders as text, never as markup. Allowlisted today:
`src/app/layout.tsx` only — the no-flash theme bootstrap, a module-level
CONSTANT script whose sole input is a localStorage value checked against a
strict two-value allowlist. Growing this list requires the owner's consent.
✓ check: `check:security` greps src; the allowlist lives in that script.

## §3 Governance

**§3.1 Skill pins (process).** Every installed skill's source commit is
recorded in `.ai/notes/SKILL_VERSIONS.md` in the same commit as the install
or refresh. No auto-updates. (Extends AGENTS.md rule 14.)
✓ check: the pin ledger has a row for every skill directory in BOTH homes.

**§3.2 The gate ledger (process).** After a judgment gate runs on substantial
work, the report is saved as
`.ai/notes/gate-reports/YYYY-MM-DD-<gate>-<slug>.md` (frontmatter: gate,
date, surface, result, findings). `npm run gate:sweep` reads this ledger to
detect gates owed.
✓ check: substantial changes have a ledger report newer than the change.

**§3.3 The graph must be true (deterministic).** Governance files carry
`<!-- gov:node id=… reads=… -->` markers. Ids are unique and every `reads=`
edge names a file that exists.
✓ check: `check:standards` parses and validates every marker.

**§3.4 Two skill homes, one ledger (process).** `.agents/skills/` is the
Codex set; `.claude/skills/` is the curated Claude Code set. Neither mirrors
the other automatically; both are pinned in `SKILL_VERSIONS.md`, and a skill
added to either home updates the ledger in the same commit.
✓ check: the ledger's two sections match the two directories.

## §4 Process

**§4.1 The consent gate.** This file changes only with the owner's explicit
consent. Agents and sessions may PROPOSE (flagged in the sessions log), never
land, an amendment.
✓ check: every rule here traces to a consented decision.
