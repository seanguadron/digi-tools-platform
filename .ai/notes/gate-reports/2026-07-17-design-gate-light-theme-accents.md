---
gate: design
date: 2026-07-17
surface: Light-theme accent tokens — cyan/magenta text split, focus-ring contrast, Architect per-block accents (app-wide)
result: FAIL → PASS (2 High + 1 Low, all fixed and re-verified)
findings: 2 High, 1 Low — applied
---

# Design gate — light-theme accent colors

Audited against `docs/DESIGN_DIRECTION.md`. Context: the light theme was
effectively UNREACHABLE on the three cockpit routes until the same-day
portal/hydration fix, so its appearance there had never been examined. A
measured audit found ~247 AA failures in light, dominated by `--brand-cyan`
used as TEXT. This change lands the amendment the 2026-07-14 design gate had
proposed and that had sat in the consent queue since.

The gate independently re-derived every claimed ratio from the OKLCH values
(two methods: naive channel clamp and CSS-Color-4 gamut-mapped binary search)
and confirmed the text-split numbers. It then found two gaps the text sweep
structurally could not.

## Findings

| # | Sev | Finding | Fix applied |
|---|---|---|---|
| 1 | **High** | **Focus rings and active borders fail WCAG 1.4.11.** The sitewide `:focus-visible { outline: 2px solid var(--brand-cyan) }` plus ~30 `is-active`/`is-selected` border rules measured **1.5–1.9:1** against light surfaces, under the 3:1 non-text floor — the focus indicator was effectively invisible on light backgrounds. Worse, the DESIGN_DIRECTION text this change ADDED asserted these were "Unchanged" and satisfied. A doc claiming something measurably false. | Light-theme `--brand-cyan` retuned `oklch(0.78 0.16 200)` → `oklch(0.6 0.1 200)`: ring worst-case **3.16:1** (from 1.53), and dark ink still reads **5.0:1** on it as a fill. Dark theme untouched (9.54:1). The DESIGN_DIRECTION table now states the real reason instead of the false claim. |
| 2 | **High** | **`architect-canvas.tsx:106`** still set the raw per-block accent as an inline `color` — the tool's primary surface, every placed node — measuring **2.28–2.59:1**. Missed because the earlier fix only covered the palette glyph. My audit scored the route CLEAN because **an empty canvas has no nodes to measure**. | Now passes `--glyph-accent` like the palette; the `:root:not([data-theme="dark"])` darkening rule covers `.architect-node-type` too. Verified with 10 nodes on the canvas: labels compute `oklch(0.468 0.078 <hue>)`, each block's hue intact. |
| 3 | Low | `--on-brand-cyan` invented an `on-*` scheme where the file already uses `-foreground` for that exact job (`--primary-foreground`, `--card-foreground`, `--muted-foreground`). | Renamed to `--brand-cyan-foreground`. |

## Found while fixing (same class, only visible with content)

`.architect-readiness-chip.has-issues` used a HARDCODED `oklch(0.78 0.13 70)`
amber as text — 2.02:1 in light. It surfaced only once the canvas had nodes
and the chip read "24 to resolve". Now `--warning-text` (light
`oklch(0.52 0.12 70)`, 4.74:1; dark keeps the original). A sweep confirmed the
only other hardcoded text colors are correct by design: `#111111` on the
`#ffffff` print sheet, and dark ink on the amber count fill.

## Verification

Production build earlier; final pass on a clean dev build after
`npm run dev:clean`. 5 surfaces × {light, dark}, **including the Architect
with 10 nodes on the canvas**: **0 contrast failures, 0 theme failures**.
Focus-ring/non-text measured separately from text — they are different floors
(3:1 vs 4.5:1) and different measurements.

## Gate answers worth keeping

- Hue is faithfully preserved (H=200/340 in both new tokens). Magenta's text
  variant keeps the exact marker chroma. Cyan's authored text chroma (0.12)
  actually overshoots the sRGB gamut at L=0.48/H=200 (max ≈0.081), so the
  browser reduces it further than "0.16→0.12" implies — but the gate
  confirmed no in-gamut (L,C) at that hue both keeps materially more chroma
  and clears AA, so this is close to the only reasonable choice. It still
  reads as a dark teal/cyan, not a hue shift.
- No accent->10%-of-surface or hierarchy inversion found: every converted
  label also carries a mono/bold/caps/letter-spacing treatment, so hierarchy
  never rests on color alone.

## Amendments proposed (need the owner's consent)

1. **Split DESIGN_DIRECTION the way STATE/SESSIONS are split** (§3.5's
   snapshot-vs-history rule): the new subsection carries narrative ("~247
   elements", "when discovered") in a file whose register is otherwise
   timeless and prescriptive. Trim to the durable rule + table and let
   SESSIONS.md hold the story.
2. **Pre-existing, not introduced here:** `.skill-source`
   (`skills-wiki.tsx:93`) is an `<a>` using the accent hue with no underline
   until hover, sitting beside non-interactive labels in the same hue — a
   marker that reads as a link. Flagged for awareness.
