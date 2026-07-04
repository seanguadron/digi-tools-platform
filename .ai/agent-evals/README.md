# Agent evals

Smoke tests for the gate agents: each fixture plants issues the gate MUST
catch. Run an eval whenever its agent definition in `.claude/agents/`
changes — paste the fixture as "the changed surface," invoke the agent, and
compare its report to the Expected findings. A miss on a MUST item means the
agent definition regressed.
