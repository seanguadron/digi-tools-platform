# Digi AI Stack For Codex

<!-- gov:node id=ai-stack kind=doc title="AI_STACK.md (skill catalog + workflow)" reads=docs/DESIGN_DIRECTION.md,docs/STANDARDS.md -->

This repository uses a layered AI workflow for building polished,
production-ready software. The complete project catalog is installed where
Codex can discover each skill without loading its full instructions on every
task.

The binding operating rules live in root `AGENTS.md`. This document is the
catalog, installation guide, and workflow reference.

## Codex Mapping

| Purpose | Codex location |
|---|---|
| Durable project instructions | `AGENTS.md` |
| Repo-scoped skills | `.agents/skills/<skill-name>/SKILL.md` |
| Design references | `.ai/design-references/` |
| Stack notes and version pins | `.ai/notes/` |
| Full workflow reference | `docs/AI_STACK.md` |
| Project design direction | `docs/DESIGN_DIRECTION.md` |

Codex reads `AGENTS.md` directly, so there is no Codex equivalent named
`CODEX.md`. `CLAUDE.md` remains only as a compatibility shim for Claude Code and
imports `AGENTS.md`.

Codex uses progressive disclosure for skills: it initially sees skill metadata,
then reads the full `SKILL.md` only when a task matches.

## When The Stack Applies

| Task type | Design | Engineering | QA |
|---|---:|---:|---:|
| New page, new UI, visual redesign | Yes, first | Yes | Yes |
| Feature work, logic, data, refactor | When UI changes | Yes | Yes |
| Bug fix, typo, config | No | Surgical rules | Spot-check |
| Copy or content | Writing workflow | As needed | Read rendered output |

A substantial change includes a new route or page, a visually significant
component, an architectural change, or client-facing behavior.

## Layer 1: Design

### Direction first

Before substantial UI work, choose one to three concrete references and create
`docs/DESIGN_DIRECTION.md` with:

- visual references and intended character
- typography and color direction
- layout density and spacing rhythm
- component and interaction feel
- motion level and whether GSAP is justified
- voice and copy direction
- explicit anti-goals

### Default skills

- **Impeccable** (`pbakaus/impeccable`): primary visual direction, hierarchy,
  typography, spacing, accessibility, and anti-generic polish.
- **Emil Design Engineering** (`emilkowalski/skill`): interaction feel,
  micro-interactions, transitions, and motion restraint.
- **Avoid AI Writing** (`conorbronsdon/avoid-ai-writing`): detect or remove
  generic AI-writing patterns while preserving voice.
- **Web Design Guidelines** (`vercel-labs/agent-skills`): interface and
  accessibility review.

Conflict precedence:

1. `docs/DESIGN_DIRECTION.md`
2. Impeccable
3. Emil Design Engineering
4. Taste Skill
5. Web Design Guidelines

### References

- Refero Styles: <https://styles.refero.design/>
- Local library:
  `.ai/design-references/awesome-design-md` from
  `github.com/VoltAgent/awesome-design-md`

References are not skills and do not belong in `.agents/skills/`.

## Layer 2: Engineering

### Version truth

Before framework-specific changes:

1. Confirm installed versions from the package manifest and lockfile.
2. Prefer local package documentation when available.
3. Otherwise use the matching skill and version-matched official docs.
4. Do not apply patterns from another major version without verification.

### Default skills

- **Next Best Practices** (`vercel-labs/next-skills`): App Router, server/client
  boundaries, loading, metadata, caching, and deployment correctness.
- **Vercel React Best Practices** (`vercel-labs/agent-skills`): React and
  Next.js performance patterns.
- **Vercel Composition Patterns** (`vercel-labs/agent-skills`): scalable
  component APIs and alternatives to boolean-prop proliferation.
- **Karpathy Guidelines** (`forrestchang/andrej-karpathy-skills`): simple,
  surgical implementation and explicit assumptions.
- **Grill With Docs** (`mattpocock/skills`): architecture interrogation and
  documented tradeoffs for consequential decisions.
- **TDD** (`mattpocock/skills`): logic changes and refactors where regressions
  would be costly.

## Layer 3: QA And Deployment

- **AccessLint Audit, Scan, and Diff** (`accesslint/claude-marketplace`):
  WCAG, contrast, keyboard, focus, and form checks. `diff` uses temporary git
  stash or branch switching and requires explicit user approval before use.
- **Webapp Testing** (`anthropics/skills`): browser inspection, screenshots,
  responsive checks, and rendered-state verification.
- **Vercel Optimize** (`vercel-labs/agent-skills`): Vercel cost, performance,
  usage, and deployment analysis.

Before delivery, verify the affected code and rendered behavior. For
client-facing work, also check visual hierarchy, copy quality, accessibility,
responsive behavior, and deployment readiness.

## Extended Design And Motion Skills

All published skills from these repositories are installed:

- **Taste Skill** (`Leonxlnx/taste-skill`): 13 skills covering brand systems,
  premium frontend direction, redesigns, image-led design, visual styles,
  Stitch design systems, and exhaustive output workflows.
