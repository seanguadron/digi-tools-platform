<!-- gov:node id=architecture kind=doc title="ARCHITECTURE.md (the app framework contract)" reads=docs/DESIGN_DIRECTION.md -->

# Architecture — the DigiTools core framework

What the app IS, structurally: the shared shell every tool lives in, the
contract a tool signs to join it, and the primitives it recycles instead of
reinventing. Read this BEFORE building or substantially changing a tool.
STANDARDS §1.4 makes conformance to this contract a gated rule; the visual
language for everything named here is `docs/DESIGN_DIRECTION.md`.

## 1. System shape

Next.js App Router. Every shipped tool is client-side: no accounts, no cloud
sync, no server. State lives in `localStorage`; files enter and leave via the
browser (`src/lib/browser-download.ts`, file inputs). Every tool is:

- a **registry entry** in `src/lib/tool-registry.ts` (`ToolDescriptor`:
  `id`, `name`, `shortName`, `tagline`, `href`, `fullBleed?`,
  `mobileSupport?` + `mobileGateNotes?` — see the mobile gate, §2),
- a **route** at `src/app/tools/<id>/page.tsx` — a thin server component
  rendering one `"use client"` component from `src/components/`,
- an optional **catalog** under `src/data/<tool>/` validated by a script +
  schema in the same change (STANDARDS §2.1).

The registry drives the shell's top-bar tabs and the home page's titles,
taglines, and CTAs automatically. The home page's per-tool marketing
sections (`src/app/page.tsx`) are hand-written — a new tool adds one.

### The one server surface: the Card Studio

There is exactly one exception to "no server", and it is an authoring
surface, not a tool. `/studio/cards` and its route handler
`src/app/api/card-art/route.ts` edit the card catalogs and write generated
card art to disk, so the owner does not rename, convert, and move 226 files
by hand or hand-edit JSON to fix a typo. It is **not** in the tool registry:
no nav tab, no home card, nothing links to it.

Each card opens with one tab per facet: **Card** (what the card is —
universal, the same in every world) and one per art pack (**Sci-Fi** with
generated art; **Fantasy** and **Superhero** fully authored — 226 briefs
each, 98 with bios — awaiting generation).

What keeps it safe, and what a reviewer should check:

- **Development only, and local only.** Both the page and the handlers bail on
  `process.env.NODE_ENV === "production"`, and the handlers additionally
  require a loopback `Host` — `next dev` binds every interface and
  `allowedDevOrigins` does not gate application routes, so the tools staying
  LAN-previewable must not drag the writer along with them. A raw client can
  forge a Host header, so treat that as narrowing, not sealing.
  `check:security` **S4** fails the build if any route handler under
  `src/app` loses the production guard — checked per handler, and accepting a
  call to a local helper that carries the check.
- **Keys, never paths.** A caller names an entry (`roles.researcher`). Every
  directory and filename is derived server-side by `scripts/art-pack.mjs`
  from the pack id plus that key, and `scripts/card-art-store.mjs` asserts
  each resolved path sits lexically inside its own root. There is no
  client-supplied path anywhere. (Lexical, not `realpath` — a symlink planted
  inside the working tree would still be followed, which presupposes an
  attacker who can already write to the repo.)
- **It makes `src/data` runtime-mutable**, which the trust model otherwise
  forbids. Three writes, each narrow:
  - **status**, in the art pack: selecting an image flips one entry to
    `"generated"` (and back to `"planned"` on "Remove from card"), then
    re-renders the pack's generated doc so a committed doc cannot drift.
  - **bio**, in the art pack: one string, length-capped to the schema's own
    ceiling.
  - **card text**, in a catalog: only the fields in `scripts/card-record.mjs`'s
    closed table are writable — names, descriptions, abilities, goals, grade
    lines, effects, audience. Ids, codes, sections, drivers, affinities,
    track values and equipped cards are readable and never writable, because
    other records reference them.
- **A card edit cannot break the build.** A save builds a *candidate* catalog
  and runs `validateCatalog` — the same function `npm run build` runs — over
  it, writing only if it passes. A rejected save returns the validator's own
  message. That check is deliberately the real one rather than a second,
  weaker copy, and `validateCatalog` is kept a pure function of the catalog
  it is handed so it can be used this way.

