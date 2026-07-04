<!-- gov:node id=setup kind=doc title="SETUP.md (boot + governance commands)" reads=docs/STANDARDS.md,docs/AI_STACK.md -->

# Setup

## Boot

```powershell
npm install          # also wires .githooks via the prepare script
npm run dev          # http://localhost:5100
```

`StartDigiTools.bat` does the same from Explorer. `next.config.ts` detects
the LAN IPv4 at startup so the dev server is reachable across the network;
HMR over LAN needs the origin allowed there. If a dev server is already
running on 5100, do not start a second one.

## The script inventory

Data pipeline (pre-existing):

- `npm run data:validate` — schema + referential checks over every catalog in
  `src/data/` (runs on prebuild, the pre-commit hook, and CI).
- `npm run data:generate` — regenerates `docs/PROMPT_ROLES.md` from
  `roles.json`. Run it whenever roles change; the drift check fails otherwise.
- `npm run data:test` / `npm test` — catalog + logic tests (node test runner).

Governance (added by the uplift):

- `npm run check:standards` — deterministic standards gate: gov:node graph
  truth, PROMPT_ROLES drift, script-injection grep, filename conventions.
- `npm run check:security` — deterministic security gate scoped to this
  app's real surface: secrets hygiene, trust-boundary validation presence,
  download filename sanitization.
- `npm run gate:sweep` — re-runs both checks, stamps
  `.ai/notes/gate-status.json`, and lists judgment gates owed.
- `npm run amendments` — pending STANDARDS proposals from the sessions log.
- `npm run skill:log -- <skill> "<surface>"` — the skill-usage ledger.

Quality: `npm run typecheck`, `npm run lint`.

## The governance loop

Phases → gates → learning loop, defined in `AGENTS.md`. The judgment gates
live in `.claude/agents/` (integration-gate, security-gate, design-gate,
sessions); their deterministic halves are the two check scripts above, wired
to `prebuild`, `.githooks/pre-commit`, and `.github/workflows/checks.yml`.
Rules live in `docs/STANDARDS.md` and change only with the owner's consent;
proposals accumulate in `.ai/notes/SESSIONS.md`.

## The two skill homes

- `.agents/skills/` — the Codex set (~40 skills; Codex discovers these).
- `.claude/skills/` — the curated Claude Code set (the sharp subset + the
  `/digi` router; Claude Code only discovers skills here).

Both are pinned in `.ai/notes/SKILL_VERSIONS.md` (STANDARDS §3.4). The GSAP
suite and the Taste collection are deliberately not bridged to the Claude set
(the repo has no gsap dependency).
