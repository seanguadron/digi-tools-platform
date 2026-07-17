# Digi Tools Design Direction

<!-- gov:node id=design-direction kind=doc title="DESIGN_DIRECTION.md (canonical visual direction)" -->

## Intent

Digi Tools is a working cockpit, not a public marketing showcase. The welcome
page should explain the product quickly, then move the user into a real tool.
The Prompt Builder should feel useful on first load and remain clear at narrow
viewport widths.

## References

- Linear: restrained navigation, compact type hierarchy, reliable focus states
- Raycast: keyboard-friendly utility feel and dense but calm controls
- Figma property panels: direct manipulation with the result visible nearby

These are interaction references, not instructions to copy their branding.

## Design Read

Product UI for makers and developers, with a calm cockpit language and a
restrained native-CSS plus Tailwind system.

- Design variance: 5
- Motion intensity: 3
- Visual density: 6

## Theme And Color

Dark is the initial theme, with a visible light and dark toggle. Both modes are
first-class.

- Background: blue-tinted neutral, never pure black or white
- Surface: one lightness step above the canvas
- Primary accent: cyan for focus, active state, and the main action
- Secondary accent: magenta only for a single featured marker when needed
- Color strategy: restrained, with accent color below 10% of the surface

Use the OKLCH values from the supplied Digi Tools token handoff. Focus rings
must remain visible in both themes.

### Accent colors mark; they do not spell (resolved 2026-07-17)

The brand accents are tuned bright so they read as markers on a dark canvas.
That makes them illegible as light-theme TEXT: `--brand-cyan` measured
1.5–1.8:1 and `--brand-magenta` 3.0:1 against light surfaces, against a 4.5:1
AA floor — a systemic failure across ~247 elements, invisible for as long as
the light theme was unreachable on the tool routes. So the tokens split by
JOB, not by hue:

| Job | Token | Why |
|---|---|---|
| Borders, focus rings, markers, fills, underlines | `--brand-cyan` / `--brand-magenta` | UI components owe 3:1 (WCAG 1.4.11). The light-theme cyan was retuned to clear it — at its old value the sitewide `:focus-visible` ring measured **1.5:1**, i.e. the focus indicator was effectively invisible on light backgrounds. Dark is unchanged. |
| Any text, including inside `color-mix()` | `--brand-cyan-text` / `--brand-magenta-text` | Darkened in light theme to clear AA on every surface token; IDENTICAL to the marker accent in dark theme, so dark rendering never changes. |
| Text sitting ON a cyan fill | `--brand-cyan-foreground` | The fill's ink is dark in BOTH themes. `--primary-foreground` is wrong here — it flips to near-white in light theme, which is what left white-on-cyan at 1.8:1. A token that flips is wrong on a surface that doesn't. |

Rules that follow from it:

- Cyan is a focus/marker/active color, never a light-theme text color.
- A per-item accent that comes from data (e.g. the Architect block accents)
  is handed to CSS as a custom property, never set as an inline `color` —
  inline styles beat the theme rule and strand the text at ~2.2:1.
- Both themes are first-class, so any new accent-colored text is checked in
  BOTH before it ships. WCAG AA is a stated PRODUCT.md goal, not a nicety.
- **Check text AND non-text.** They are different floors (4.5:1 vs 3:1) and
  different measurements — "text on its background" versus "a border or ring
  against what it sits on". A text-only sweep passes a page whose focus rings
  are invisible; that is exactly how the 1.5:1 ring survived the first pass
  of this very fix.
- Check a surface with CONTENT in it, not just its default empty state. The
  Architect's canvas labels kept a 2.3:1 accent through an audit that scored
  the route clean, because an empty canvas has no nodes to measure.

## Typography

Use Open Sans for interface text and Geist Mono for generated prompts, code, and
structured previews. Product headings use a fixed scale rather than fluid
display type.

- Page title: 2.25rem, semibold
- Section title: 1.5rem, semibold
- Body: 0.875rem to 1rem
- Caption: 0.75rem
- Prose measure: 65 to 75 characters