The logic lives in `scripts/card-art-store.mjs` rather than the route so the
node runner can test it directly (`scripts/card-art-store.test.mjs`); the
route is a thin HTTP shell. Two working trees: `card-art-source/` holds the
committed candidates and crops and is never built, while `public/card-art/`
holds only the one live webp per card that the app renders.

### Art packs: what a card looks like, per world

A card is two things, kept in two files:

- **the card** — universal, in `src/data/prompt-builder/*.json`: id, name,
  description, mechanics. Strategist is Strategist in every world.
- **the pack** — per world, in `src/data/prompt-builder/art-themes/<id>.json`:
  the image brief, its alt text, the character **bio**, and whether that
  image exists yet.

A pack stores **no path**. `scripts/art-pack.mjs` derives every path from the
pack id plus the entry key, which is what makes a second world a drop-in:
no file moves, no collisions, an honest per-pack `status`, and no way for
renaming a card in the studio to orphan its art. `src/lib/art-pack.ts` is the
app's typed door onto the active pack; the deck engine takes optional
`cardArt`/`cardBio` callbacks so the CRAFT deck resolves through its pack
while the PICTURE deck keeps its inline illustrations.

A pack whose `theme.draft` is true is skipped by the generator and the
coverage check, so scaffolding a world cannot fail the build. Clearing that
flag is the moment it has to be complete.

## 2. The shell contract

`src/components/app-shell.tsx` (wrapped around every page by
`src/app/layout.tsx`) owns **three horizontal bars and the stage**. It does
NOT own left or right rails — see §3.

| Region | Element | Plug-in mechanism |
|---|---|---|
| Top bar | `header.top-bar` (`data-component="Bar:Top"`) | Registry-driven only: brand, one `.tool-tab` per registry entry, theme toggle. A tool never touches it. |
| Context bar | `div.context-bar` (`Bar:Context`) | Shows `.context-default` ("Tools / <name>") until a tool portals its header into **`#app-subbar-slot`**. |
| Page stage | `main.page-stage` | Route children. Registry `fullBleed: true` adds `.is-fluid` (escapes the centered column for cockpit-style tools). |
| Status bar | `footer.status-bar` (`Bar:Status`) | Shows `.status-default` ("Ready · No account…") until a tool portals live status into **`#app-statusbar-slot`**. |

Chrome heights are CSS variables in `src/app/globals.css:22-29`
(`--top-bar-height`, `--context-bar-height`, `--status-bar-height`,
`--app-chrome-height`, `--app-top-chrome-height`) — full-bleed tools size
their layouts against these, never hardcoded pixels.

### The sub-bar handshake (exact, load-bearing)

A tool's header is injected with a portal — use the shared **`<ToolSubbar>`**
(`src/components/tool-subbar.tsx`), which owns all of this:

- The portal target is `#app-subbar-slot`, resolved through
  **`usePortalTarget`** (§3), NEVER read from the DOM during render. The
  server snapshot is `null`, so the hydration render matches the server; the
  portal mounts before paint, so the bar still never blanks.
- **Never write `typeof document === "undefined" ? null : document.body` (or
  `getElementById`) during render for a portal that renders on FIRST
  render** — use `usePortalTarget` (§3). The render-time read makes the
  server render `null` and the client render a portal. When that portal puts
  REAL DOM into a container React is hydrating, the container's children stop
  matching the server and React's only recovery at the root is to discard the
  server HTML and client-render the document. It then re-acquires the
  `<html>` singleton, wiping its attributes and reapplying `layout.tsx`'s
  props — which silently undid the no-flash theme bootstrap on all three tool
  routes until 2026-07-17, with no console error, and cost them their SSR.
- The hazard is the inserted DOM, not the portal: a portal whose children
  render to nothing (an `open`-gated dialog, an idle dnd-kit `DragOverlay`)
  adds no nodes and is inert. Don't rely on that — route every first-render
  portal through the hook, because the day those children stop being null the
  breakage is silent.
