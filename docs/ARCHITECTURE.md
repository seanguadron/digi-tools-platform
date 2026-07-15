<!-- gov:node id=architecture kind=doc title="ARCHITECTURE.md (the app framework contract)" reads=docs/DESIGN_DIRECTION.md -->

# Architecture — the DigiTools core framework

What the app IS, structurally: the shared shell every tool lives in, the
contract a tool signs to join it, and the primitives it recycles instead of
reinventing. Read this BEFORE building or substantially changing a tool.
STANDARDS §1.4 makes conformance to this contract a gated rule; the visual
language for everything named here is `docs/DESIGN_DIRECTION.md`.

## 1. System shape

Next.js App Router, fully client-side: no backend, no accounts, no cloud
sync. State lives in `localStorage`; files enter and leave via the browser
(`src/lib/browser-download.ts`, file inputs). Every tool is:

- a **registry entry** in `src/lib/tool-registry.ts` (`ToolDescriptor`:
  `id`, `name`, `shortName`, `tagline`, `href`, `fullBleed?`),
- a **route** at `src/app/tools/<id>/page.tsx` — a thin server component
  rendering one `"use client"` component from `src/components/`,
- an optional **catalog** under `src/data/<tool>/` validated by a script +
  schema in the same change (STANDARDS §2.1).

The registry drives the shell's top-bar tabs and the home page's titles,
taglines, and CTAs automatically. The home page's per-tool marketing
sections (`src/app/page.tsx`) are hand-written — a new tool adds one.

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

A tool's header is injected with a render-time, SSR-guarded portal — use the
shared **`<ToolSubbar>`** (`src/components/tool-subbar.tsx`), which owns all
of this:

- The portal target is `document.getElementById("app-subbar-slot")`; during
  SSR it renders `null`. **No effect/mounted gate** — deferring the portal
  blanks the bar for a frame.
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

## 3. What the shell does NOT provide — and what to recycle

Left tool strips, right docks/inspectors, canvases, panels: **tool-owned**,
built inside the full-bleed stage. Each existing tool has its own 3-column
grid (`.builder-main-layout`, `.architect-layout`, `.image-editor-layout`).
Do not expect a shell rail; DO recycle these primitives:

| Primitive | File | Use it for |
|---|---|---|
| `ToolSubbar` + parts | `src/components/tool-subbar.tsx` | The context-bar header (§2). |
| `formatSaveStatusLabel`, `SaveStatus` | `src/lib/save-status.ts` | Autosave chip labels ("Saved 2:41 PM…"). |
| `useUndoableState` | `src/hooks/use-undoable-state.ts` | Undo/redo: past/future stacks, tag coalescing, `seal`, `jump`, `depth`/`position` for history panels. |
| `useLocalDraft` | `src/hooks/use-local-draft.ts` | Debounced, quota-guarded localStorage autosave with restore-on-mount lifecycle. |
| `EditorMenubar` | `src/components/editor-menubar.tsx` | App-style menu bar inside a sub-bar (File/Edit/…, roving focus, submenus). |
| `EditorTabs` + `tabPanelProps` | `src/components/editor-tabs.tsx` | Accessible roving-tabindex tablists (right-dock tabs). |
| `createZip`, `textZipEntry` | `src/lib/zip.ts` | Dependency-free layered/archive exports. |
| `downloadBlob` etc. | `src/lib/browser-download.ts` | All file downloads. |
| `readStored`, `writeStored` | `src/lib/prompt-storage.ts` | SSR-safe JSON localStorage access (see §6 landmine). |
| Output docks | `prompt-output-dock.tsx`, `architect-output-dock.tsx` | Two parallel copy/download artifact panels — pick one as your base; unifying them is sanctioned backlog. |

Known single-owner caveat: `EditorMenubar`/`EditorTabs`/`zip.ts` currently
have one importer each (Image Editor) — generalize class names as you adopt
them. `CopyButton` (`copy-button.tsx`) hardcodes the `skill-copy` class.

## 4. Adding a tool, end to end

1. **Registry**: add the `ToolDescriptor` to `src/lib/tool-registry.ts`
   (extends the `ToolId` union — this is the only compile-time guard).
   Decide `fullBleed` intentionally: `true` for cockpit tools, `false` for
   document-style pages (Skills is the simple template).
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
banners) → Image Editor. New tool sections append at the end with a banner.

## 6. Persistence conventions

- Keys: `digitools.<tool>.<thing>-v1`, plus a sibling `...saved-at` key.
- The theme key is `digitools.theme` (set pre-hydration by an inline script
  in `layout.tsx`).
- **Landmine — two saved-at byte formats coexist**: Architect stores its
  saved-at JSON-encoded (quoted) via `writeStored`; Prompt Builder and Image
  Editor store raw ISO strings via direct `setItem`. Do NOT unify existing
  keys — you'd orphan users' timestamps. New tools: use `useLocalDraft` and
  its documented format.
- Every localStorage READ of externally-influenced data is a trust boundary:
  validate shape before use, never bare-cast (STANDARDS §2.3).
