<!-- gov:node id=state kind=doc title="STATE.md (current-state snapshot, rewritten every session)" reads=docs/SETUP.md -->

# State

The current-state snapshot. REWRITTEN in place at the end of every working
session (AGENTS.md, Session continuity; STANDARDS §3.5). Written for a reader
with zero prior context: if you have seen nothing but AGENTS.md (or CLAUDE.md
in a Claude Code session), this page tells you where the project stands, how
to run it, and what comes next. History and the why live in
`.ai/notes/SESSIONS.md`; this page is only what is true now.

Last rewritten: 2026-07-09 (introduced by the session-continuity process; the
Now/Built/Backlog sections are honest stubs to be filled at the end of the
next Digi Tools working session).

## Now

This file was introduced on 2026-07-09 as part of a cross-project continuity
process (also landed in YABL-Platform, AmazingOS-Personal, and
WebAppStarterProject). No Digi Tools feature work happened that session, so
the freshest status is the newest entry in `.ai/notes/SESSIONS.md` and the
gate-health stamp in `.ai/notes/gate-status.json`.

## Runbook

- **Start:** `StartDigiTools.bat` or `npm run dev`, port 5100
  (http://localhost:5100). Never start a second dev server if one is already
  running; verify inside the running one.
- **Gotchas:** never `npm run build` while a dev server may be live (they
  share `.next/`).
- **Checks:** `npm run typecheck` · `npm test` · `npm run data:validate`
  (prompt data) · `npm run check:standards && npm run check:security`.
- **Skills:** two homes (STANDARDS §3.4): `.agents/skills/` is the Codex set,
  `.claude/skills/` the Claude Code set; never cross-install.

## Built

Stub. The product is the Digi Tools Prompt Builder (C.R.A.F.T. prompts from
explicit choices; see `PRODUCT.md` and the domain language in `CONTEXT.md`).
Summarize the shipped surfaces and their gate results here at the end of the
next working session.

## Backlog / in flight

Stub. Nothing recorded yet; pull open threads from the newest
`.ai/notes/SESSIONS.md` entries when filling this in. If a session ends
mid-task, record here: the task, the files touched, the next concrete step.

## Pointers

- History: `.ai/notes/SESSIONS.md` (newest-first). Rules:
  `docs/STANDARDS.md`. Gate ledger: `.ai/notes/gate-reports/`. Domain
  language: `CONTEXT.md`.
- `npm run amendments` shows the consent queue; `npm run gate:sweep` stamps
  `.ai/notes/gate-status.json` and warns when this page goes stale.