## Layout

The shared shell has a compact top bar, a context bar, and a fixed status bar.
The welcome page uses an asymmetric split. Tool pages use a responsive work
area with the editor first and the generated artifact second.

At widths below 900px, the work area becomes one column. Navigation remains
usable without horizontal page scrolling.

## Components

- Cards use a 14px radius, a thin border, and surface contrast instead of large
  shadows.
- Buttons may be solid, outline, or quiet. All share the same height, radius,
  focus ring, and pressed translation.
- Inputs use visible labels, strong placeholder contrast, and inline help only
  when it changes the user's decision.
- The live prompt preview uses Geist Mono and preserves whitespace.

### Prompt Builder card system

The Prompt Builder uses an original collectible-card interaction inspired by
the structure of Fallout 76 perk management: category tabs, tall role cards,
an ordered role loadout, and an inspection panel that appears beside the active
card. It does not copy Fallout illustrations, typography, names, colors, or
card artwork.

The system has four card families with one shared visual grammar:

- Role Cards define who is thinking.
- Tactic Cards define what the model should do.
- Modifier Cards define how the work is framed, constrained, or delivered.
- Archetype Cards are premium master-plan presets that fill a deck while still
  leaving the user's Context and Target details blank.

Card illustrations are artwork only. Generated images sit inside the card image
frame and must not contain card titles, type labels, bullets, codes, numbers,
letters, logos, readable symbols, UI chrome, or the card template itself. The
application owns every piece of text and every frame.

The builder uses progressive disclosure to control cognitive load:

- Each step shows one title. Do not repeat the step explanation inside the
  card, field label, and workbench.
- Workbench groups use a short label and state count. Interaction instructions
  belong in accessible names or optional help, not persistent body copy.
- Card faces show identity and selection state. Full descriptions appear in a
  side inspection panel anchored beside the hovered or focused card, not in a
  fixed readout below the deck.
- Ability inspection panels teach the card with one to six short purpose
  points; use two or three by default. Role panels show up to three role
  priorities.
- Equipped card purpose points and selected-role priorities become part of the
  generated prompt, so the guidance affects model behavior rather than serving
  as interface copy only.
- On fine pointers, nearby cards may tilt by a few degrees toward the pointer.
  Hover enlarges selectable deck cards slightly; equipped cards tilt but do not
  enlarge.
- Dragging uses a full card-shaped pointer preview. A successful drop receives
  one short shrink-and-rotate settle animation to confirm placement.
- Card motion is bounded, non-looping, and removed under reduced motion.
- Role, Tactic, and Modifier Cards use a consistent 5:7 playing-card ratio.
- The loadout is a medium-gray rack, visibly distinct from both the page canvas
  and the cards without becoming a near-black inverse panel. Each slot is
  slightly larger than a card and displays the complete equipped card face,
  not a text summary.
- Equipped cards remain draggable. Dropping a card into an earlier occupied
  slot inserts it there and pushes the following cards to the right. A Clear
  action sits at the lower-right of every rack.
- Empty slots use shape, numbering, and a plus mark. Do not repeat "open slot"
  and "drop here" inside every slot.
- Generated prompt instructions remain available behind an explicit disclosure
  instead of appearing beneath every card by default.
- Role and category decks include a compact search control below the cards.
  Role search may span categories without changing the active category or
  equipped loadout.
- Undo and redo cover prompt text, roles, cards, tracks, resets, examples, and
  imported sessions. Keep the controls compact and support standard shortcuts.
- Show a quiet local-save status beside the builder title. Storage failure is
  stated plainly and never blocks prompt building.
- One Continue action moves to the next unfinished C.R.A.F.T. section, wrapping
  when needed. Once complete, it opens the live output.
- A compact Auto C.R.A.F.T. archetype rail may sit to the left of the guided
  workspace. Archetypes are JSON-defined presets that fill roles, action cards,
  format settings, modifier cards, and tuning tracks while preserving the
  user's Context and Target writing fields.
