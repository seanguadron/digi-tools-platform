# Digi Tools CRAFT Deck

The CRAFT Deck (tool id `prompt-builder`) helps a person assemble a portable
C.R.A.F.T. prompt from explicit choices rather than asking a model to infer
the missing brief.

## Language

**Role Card**:
A selectable expert perspective with a defined identity, judgment, and ability.
_Avoid_: Character, persona, agent

**Role Loadout**:
An ordered selection of up to three Role Cards: one lead role and up to two
supporting roles. Role Cards are chosen directly and are never tuned by sliders.
_Avoid_: Role blend, role slider, role mix

**Tuning Track**:
A discrete control that changes how a C.R.A.F.T. section is interpreted. A
Tuning Track uses labeled Snap Points rather than a continuous numeric range.
_Avoid_: Continuous slider, percentage control

**Snap Point**:
A named, meaningful state on a Tuning Track. Each track has only as many Snap
Points as its concept requires, normally three to five. Its semantic position
is stable, but its displayed label may adapt to the active card category or
output type.
_Avoid_: Tick, arbitrary level

**Track Vocabulary**:
The context-sensitive labels used to explain a Tuning Track's stable Snap
Points for the current category or output type.
_Avoid_: One universal label set

**Vocabulary Driver**:
The equipped base Format Card that determines the Track Vocabulary used across
the builder. Neutral vocabulary is used until a base format is equipped.
_Avoid_: Separate project-type selector

**Output Type Card**:
The base Format Card optionally chosen during opening setup to identify the
artifact being produced and drive vocabulary across the builder. It remains
editable in the Format section.
_Avoid_: Sixth C.R.A.F.T. section, project-type field

**Recommended Default**:
An initial Snap Point selected by the Output Type Card. It remains visible and
editable rather than acting as hidden configuration.
_Avoid_: Hidden preset

**Track Override**:
A Snap Point explicitly changed by the user after a Recommended Default was
applied.
_Avoid_: Custom mode

**Recommended Setup**:
The complete set of Recommended Defaults supplied by an Output Type Card. It is
reapplied only through an explicit user action when Track Overrides exist.
_Avoid_: Automatic reset

**Recommended Card**:
An unequipped card promoted because it aligns with the current Snap Points or
Role Loadout. Recommendations never change the equipped cards automatically.
_Avoid_: Auto-selected card, required card

**Art Pack**:
One world's look for the whole deck: an image brief, alt text, a Card Bio, and
a generated status per card. A card's mechanics are the same in every pack;
only how it looks and who it is change. Sci-Fi ships today with generated
art; Fantasy (hand-painted Warcraft-style) and Superhero (bold comic-book)
are fully authored and awaiting generation.
_Avoid_: Theme, skin, art theme

**Card Bio**:
A card's short character blurb, written per Art Pack and shown in the card's
inspection panel beside its ability. Flavour, never instruction: a Card Bio is
never sent in the assembled prompt.
_Avoid_: Lore, flavour text, description

## Card Families

**Role Card**:
A selectable expert perspective that defines who is thinking. Its identity,
judgment, and ability remain stable while it is equipped.
_Avoid_: Persona card, character card

**Tactic Card**:
A selectable method or ordered action that defines what the model should do.
_Avoid_: Action chip, task tag

**Modifier Card**:
A selectable instruction that changes how the work is framed, constrained, or
delivered without replacing its core tactic.
_Avoid_: Setting card, option tag

**Card Lineage**:
A family of related Tactic or Modifier Card grades that express the same core
idea at different Snap Points. A grade may have its own relevant name,
description, and applied instruction while retaining a recognizable lineage.
_Avoid_: Separate unrelated cards, card skin

**Card Grade**:
One named form within a Card Lineage. Grades represent meaningfully different
levels or modes, not cosmetic rarity.
_Avoid_: Rarity, power level, arbitrary rank

**Category Deck**:
The ordered set of cards currently relevant to one category and its active Snap
Point. Surviving Card Lineages keep their position while morphing between
grades; irrelevant unequipped cards leave and newly relevant cards enter.
_Avoid_: Search results, static card grid

**Equipped Card**:
A card explicitly chosen by the user and placed in a Card Slot for the current
Snap Point. If that grade becomes invalid, it is unequipped but remembered for
restoration when the user returns to the compatible Snap Point.
_Avoid_: Active recommendation, visible card

**Card Slot**:
A visible destination that accepts a compatible card and contributes that
card's instruction to the prompt. Cards may be dragged into a slot or equipped
through an equivalent click or keyboard action.
_Avoid_: Drop box, hidden selection

**Compatible Card**:
The nearest relevant replacement for a card removed by a Snap Point change. It
is suggested through a brief visual emphasis but is never equipped
automatically.
_Avoid_: Automatic replacement

**Snap Memory**:
The remembered equipped-card arrangement associated with an exact combination
of Tuning Track positions within one C.R.A.F.T. section. Returning to that
configuration restores its previously chosen compatible cards.
_Avoid_: Per-track memory, global selection history

**Slot Budget**:
The maximum number of cards that may be equipped in a C.R.A.F.T. section:
Context three, Role three, Action five, Format three, and Target Audience three.
Slots may remain empty.
_Avoid_: Required card count, deck size

## Tuning Tracks

**Context Tracks**:
Context Depth and Evidence Rigor.

**Action Tracks**:
Autonomy, Practicality, and Challenge.

**Format Tracks**:
Output Detail and Structure.

**Target Audience Tracks**:
Audience Expertise and Voice Formality.

Role has no Tuning Tracks.

**Voice Card**:
A Modifier Card that gives the response a distinct expressive quality, such as
direct, reassuring, persuasive, or playful. Voice Cards are separate from the
directional Voice Formality track.
_Avoid_: Tone slider