- **One deliberate carve-out:** `EditorDialog` (and dialogs built on it)
  returns `null` until `open` is true, and every consumer initializes
  `open` to `false` — it never portals on first render, so it may target
  `document.body` directly. A dialog that is ever open-by-default loses the
  exemption and must go through `usePortalTarget`.
- The portaled root must be `div.prompt-subbar` (plus one per-tool modifier
  class, e.g. `image-editor-subbar`) with `data-component="Header:Tool"`,
  and **no wrapper element** around it — the slot is `display: contents`
  (`globals.css`), so the root participates directly in the context-bar
  flex.
- The shell hides its default text via
  `.context-bar:has(.prompt-subbar) .context-default` — the class name IS
  the handshake. Same pattern for the status bar
  (`.status-bar:has(...) .status-default`).

`ToolSubbar` children compose from `ToolSubbarTitle` (kicker + h1 + status
chip), `ToolSaveStateChip` (autosave state), and `ToolSubbarActions` (the
right-side action cluster), with arbitrary children between them (menus,
pickers).

### The mobile gate (registry-driven)

A registry entry with `mobileSupport: "gated"` keeps its cockpit off phone
screens. Below 768px the shell carries `.is-mobile-gated`, which hides the
stage content and any portaled sub-bar/status-bar chrome and shows
`src/components/mobile-tool-gate.tsx` instead (name, tagline,
`mobileGateNotes`, a "Preview anyway" override). The override is
session-scoped — `digitools.mobile-preview.<id>` in sessionStorage via
`src/hooks/use-mobile-preview.ts` — and flips the shell to
`.is-mobile-preview`: the tool renders normally, prefixed by a squeeze-in
notice chip. Both classes are INERT at 768px and above: the media query in
`globals.css` is the only judge of "phone", so SSR output and desktop
rendering are identical with or without them. Cockpit tools gate;
document-style pages (Skills) stay full. Decide per tool in the registry —
the shell and CSS need no changes for a new gated tool.

Two load-bearing details: the phone threshold lives in ONE place
(`PHONE_MEDIA_QUERY` in `tool-registry.ts`, byte-identical to the CSS media
query) so a width can never be gated while a tool's own layout still thinks
it is on a desktop; and the gate section re-enables document scrolling,
because the full-bleed lock (`html:has(.page-stage.is-fluid) { overflow:
hidden }`) is written for the fixed-height desktop cockpit and would
otherwise strand the gate's buttons below the fold on a short screen.

## 3. What the shell does NOT provide — and what to recycle

Left tool strips, right docks/inspectors, canvases, panels: **tool-owned**,
built inside the full-bleed stage. Each existing tool has its own 3-column
grid (`.builder-main-layout`, `.architect-layout`, `.image-editor-layout`).
Do not expect a shell rail; DO recycle these primitives:

| Primitive | File | Use it for |
|---|---|---|
| `ToolSubbar` + parts | `src/components/tool-subbar.tsx` | The context-bar header (§2). |
| `usePortalTarget` | `src/hooks/use-portal-target.ts` | ANY portal that renders on first render — resolves `document.body` or a slot id without breaking hydration (§2). |
| `formatSaveStatusLabel`, `SaveStatus` | `src/lib/save-status.ts` | Autosave chip labels ("Saved 2:41 PM…"). |
| `useUndoableState` | `src/hooks/use-undoable-state.ts` | Undo/redo: past/future stacks, tag coalescing, `seal`, `jump`, `depth`/`position` for history panels. |
| `useLocalDraft` | `src/hooks/use-local-draft.ts` | Debounced, quota-guarded localStorage autosave with restore-on-mount lifecycle. |
| `EditorMenubar` | `src/components/editor-menubar.tsx` | App-style menu bar inside a sub-bar (File/Edit/…, roving focus, submenus). |
| `EditorTabs` + `tabPanelProps` | `src/components/editor-tabs.tsx` | Accessible roving-tabindex tablists (right-dock tabs). |
| `createZip`, `textZipEntry` | `src/lib/zip.ts` | Dependency-free layered/archive exports. |
| `downloadBlob` etc. | `src/lib/browser-download.ts` | All file downloads. |
| `readStored`, `writeStored` | `src/lib/prompt-storage.ts` | SSR-safe JSON localStorage access (see §6 landmine). |
| `useMediaQuery` | `src/hooks/use-media-query.ts` | Live matchMedia state, SSR-safe (`useSyncExternalStore`; the lint rules reject effect-driven setState). |
| Output docks | `prompt-output-dock.tsx`, `architect-output-dock.tsx` | Two parallel copy/download artifact panels — pick one as your base; unifying them is sanctioned backlog. |

