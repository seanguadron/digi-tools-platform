# Agent Principles

<!-- gov:node id=agent-principles kind=doc title="Agent Principles (the shared template)" -->

A shared vocabulary for describing, examining, and building agents.

Use it two ways:

- **Reflect**: point it at an existing agent to understand what it is and where it will break.
- **Build**: fill the same slots, in order, to construct a new agent with the same shape every time.

The value is the shared language. Every agent, yours, a teammate's, a framework's, gets described in one consistent structure, so you can compare them, debug them, and hand them off without re-learning each one.

> In this repo, this doc is the **template every `.claude/agents/*.md` conforms to** (the agent-shaped counterpart to how `docs/STANDARDS.md` governs modules). [AGENTS.md](../AGENTS.md) and each agent declare a `reads=agent-principles` edge, so the orchestration map (`/admin/orchestration`) shows the vocabulary in use. See §8 for the project's own agents filled into the spec.
>
> **Scope.** This is the *agent framework*: how agents **build** the app. It is distinct from the product architecture (what your app IS — see docs/ARCHITECTURE.md). Don't conflate the two.

---

## 1. The vocabulary

Every agent decomposes into three kinds of things. Each principle lives in exactly one bucket. If you can't place a term, the design isn't clear yet.

**Config, authored once, fixed while it runs**

- **Role**: the agent's standing job and scope; the boundary of what it can be asked to do.
- **Skills**: the actions and tools it can take.
- **Policy**: how it chooses the next action (rules, heuristics, model inference, or a mix).
- **Termination**: every condition under which the agent is allowed to stop.

**Data, changes while it runs**

- **Goal**: the concrete objective for the current run, with a definition of done.
- **State**: volatile, per-run working context (steps taken, partial results, open sub-goals).
- **Memory**: durable knowledge reused across runs.
- **Environment**: the external world it senses and acts on (files, APIs, web, DB, game world, sensors).

**Process, what it does, expressed as loops**

- **Perceive**: read the current environment into state.
- **Plan**: sequence actions toward the goal; revise when off-track.
- **Decide**: pick the next action (Policy applied to State).
- **Act**: execute a skill, changing the environment.
- **Feedback**: evaluate whether the action worked.
- **Adapt**: update policy, plan, or memory from accumulated feedback.

Two rules that keep the vocabulary honest:

- **Config is authored, Data is observed, Process is run.** When a term has both a noun and a verb form (a policy vs applying it), the noun is Config and the verb is Process.
- **Environment is a closed loop.** Perceive reads it; Act writes to it. Same environment on both ends, never a one-way input.

> **Reconciliation with the earlier list.** An earlier draft used a flat ten: Role · State · Perception · Rules · Goal · Skills · Planning · Autonomy · Feedback · Adaptation. They map straight onto the buckets above (Rules→Policy, Perception→Perceive, Planning→Plan, Autonomy→an Autonomy checkpoint on Act); this version adds **Termination, Memory, and Environment**: the three the flat list was missing. Use this vocabulary, not the flat one.

---

## 2. The three loops (by timescale)

The Process terms run inside three nested loops, separated by how fast they turn. An inner loop turns many times within one pass of the loop outside it.

**Control loop, per step (ms–seconds)**

- Cycle: **Perceive → Decide → Act → Feedback → repeat.**
- The reflex layer. No deliberation. Tool errored → retry.
- Failure mode: bad tool calls, misread observations.

**Task loop, per task (seconds–minutes)**

- Cycle: **Plan → run the control loop ×N → check against Goal → replan or Terminate.**
- Where agency lives, the loop that asks "am I actually making progress?"
- Without it you have automation, not an agent.
- Failure mode: runaway iteration or premature quitting. This is Termination's job.

**Learning loop, across tasks (hours–weeks)**

- Cycle: **accumulate Feedback → Adapt → update Memory/Policy → better future plans.**
- Optional. Most production systems run this manually: review, tweak, redeploy.
- Failure mode: thrashing on noisy feedback, or slow drift.

> **Debugging shortcut:** name the loop the bug lives in first. Most fixes follow from that.

---

## 3. Reflection lens: read an existing agent

Walk the slots in order. For each, name what the agent uses, and flag the **smell** if it's missing or muddled.

