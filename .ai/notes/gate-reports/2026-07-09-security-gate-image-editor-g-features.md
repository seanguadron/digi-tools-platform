---
gate: security
date: 2026-07-09
surface: Image Editor — second 12-feature batch "G-features"; focus on project-io.ts (new persisted locked/clipped fields) and the in-memory bitmap ops (clone, smudge, levels/posterize/threshold, selection combine/feather/grow/shrink/stroke, history panel, grid/guides)
result: pass
findings: 0 High / 0 Medium; 1 Low (perf hardening, fixed)
---

# Security gate — Image Editor G-features batch

The `security-gate` agent ran fully against the uncommitted diff, focused on the
one trust-boundary touch. `check:security` deterministic half green.

## The trust-boundary change: `project-io.ts` `locked`/`clipped`

**Verified clean — this is the pattern to imitate, not the anti-pattern.**
`src/lib/image-editor/project-io.ts` deserializes the two new per-layer booleans
as `locked: layer.locked === true` / `clipped: layer.clipped === true` — strict
`=== true` on a value read from `Record<string, unknown>`, never dereferenced,
never spread from the untrusted `entry`. Any non-`true` value (string, number,
object, missing) coerces to `false`. The surrounding ingest guards are untouched:
`version !== 1` gate, `isPositiveInt` + `MAX_DOC_DIMENSION`/`MAX_DOC_PIXELS`,
`MAX_DOC_LAYERS`/`MAX_TOTAL_PIXELS`, the `data:image/(png|jpeg|webp);base64,`
prefix gate, and `deserializeDoc` still returns `null` on any structural problem.
`prompt-session.ts`/`prompt-storage.ts` (the known latent cast-without-validate)
are **not** touched by this diff.

## Rest of the batch

All new code operates on already-in-memory, already-bounded bitmaps: clone/smudge
scratch canvases are ≤ the (pre-capped) brush size; levels/posterize/threshold are
per-pixel math over `ImageData` driven by range inputs (never serialized);
selection combine/feather/grow/shrink/stroke allocate canvases sized to the bounded
`doc.width/height`; the history panel renders only templated strings via JSX text
nodes (no `dangerouslySetInnerHTML`); grid/guides are client-only numeric state,
never persisted. Repo-wide diff grep for injection/network/storage sinks: zero hits.

## The one Low (fixed)

**`composite()` allocated a fresh full-doc scratch canvas per clipped layer per
frame** (on the ~60fps stroke hot path). Not a vulnerability (bounded by the
user's own layer count), but wasteful. **Fixed:** hoisted one reusable scratch
canvas per `composite()` call, `clearRect`-and-reused across clipped layers.