Known single-owner caveat: `zip.ts` currently has one importer (Image
Editor) — generalize class names as you adopt it. `EditorTabs` and
`EditorMenubar` each have two (Image Editor + Vector Editor), a good
precedent for reusing them. The Vector Editor is also the first native-SVG tool: its scene
graph renders as real SVG elements, so edit and export are the same artifact
(`src/lib/vector-editor/`). `CopyButton` (`copy-button.tsx`) hardcodes the
`skill-copy` class.

## 4. Adding a tool, end to end

1. **Registry**: add the `ToolDescriptor` to `src/lib/tool-registry.ts`
   (extends the `ToolId` union — this is the only compile-time guard).
   Decide `fullBleed` intentionally: `true` for cockpit tools, `false` for
   document-style pages (Skills is the simple template). Decide
   `mobileSupport` the same way: cockpits gate (`"gated"` +
   `mobileGateNotes`), document pages don't (§2, the mobile gate).
2. **Route**: `src/app/tools/<id>/page.tsx` (server component, metadata) →
   renders `src/components/<id>.tsx` (`"use client"`).
3. **Header**: portal via `<ToolSubbar className="<id>-subbar">` (§2).
   Optional live status → `#app-statusbar-slot` (Image Editor is the
   precedent).
4. **State**: `useLocalDraft` for persistence (keys
   `digitools.<id>.<thing>-v1`), `useUndoableState` for history,
   `SaveStatus` for the chip.
5. **Home page**: add the tool's section to `src/app/page.tsx` (kicker
   `Tool 0N · <shortName>`, bullets, spec preview — hand-written).
6. **Styles**: append a banner-delimited section to `src/app/globals.css`
   (`/* ===== <Tool name> ===== */`), classes prefixed `<id>-`. Reuse the
   shared form/button/card vocabulary (§5) before writing new primitives.
7. **Data**: any catalog under `src/data/` ships WITH its validator/schema
   wiring and test-count updates (STANDARDS §2.1).
8. **Gates**: Integration (§1.1 registration + §1.4 shell contract) and
   Design are owed; Security too if you touch import/export, localStorage,
   downloads, or rendering paths (Rules 18–20). Reports → the gate ledger.
9. **Checks**: `npm run typecheck · lint · test · data:validate ·
   check:standards · check:security`; verify rendered UI in the running dev
   server (port 5100 — never start a second; headless-preview quirks are in
   STATE.md's runbook).

## 5. globals.css zones

One file, zone-ordered: tokens (`:root`, ~1–54) → shell chrome (~56–376) →
Welcome → **Skills + the SHARED form/button/card primitives interleaved**
(~543–2418: `.tool-kicker`, `.button`, `.field`, inputs — check here before
adding a primitive) → Prompt Builder → Architect (`/* ===== ... ===== */`
banners) → Image Editor → Mobile tool gate (the phone-width §2 rules; last
because its overrides must beat the shell and tool rules on source order).
New tool sections append before that trailing zone, with a banner.

## 6. Persistence conventions

- Keys: `digitools.<tool>.<thing>-v1`, plus a sibling `...saved-at` key.
- The theme key is `digitools.theme` (read pre-paint by the bootstrap in
  `src/components/theme-script.tsx`, injected into the streamed `<head>` via
  `useServerInsertedHTML`; the toggle in `app-shell.tsx` writes it).
- **Landmine — two saved-at byte formats coexist**: Architect stores its
  saved-at JSON-encoded (quoted) via `writeStored`; Prompt Builder and Image
  Editor store raw ISO strings via direct `setItem`. Do NOT unify existing
  keys — you'd orphan users' timestamps. New tools: use `useLocalDraft` and
  its documented format.
- Every localStorage READ of externally-influenced data is a trust boundary:
  validate shape before use, never bare-cast (STANDARDS §2.3).
