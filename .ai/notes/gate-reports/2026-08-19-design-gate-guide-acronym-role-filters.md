---
gate: design
date: 2026-08-19
surface: "CRAFT + PICTURE guide panels (acronym cards, style tier), CRAFT role browser filters"
result: FAIL -> fixed (1 owner-directed exception)
findings: 2 high / 3 medium / 3 low
---

# Design gate: guide acronym cards + role filters (2026-08-19)

Audited the stacked guide layout (title on top, acronym spelled below as one
row of art-faced cards, word capsules), the new Card style tier, and the role
browser's all-visible + filter-chip model, against DESIGN_DIRECTION.md.

## Findings and outcomes

| Sev | Finding | Outcome |
|---|---|---|
| High | Card style tier duplicates the dock's world switch with a second visual + ARIA pattern (illustrated radiogroup cards vs `.art-pack-switch` seg buttons) | **Owner-directed exception - kept.** The owner explicitly asked for illustrated world cards on the guide AND for the dock to stay ("we're keeping the interface"), to make the switch discoverable. Flagged for a DESIGN_DIRECTION amendment naming the two sanctioned world-switch surfaces. |
| High | `.craft-definition-word b` used `color: var(--background)` on the cyan fill - 3.48:1 in light theme, fails AA | Fixed: `--brand-cyan-foreground` (4.98:1 light / 12.35:1 dark) |
| Medium | `.output-type-setup` shrink-wrapped by the new `justify-items: center` guide layout | Fixed: `width: 100%` |
| Medium | "All roles" chip put the role COUNT in the slot where sibling chips show category codes | Fixed: `ALL` code token; the count already renders in "N shown" |
| Medium | 761-980px band stranded PICTURE's 7th acronym card (3+3+1) with empty tracks | Fixed: tier switched to `repeat(auto-fit, minmax(150px, 1fr))`. The gate's suggested `:last-child` full-span rescue was NOT used - a spanned card renders its square art face at full row width - and the two pre-existing span rescues (640px + flow-intro 760px tiers) were removed for the same reason. |
| Low | Word capsule could truncate "Illumination" at mid widths | Addressed by the 150px auto-fit floor (longest label + tile ~97px) |
| Low | Capsule border ~1.3:1 (matches sitewide hairline pattern) | Accepted - established pattern, not introduced here |
| Low | 12px card radius vs DESIGN_DIRECTION's generic "14px" line | Accepted - matches the deck's actual play-card family (12px); reconcile in an amendment |

Bonus pre-existing fix applied while in the file: `.role-category-tabs`
tablist `aria-labelledby` pointed at a nonexistent id; now `aria-label="Role
category filters"`.

PASSes worth keeping: definition cards reuse the play-card family grammar
exactly (inner hairline formula, hover lift); the filter chips' uniform grid
tracks are the correct fix for the stretched-chip complaint; reduced-motion
coverage is unconditional; `role-card-panel` aria-labelledby self-syncs with
the "all" index.

Not covered here: the draggable corner-snap nav dock (landed mid-audit) -
audited separately (see the dock gate report of the same date, if present,
else owed).

Battery after fixes: typecheck / lint / test 149 all green.
