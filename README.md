# Digi Tools

A local-first toolbox for working with AI models. Build prompts for language
and image models from a deck of cards, sketch an application's architecture,
edit images and vectors, and browse your skill stack.

Everything runs in the browser. There is no account, no server-side state, and
nothing is uploaded — your work lives in `localStorage` and in files you
export.

**[Live app](https://digi-tools-platform-eight.vercel.app)** · Created by
[Sean Guadron](https://seancreates.com)

---

## The tools

| | Tool | What it does |
|---|---|---|
| 01 | **CRAFT Deck** | Turns a rough request into a structured language-model prompt. Equip role cards and tactic cards onto a C.R.A.F.T. brief — Context, Role, Action, Format, Target audience. 35 roles, 32 modifier cards at four intensities each, 25 ready-made archetypes. |
| 02 | **PICTURE Deck** | The same idea for image models: P.I.C.T.U.R.E. — Protagonist, Illumination, Canvas, Tone, Universe, References, Execution. 100 cards at three intensities, 18 archetypes, and an optional Midjourney parameter tail. |
| 03 | **Architect Wizard** | Sketch an app's architecture on a canvas — managers, services, workers, data — then export a build brief an AI agent can work from. |
| 04 | **Skills** | A reference wiki for the AI skill stack this project uses: what each skill does and how to install it. |
| 05 | **Image Editor** | A layer-based raster editor: paint, select, transform, adjust, export PNG. |
| 06 | **Vector Editor** | An SVG editor: draw shapes, style fills and strokes, export clean SVG or a rasterized PNG. |

Every card in both decks carries original key art — 1,104 images across four
illustrated worlds. The CRAFT deck ships in three (Sci-Fi, Fantasy,
Superhero) and switches between them at runtime; the PICTURE deck has one,
where each card's art demonstrates the technique that card teaches.

## Running it

```bash
npm install
npm run dev
```

The dev server runs on port **5100**.

```bash
npm run build && npm start   # production build
```

## Checks

The build refuses to produce anything that would break the catalogs or the
project's own rules. `prebuild` runs the data validators and both
deterministic gates, so `npm run build` cannot succeed on invalid data.

```bash
npm run typecheck        # tsc, no emit
npm run lint             # eslint
npm run test             # node:test — catalogs, art packs, the write endpoint
npm run data:validate    # both card catalogs + generated-doc drift
npm run check:standards  # the enforceable half of docs/STANDARDS.md
npm run check:security   # injection primitives, committed secrets, route guards
```

## How it is built

Next.js 16 (App Router) and React 19, TypeScript throughout, plain CSS with
design tokens — no UI framework, no CSS-in-JS. React Flow drives the architect
canvas; `@dnd-kit` drives card dragging. Card art is generated externally and
committed as webp.

The interesting structural idea is the **art pack**. A card is two things: the
catalog owns what a card *is* — id, name, description, mechanics, identical in
every world — and a pack owns what it *looks like* in one world: the image
brief, its alt text, a character bio, and whether that image exists yet. A pack
never stores an image path; every path is derived from the pack id plus the
entry key. Swapping worlds is therefore a re-render, not a data migration, and
adding a world needs no file moves and can't collide with an existing one.

`docs/ARCHITECTURE.md` is the contract for how a tool plugs into the shared
shell, and what to recycle rather than rebuild.

## Repository layout

```
src/app/          routes — one folder per tool, plus a dev-only studio
src/components/   the shell, the decks, the editors
src/lib/          catalog engines, prompt composition, storage
src/data/         card catalogs and art packs (JSON, schema-validated)
scripts/          validators, doc generators, the art-pack toolkit
docs/             architecture, standards, design direction, art briefs
.claude/          agent definitions and the skill set for Claude Code
```

## A note on the docs

This project is developed with AI agents as a first-class part of the process,
so some of what is committed here is written for them rather than for a human
reader: `AGENTS.md` and `docs/STANDARDS.md` are the rulebook, `docs/STATE.md`
is a snapshot rewritten at the end of every working session, and
`.ai/notes/SESSIONS.md` is the running history of decisions and why they were
made. The judgment gates in `.claude/agents/` audit new work against those
documents before it ships.

The skills under `.claude/skills/` and `.agents/skills/` are third-party, each
vendored from its own upstream project and pinned in
`.ai/notes/SKILL_VERSIONS.md`. They belong to their respective authors and
carry their own licenses.