- **Role**: Is the scope stated and bounded? *Smell:* the agent is described by a task ("summarize this PDF") rather than a standing job, it can't be reused.
- **Goal + Termination**: Is "done" defined, and every stop condition enumerated? *Smell:* no explicit termination, so it loops forever or quits arbitrarily.
- **Environment**: Is the surface it reads from and writes to named? *Smell:* a "Perceive" step with no stated source, perception floating in air.
- **Skills**: Do the available actions actually cover the goal? *Smell:* a goal that no listed skill can reach.
- **State vs Memory**: Are volatile and persistent cleanly separated? *Smell:* per-run scratch and durable knowledge in one store, causing leakage across runs or amnesia within one.
- **Policy**: Is it clear how the next action is chosen? *Smell:* "the agent decides" with no mechanism named.
- **Planning / Task loop**: Does it check progress against the goal, or only react? *Smell:* a control loop only, automation wearing an agent costume.
- **Feedback**: Is there a per-step signal that an action worked? *Smell:* it acts blindly and never evaluates.
- **Adaptation**: Is improvement automatic, manual, or absent, and is that on purpose? *Smell:* claims to learn but nothing updates; or it rewrites strategy on every noisy result.
- **Autonomy**: Are the human checkpoints explicit? *Smell:* unbounded autonomy with no approval gate on irreversible actions.

---

## 4. Construction lens: build a new agent

Order matters: each step constrains the next. Answer one question per step.

1. **Role**: What standing job is this? Write the scope boundary first.
2. **Goal + Termination**: What does one task look like, what counts as done, and every way it should stop? Define these together; "done" is just the success branch of termination.
3. **Environment**: What does it read from and act on? This fixes the Perception inputs and the Skill surface.
4. **Skills**: What actions does it need to get from start to done in that environment? Nothing more.
5. **State**: What must it track within a single run?
6. **Memory**: What, if anything, should survive across runs? Default to none until you need it.
7. **Policy**: How does it pick the next action: rules, model, or hybrid?
8. **Planning**: Does the task need multi-step sequencing (build the task loop) or is it reflexive (control loop only)? Don't add a task loop you don't need.
9. **Feedback**: What signal tells you a step worked?
10. **Adaptation**: Will it improve automatically, manually, or not at all? Choose deliberately; manual is a valid answer.
11. **Autonomy**: Where do humans sit? Gate irreversible actions.

> **Build rule:** you can ship with Config + Data + Control loop + Termination. The Task loop and Learning loop are added only when the job demands them.

---

## 5. The agent spec (the artifact)

Every agent, examined or built, ends up described in this one shape. Filling it in is the continuity.

```
AGENT: <name>

CONFIG
  Role:        what standing job, what scope boundary
  Skills:      actions / tools available
  Policy:      how the next action is chosen
  Termination: every stop condition

DATA
  Goal shape:  what one task is, and what "done" means
  State:       volatile, per-run
  Memory:      persistent, cross-run (or: none)
  Environment: what it reads from and acts on

PROCESS
  Loops used:  [ ] Control   [ ] Task   [ ] Learning
  Feedback:    per-step success signal
  Adaptation:  automatic | manual | none
  Autonomy:    human checkpoint(s) at ____
```

---

## 6. One-line summary

> Agent = **Config** (Role + Skills + Policy + Termination) + **Data** (Goal + State + Memory + Environment) + **Process** (Perceive + Plan + Decide + Act + Feedback + Adapt), run as **three nested loops** by timescale.

---

## 7. Porting note, classic game AI

The control loop generalizes everywhere; the outer loops do not. Before reusing this language on a behavior-tree or GOAP system, remap rather than assume "same machine":

- **Behavior tree** = authored Policy + control flow. No learning loop; behavior is designed, not adapted.
- **GOAP** = a real Planning / task loop (A* over action preconditions and effects), but a symbolic Policy and no learning loop.
- **Blackboard** = a State + Memory store. One Data slot, not a whole architecture.
- **LLM frameworks** (LangGraph, AutoGen, CrewAI, Claude Code) implement all three loops; game AI usually implements one or two by hand.

Keep the claim precise: the control loop is shared; the task and learning loops are where paradigms diverge.

---