- **GSAP skills** (`greensock/gsap-skills`): 8 official skills covering core
  tweens, framework lifecycle, performance, plugins, React, ScrollTrigger,
  timelines, and utilities.

Use these only when their descriptions match the task. The design conflict
precedence in `AGENTS.md` still applies.

## Installation

Codex discovers repository skills from `.agents/skills/`. The current `skills`
CLI can target Codex explicitly:

```powershell
# Design
npx skills add pbakaus/impeccable --agent codex --copy --yes
npx skills add emilkowalski/skill --agent codex --copy --yes
npx skills add conorbronsdon/avoid-ai-writing --agent codex --copy --yes

# Engineering
npx skills add vercel-labs/next-skills --skill next-best-practices --agent codex --copy --yes
npx skills add vercel-labs/agent-skills --skill web-design-guidelines --agent codex --copy --yes
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices --agent codex --copy --yes
npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns --agent codex --copy --yes
npx skills add forrestchang/andrej-karpathy-skills --skill karpathy-guidelines --agent codex --copy --yes
npx skills add mattpocock/skills --skill grill-with-docs --agent codex --copy --yes
npx skills add mattpocock/skills --skill tdd --agent codex --copy --yes

# QA
npx skills add accesslint/claude-marketplace --skill audit scan diff --agent codex --copy --yes
npx skills add anthropics/skills --skill webapp-testing --agent codex --copy --yes

# Extended design and motion
npx skills add Leonxlnx/taste-skill --skill '*' --agent codex --copy --yes
npx skills add greensock/gsap-skills --skill '*' --agent codex --copy --yes

# Deployment optimization
npx skills add vercel-labs/agent-skills --skill vercel-optimize --agent codex --copy --yes
```

Use `--copy` so the repository contains reviewable skill files rather than
machine-specific links. If the CLI cannot install a source, copy only the
required skill directory containing `SKILL.md`; never copy an entire repository.

Clone reference material separately:

```powershell
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git .ai/design-references/awesome-design-md
```

## Maintenance And Security

Third-party skills inject instructions into agent context. Treat them like
dependencies:

1. Review every installed `SKILL.md`.
2. Record source and revision in `.ai/notes/SKILL_VERSIONS.md`.
3. Update deliberately and review diffs.
4. Remove skills that are not relevant to the project.
5. Never auto-update instruction dependencies.
6. Treat skill-suggested packages and hosted assets as task-specific
   dependencies. Installing the skill does not approve installing or embedding
   them.

The installed `web-design-guidelines` skill requests the latest Vercel rule
document when invoked. Treat that fetch as a deliberate external dependency:
report when it cannot be fetched, and do not silently substitute remembered
rules.

## Default Workflow

### 1. Establish direction

For substantial UI work, consult references and write or update
`docs/DESIGN_DIRECTION.md`.

### 2. Build correctly

Confirm versions, choose boundaries deliberately, keep components composable,
and make small verifiable changes.

### 3. Polish and verify

Review against the design direction, remove generic design and writing tells,
check accessibility and responsive behavior, inspect rendered output, and check
deployment readiness.

If this document conflicts with `AGENTS.md`, follow `AGENTS.md` and then repair
the inconsistency.

## Governance Layer (added 2026-07-04)

The stack above covers HOW to build; the governance layer verifies WHAT was
built, with the same machinery this stack's successor projects use:

- **Gates**: three read-only judgment agents in `.claude/agents/`
  (integration-gate, security-gate, design-gate) plus deterministic halves
  (`npm run check:standards`, `npm run check:security`) wired to `prebuild`,
  the pre-commit hook, and CI. The rulebook is the consent-gated
  `docs/STANDARDS.md`.
- **Learning loop**: the `sessions` agent appends decisions to
  `.ai/notes/SESSIONS.md`; proposals graduate into STANDARDS only with the
  owner's consent (`npm run amendments` lists what is pending). The gate
  ledger lives in `.ai/notes/gate-reports/`; `npm run gate:sweep` detects
  judgment gates owed.
- **Orchestration**: governance files carry `gov:node` markers;
  `check:standards` fails the build on a false edge.

### Two skill homes

`.agents/skills/` stays the Codex home (this catalog). `.claude/skills/`
carries the curated Claude Code set: the sharp subset of this catalog plus
three additions and a router, all pinned in `.ai/notes/SKILL_VERSIONS.md`
(STANDARDS §3.4). The GSAP suite and Taste collection are deliberately not
bridged (no gsap dependency in the repo).

Claude-set additions beyond this catalog:

- **Diagnosing Bugs** (`mattpocock/skills`): the feedback-loop discipline for
  hard bugs and performance regressions.
- **Improve Codebase Architecture** (`mattpocock/skills`): the periodic
  entropy radar; run every week or two before drift compounds.
- **Writing Great Skills** (`mattpocock/skills`): the authoring bar for our
  own skills AND agent specs.
- **digi** (authored in this repo): the `/digi` router — routes a task to the
  right gate, skill, or command.