- The output dock shows word, estimated-token, and character counts without
  competing with the prompt itself.
- Builder sessions can be exported and imported as local JSON files containing
  the draft and card-system state. Do not introduce cloud or sync language.

Tactic and Modifier Cards may belong to a Card Lineage. Moving a relevant
Tuning Track can morph a card into another named Card Grade with updated
description and prompt language. The grades must remain recognizable as one
underlying idea through a stable lineage marker and visual motif. Grades
represent meaningful modes or intensity, not collectible rarity. Role Cards do
not morph.

Each Tuning Track controls a Category Deck as a coordinated grading matrix.
Card Lineages that remain relevant keep the same deck position and morph in
place. Irrelevant unequipped cards leave the deck, and newly relevant cards
enter the available positions.

Render every Card Lineage compatible with the current track combination.
Slot Budgets limit the loadout only; they never limit the number of available
cards shown in the Category Deck.

Each card-driven section includes visible Card Slots. Dragging a card into a
compatible slot is the primary spatial interaction, with click and keyboard
actions providing complete parity. Dropping or activating a card equips it and
adds its instruction to the generated prompt.

Within each card-driven section, place the controls in this order:

1. Equipped Card Slots.
2. Category Deck.
3. Tuning Tracks.
4. Optional freeform text for requirements the cards do not cover.

Card ability details are contextual overlays attached to the active card rather
than a persistent section in the workbench layout.

Filters and Tuning Tracks sit below the cards they affect. Role category tabs
and Format output-type controls use the same compact filter-bar language so
they cannot be mistaken for selectable prompt cards.

The fixed Slot Budgets are:

- Context: three Modifier Card slots.
- Role: three Role Card slots.
- Action: five ordered Tactic Card slots.
- Format: three Modifier Card slots.
- Target Audience: three Modifier Card slots.

Slots may remain empty. Action order is prompt order; the other sections use
slot order to communicate priority.

The initial Tuning Track map is:

- Context: Context Depth and Evidence Rigor.
- Role: no Tuning Tracks.
- Action: Autonomy, Practicality, and Challenge.
- Format: Output Detail and Structure.
- Target Audience: Audience Expertise and Voice Formality.

Creativity is expressed through Tactic and Modifier Card Lineages rather than a
permanent Tuning Track. Expressive qualities such as direct, reassuring,
persuasive, or playful are Voice Card lineages; Voice Formality is the
directional track from conversational to formal.

If a Snap Point makes an equipped card invalid, unequip it from the current
slot. Preserve the arrangement in Snap Memory so returning to that Snap Point
restores the previous compatible cards. Briefly emphasize the nearest
Compatible Card as a replacement suggestion, but never equip it automatically.
Use no more than three quick scale or glow pulses, then settle into a static
suggested state. Under reduced motion, skip the pulses and use only the static
state.

Snap Memory is section-scoped and keyed by the exact combination of that
section's active Tuning Track positions. Store only a bounded set of recent
configurations locally; do not attempt to merge independent per-track memories.

- The builder is a guided horizontal workspace. An introductory C.R.A.F.T.
  panel leads into the five main C.R.A.F.T. steps while allowing Context and
  Target Audience to split into two internal subpages: Write first, Cards
  second.
- The C/R/A/F/T step rail stays visible above the workspace. Clicking a step or
  using Back, Start, and Next moves the track left or right with a short
  transform-only transition.
- Context Write and Target Write are required brief screens. Their copy should
  make it clear that modifier cards come next to tune the rules, not replace
  the user's written details.
- Context Cards and Target Cards use the same card workbench alignment as Role,
  Action, and Format. Their modifier cards are optional and do not determine
  section completion by themselves.
- Each panel owns the full available canvas and scrolls vertically within that
  canvas when its card deck is taller than the viewport.
- Context, Role, Action, Format, and Target Audience remain five distinct CRAFT
  cards. The methodology explainer uses the same card silhouette.
