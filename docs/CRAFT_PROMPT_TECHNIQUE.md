# CRAFT Prompt Technique

CRAFT is the organizing method used by the Digi Tools Prompt Builder. It turns a
rough request into five explicit sections that a language model can follow.

## Context

Describe the situation that makes the prompt necessary. Include the goal,
relevant background, available inputs, known constraints, references, and any
assumptions the model should use or question.

Useful context answers:

- What is happening now?
- What outcome is needed?
- What information or source material is available?
- What limits, deadlines, exclusions, or dependencies matter?
- What would make an answer unusable?

## Role

Choose the expertise and working perspective the model should adopt. The role
description should name the relevant skills, judgment, and responsibilities,
not merely assign a prestigious title.

The selected role comes from `src/data/prompt-builder/roles.json`. Its description is inserted
into the generated prompt and may be edited after export when a narrower domain
specialization is needed.

## Action

State what the model must do as a sequence of observable steps. Each line in the
builder becomes one numbered action.

Strong action steps:

1. Begin with a specific verb.
2. Follow a logical dependency order.
3. Separate research, analysis, creation, and verification when each is needed.
4. Name checks, comparisons, or decision criteria explicitly.
5. End with the exact deliverable or recommendation required.

Do not add theatrical reasoning cues. Ask for useful intermediate work only when
it improves accuracy or makes the result easier to verify.

## Format

Define how the answer should be organized and presented. Format can specify the
container, structure, length, tone, language, code format, citation style, or
level of detail.

Common formats include:

- Markdown brief
- Prioritized list
- Step-by-step plan
- Comparison table
- Structured report
- Email or message draft
- Presentation outline
- Code with implementation notes
- JSON or another machine-readable structure

Use the optional format notes for requirements that the preset does not cover.

## Target Audience

Describe the person or group who will consume the model's final answer. Include
only details that should change the content or explanation.

Useful audience details include:

- Role or level of expertise
- Goal and decision context
- Language and reading level
- Region or regulatory context
- Preferences, concerns, or accessibility needs
- What the audience already knows

## Assembly Rules

The Prompt Builder assembles sections in this order:

1. CONTEXT
2. ROLE
3. ACTION
4. FORMAT
5. TARGET AUDIENCE

The generated prompt should:

- Include all five sections before export.
- Preserve the selected role description.
- Number action steps in the order entered.
- Combine the chosen format preset with any custom format notes.
- Use plain, direct instructions without inflated claims.
- Avoid adding facts, sources, credentials, or requirements the user did not
  provide.

## Output Template

```text
CONTEXT
[Situation, goal, inputs, constraints, references, and assumptions]

ROLE
[Selected role description]

ACTION
1. [First step]
2. [Second step]
3. [Final deliverable or verification step]

FORMAT
[Output structure, length, tone, language, and technical format]

TARGET AUDIENCE
[Who will use the answer and what should change for them]
```
