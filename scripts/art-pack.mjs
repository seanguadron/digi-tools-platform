// Art packs: where a card's LOOK lives, separately from what a card DOES.
//
// A card is two things. The catalog owns the universal half - id, name,
// description, mechanics - and that is the same in every world. An art pack
// owns the per-world half: the image, the character bio, and whether that
// image exists yet. Swap packs and the deck keeps its rules but changes its
// skin, which is the whole point of having more than one.
//
// The rule that makes packs work is that a pack NEVER stores an image path.
// Every path is derived here from the pack id plus the entry key, so:
//
//   - a second pack needs no file moves and can never collide with the first
//   - `status: "generated"` is a per-pack fact, not a global one
//   - renaming a card in the Card Studio cannot orphan its art, because no
//     editable text appears anywhere in the path
//
// This module is deliberately dependency-free - no node built-ins, no JSON
// imports - because it is loaded three ways: by plain `node` in the data
// scripts, by the Next.js server in the studio's write endpoint, and by the
// browser through `src/lib/art-pack.ts`. Keep it pure.

// Every group a pack can carry, in the order a reader meets them.
export const ART_PACK_GROUPS = [
  "craft",
  "roles",
  "lineages",
  "archetypes",
  "grades",
  "shared",
];

// Ids come from catalog data and, in the studio, from an HTTP caller echoing a
// key back. `assertInside` in the store is the real containment guarantee;
// this is the layer that refuses to build a suspect path in the first place.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CRAFT_LETTER_PATTERN = /^[A-Z]$/;

export class ArtPackKeyError extends Error {}

function fail(key, reason) {
  throw new ArtPackKeyError(`Invalid art pack key "${key}": ${reason}`);
}

// "grades.context-scope[2]" -> { group: "grades", id: "context-scope", index: 2 }
export function parseArtKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    fail(String(key), "not a string");
  }

  const dot = key.indexOf(".");
  if (dot < 1) {
    fail(key, "expected <group>.<id>");
  }

  const group = key.slice(0, dot);
  if (!ART_PACK_GROUPS.includes(group)) {
    fail(key, `unknown group "${group}"`);
  }

  const rest = key.slice(dot + 1);

  if (group === "grades") {
    const match = /^(.+)\[(\d+)\]$/.exec(rest);
    if (!match) {
      fail(key, "expected grades.<lineage>[<index>]");
    }
    if (!ID_PATTERN.test(match[1])) {
      fail(key, "lineage id must be kebab-case");
    }
    return { group, id: match[1], index: Number(match[2]) };
  }

  if (group === "craft") {
    if (!CRAFT_LETTER_PATTERN.test(rest)) {
      fail(key, "expected a single uppercase acronym letter");
    }
    return { group, id: rest, index: null };
  }

  if (!ID_PATTERN.test(rest)) {
    fail(key, "id must be kebab-case");
  }
  return { group, id: rest, index: null };
}

export function artKeyFor(group, id, index) {
  return group === "grades" ? `${group}.${id}[${index}]` : `${group}.${id}`;
}

// The one place a card-art path is decided. Everything downstream - the live
// webp under public/, the source variants under card-art-source/, the target
// printed in the generated art doc - reads it from here.
export function artPathFor(packId, key) {
  if (!ID_PATTERN.test(packId)) {
    throw new ArtPackKeyError(`Invalid art pack id "${packId}"`);
  }

  const { group, id, index } = parseArtKey(key);
  const root = `/card-art/${packId}`;

  switch (group) {
    case "craft":
      return `${root}/craft/letter-${id.toLowerCase()}.webp`;
    case "roles":
      return `${root}/roles/${id}.webp`;
    // A lineage and its grades share a folder: they are the same card at
    // different intensities, and the studio lists them together.
    case "lineages":
      return `${root}/cards/${id}/lineage.webp`;
    case "grades":
      return `${root}/cards/${id}/grade-${String(index + 1).padStart(2, "0")}.webp`;
    case "archetypes":
      return `${root}/archetypes/${id}.webp`;
    // Not a card - swatches the UI itself draws, like the custom-preset face.
    // Their own folder so they can never collide with a real card's id.
    default:
      return `${root}/shared/${id}.webp`;
  }
}

// The path relative to a pack's own root, e.g. "cards/context-scope/lineage".
// The studio keeps its working files (candidates, crops) under this, so the
// source tree mirrors public/ exactly.
export function artRelativePath(packId, key) {
  return artPathFor(packId, key)
    .slice(`/card-art/${packId}/`.length)
    .replace(/\.webp$/, "");
}

// An entry as authored in a pack file. `bio` is the card's short character
// blurb and is optional: grades are intensities of a card rather than
// characters of their own, and a pack in progress may not have written one yet.
export function isArtPackEntry(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof entry.prompt === "string" &&
    typeof entry.alt === "string" &&
    (entry.status === "planned" || entry.status === "generated") &&
    (entry.bio === undefined || typeof entry.bio === "string")
  );
}

// Reading a single entry out of a loaded pack, by key. Returns undefined
// rather than throwing when the pack has no such entry, so a half-authored
// pack renders placeholders instead of crashing a route.
export function artPackEntry(pack, key) {
  let parsed;
  try {
    parsed = parseArtKey(key);
  } catch {
    return undefined;
  }

  const group = pack?.[parsed.group];
  if (!group) {
    return undefined;
  }

  const raw = parsed.group === "grades" ? group[parsed.id]?.[parsed.index] : group[parsed.id];
  if (!isArtPackEntry(raw)) {
    return undefined;
  }

  return {
    key,
    src: artPathFor(pack.theme.id, key),
    alt: raw.alt,
    prompt: raw.prompt,
    bio: raw.bio,
    status: raw.status,
  };
}