- Role categories behave as keyboard-accessible tabs and wrap into stacked rows.
  Role categories and role cards never require horizontal scrolling.
- Role cards use compact portrait proportions, a category code, a role name,
  and an equipped state.
- A role loadout accepts up to three ordered selections: one lead role and two
  supporting roles. The lead role controls the primary judgment; supporting
  roles supplement it without flattening all perspectives together.
- Role is completely slider-free. Its meaning comes from the selected Role
  Cards, their order in the loadout, and their written abilities. Do not add
  Role Specificity, Role Blend, strength, or weighting sliders.
- Hovering or focusing a role previews its ability in a side inspection panel
  anchored beside the active card. Clicking adds or removes it from the loadout.
- Selected roles offer grouped action cards that can be combined in the Action
  card.
- Format and audience cards offer optional multi-select modifier cards that can
  be toggled into their text fields.
- Context, Action, Format, and Target Audience may use Tuning Tracks. These are
  discrete sliders with three to five labeled Snap Points, not continuous
  numeric ranges. Use fewer points when adjacent states would not produce a
  clearly understandable difference.
- A track's semantic positions remain stable so behavior is predictable, but
  its displayed vocabulary may adapt to the active category or output type.
  Always retain a short invariant axis label or level marker so the user can
  understand that the underlying control has not changed.
- The equipped base Format Card is the Vocabulary Driver for all Tuning Tracks.
  Changing it may rename Snap Points and morph compatible cards across other
  sections without changing their underlying levels. Use neutral vocabulary
  until a base Format Card is equipped; do not add a separate project-type
  selector.
- Format decks must include plain utility cards for users who do not yet know
  what structure they need. Keep basic options such as Information Card, Key
  Points, and FAQ available before specialized report, table, citation, or
  handoff cards.
- The introductory panel may offer an optional Output Type Card before the user
  starts Context. This is the base Format Card surfaced early for calibration,
  not a sixth C.R.A.F.T. section. The full Format panel remains where the user
  changes the base card, tunes Output Detail and Structure, and equips Format
  Modifier Cards.
- Equipping an Output Type Card applies visible Recommended Defaults to the
  Tuning Tracks. A track becomes an explicit Track Override once the user moves
  it. Recommended Defaults are presets, not hidden automation.
- Changing the Output Type preserves existing Track Overrides. Offer an
  explicit "Apply recommended setup" action to replace those overrides with
  the new Output Type's complete Recommended Setup; never reset them silently.
- Moving a Tuning Track updates the generated prompt language and reorders or
  reveals Recommended Cards. It never equips, removes, or replaces a card
  automatically. An equipped card that no longer aligns remains selected and
  may show a plain-language alignment warning.
- The live prompt output is a separate right-edge dock, modeled after a code or
  JSON viewer. It can collapse to a narrow status rail or expand into a fixed
  viewer without becoming another column in the form layout. At narrower
  widths it overlays the workspace with a dismissible backdrop.
- A Proof Lab utility may load controlled verification scenarios for the card
  system. Keep it outside the primary C.R.A.F.T. flow in a compact drawer.
  Loading a proof replaces the current draft, jumps to the relevant panel, and
  exposes a dismissible checklist describing the behavior to verify.
- Cyan remains the selected and focus color. The game reference changes
  structure and interaction, not the established Digi Tools palette.

## Motion

Motion communicates state. Keep common transitions between 150ms and 200ms;
the card drop settle may run up to 240ms. Use opacity or transform only and
provide a reduced-motion fallback. Do not add page-load choreography.

## Voice

Copy is direct and specific. Explain what the tool does, where the data lives,
and what an action produces. Avoid inflated claims, vague superlatives, and
generic AI product language.

## Anti-goals

- No AI-purple gradients or gradient text
- No glassmorphism
- No identical feature-card grid
- No decorative scroll effects
- No oversized rounded containers
- No fake metrics, customer logos, or testimonials
- No account, team, cloud, or sync language