## 8. The agents in this repo

The project already runs this model. The **main agent** (Claude Code) runs all three loops live; the **subagents** in `.claude/agents/` are narrower specialists invoked at checkpoints; and one of them, the **sessions agent**: *is* the system's Learning loop. Each appears as a node on `/admin/orchestration`.

```
AGENT: integration-gate  (the standards gate)
CONFIG
  Role:        audit a new/changed module or admin surface vs docs/STANDARDS.md; read-only
  Skills:      Read, Grep, Glob, Bash
  Policy:      run each STANDARDS ✓ check; model judgment on the non-deterministic rules
  Termination: per-rule PASS/FAIL/N-A checklist complete + tsc reported
DATA
  Goal shape:  "audit surface X" → done = evidence-backed checklist + ordered fixes
  State:       per-run findings per rule
  Memory:      none (re-reads STANDARDS.md each run)
  Environment: reads repo (pages, stores, schemas, registry); writes a report to the caller
PROCESS
  Loops used:  [x] Control  [x] Task  [ ] Learning
  Feedback:    every FAIL cites path:line evidence
  Adaptation:  manual (via the sessions log)
  Autonomy:    read-only; the main agent applies the fixes
```

```
AGENT: security-gate  (the security gate)
CONFIG
  Role:        pre-delivery security review of this repo's surface; read-only
  Skills:      Read, Grep, Glob, Bash
  Policy:      repo-specific security checklist (auth guards, atomic writes, media/path
               safety, zod boundaries, no secrets in src/data) + model judgment
  Termination: checklist complete with a verdict + severity per finding
DATA
  Goal shape:  "security-review surface/diff X" → done = findings + severity + fixes
  State:       per-run findings
  Memory:      none
  Environment: reads repo (routes, lib, data, config); writes a report to the caller
PROCESS
  Loops used:  [x] Control  [x] Task  [ ] Learning
  Feedback:    each finding cites path:line + the practice it violates
  Adaptation:  manual (via the sessions log)
  Autonomy:    read-only; the main agent applies the fixes
```

```
AGENT: design-gate  (the design gate)
CONFIG
  Role:        pre-delivery design-system audit of changed UI vs docs/DESIGN.md; read-only
  Skills:      Read, Grep, Glob, Bash
  Policy:      the DESIGN.md checklist (tokens, typography, icons, spacing, card recipe,
               hover/focus grammar, z-ladder, motion, anti-list) + model judgment
  Termination: every checklist item has a verdict; findings carry severity + fix
DATA
  Goal shape:  "design-review surface X" → done = findings + severity + fixes
  State:       per-run findings
  Memory:      none (re-reads docs/DESIGN.md each run)
  Environment: reads repo (pages, components, globals.css); writes a report to the caller
PROCESS
  Loops used:  [x] Control  [x] Task  [ ] Learning
  Feedback:    each finding cites path:line + the DESIGN.md rule it violates
  Adaptation:  manual (via the sessions log)
  Autonomy:    read-only; the main agent applies the fixes
```

```
AGENT: sessions  (the Learning loop)
CONFIG
  Role:        maintain .ai/notes/SESSIONS.md, the system's adaptation channel
  Skills:      Read, Edit
  Policy:      distill the caller's session feedback into one dated, non-duplicative entry
  Termination: one entry prepended; proposed STANDARDS amendments listed back to the caller
DATA
  Goal shape:  "record session X" → done = entry added + consent-flags returned
  State:       the entry being composed
  Memory:      the log itself, durable cross-run knowledge that shapes future behavior
  Environment: reads + writes .ai/notes/SESSIONS.md
PROCESS
  Loops used:  [ ] Control  [ ] Task  [x] Learning
  Feedback:    quality = non-duplicative, correctly consent-flagged
  Adaptation:  it IS the adaptation channel; docs/STANDARDS.md is its consent-gated formalization
  Autonomy:    appends freely; STANDARDS.md changes need Sean's explicit consent
```

The shape of the system: the **gate agents** run Control + Task loops with **manual** Adaptation; the **sessions agent** closes the **Learning loop** by turning that manual feedback into durable memory (and, with consent, into `docs/STANDARDS.md` rules the gates then enforce). That is the loop in §2, implemented across the project's real files.
