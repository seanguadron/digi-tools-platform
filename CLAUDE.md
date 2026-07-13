# CLAUDE.md

@AGENTS.md
@docs/STATE.md

<!--
Claude Code compatibility only. Codex reads AGENTS.md directly.

Add only Claude-Code-specific notes below. Do not duplicate AGENTS.md rules or
paste docs/AI_STACK.md content here.
-->

## Claude Code notes

- **Skills**: Claude Code discovers skills ONLY in `.claude/skills/` — the
  curated set bridged from `.agents/skills/` plus the `/digi` router
  (STANDARDS §3.4). The Codex set in `.agents/skills/` is invisible here;
  never install into it from a Claude Code session.
- **Agents**: the judgment gates + sessions agent live in `.claude/agents/`
  (integration-gate, security-gate, design-gate, sessions). Run them per
  AGENTS.md → Gates; save reports to the gate ledger.
- **Dev server**: port 5100 (`npm run dev` / StartDigiTools.bat). If one is
  already running, never start a second — verify in the running one (prefer
  the preview tools). Do not run `npm run build` while a dev server may be
  live; the two share `.next/`.
- **Governance commands**: `check:standards`, `check:security`, `gate:sweep`,
  `amendments`, `skill:log` (see `docs/SETUP.md`).
