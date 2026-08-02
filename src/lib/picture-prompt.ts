// The PICTURE Deck's merge: one flowing, comma-joined image prompt built from
// the subject line, the equipped cards' grade fragments, and an optional
// Midjourney parameter tail. The base line stays model-agnostic; the tail is
// appended only while it is enabled.
//
// Kept free of path aliases and JSON imports so the scripts/*.test.mjs runner
// can load it directly (same constraint as prompt-defaults.ts).

// Panel order — P.I.C.T.U.R.E.
export const PICTURE_SECTIONS = [
  "protagonist",
  "illumination",
  "canvas",
  "tone",
  "universe",
  "references",
  "execution",
] as const;

export type PictureSection = (typeof PICTURE_SECTIONS)[number];

// The order fragments join into the prompt line: subject detail first, then
// medium, world, light, color, influences, and framing/finish last — the
// anatomy Midjourney's own prompt guidance recommends. Reordering the merged
// line is a one-array edit.
export const PICTURE_MERGE_ORDER: readonly PictureSection[] = [
  "protagonist",
  "canvas",
  "universe",
  "illumination",
  "tone",
  "references",
  "execution",
];

export const PICTURE_INCOMPLETE_TEXT =
  "Name a subject to build your image prompt.";

const SECTION_HEADINGS: Record<PictureSection, { heading: string; label: string }> = {
  protagonist: { heading: "PROTAGONIST", label: "Protagonist" },
  illumination: { heading: "ILLUMINATION", label: "Illumination" },
  canvas: { heading: "CANVAS", label: "Canvas" },
  tone: { heading: "TONE", label: "Tone" },
  universe: { heading: "UNIVERSE", label: "Universe" },
  references: { heading: "REFERENCES", label: "References" },
  execution: { heading: "EXECUTION", label: "Execution" },
};

export type PictureTail = {
  enabled: boolean;
  aspectRatio: string;
  stylize: number | null;
  chaos: number | null;
  weird: number | null;
  negative: string;
};

export type PicturePromptSection = {
  key: PictureSection | "subject" | "tail";
  heading: string;
  label: string;
  body: string;
};

// Everything that lands in the one-line prompt goes through this: collapse
// newlines and doubled whitespace, trim, and drop trailing commas so joining
// with ", " can never double up.
function cleanFragment(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,+$/, "")
    .trim();
}

function cleanedSectionFragments(
  fragments: Record<PictureSection, readonly string[]>,
) {
  const seen = new Set<string>();
  const cleaned = {} as Record<PictureSection, string[]>;

  for (const section of PICTURE_SECTIONS) {
    cleaned[section] = (fragments[section] ?? [])
      .map(cleanFragment)
      .filter((fragment) => {
        if (!fragment) {
          return false;
        }
        const key = fragment.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  return cleaned;
}

const ASPECT_RATIO_PATTERN = /^\d+:\d+$/;

function tailNumber(flag: string, value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return `${flag} ${Math.round(value)}`;
}

export function buildTailString(tail: PictureTail): string {
  if (!tail.enabled) {
    return "";
  }

  const negative = cleanFragment(tail.negative);
  const parts = [
    ASPECT_RATIO_PATTERN.test(tail.aspectRatio)
      ? `--ar ${tail.aspectRatio}`
      : null,
    tailNumber("--stylize", tail.stylize),
    tailNumber("--chaos", tail.chaos),
    tailNumber("--weird", tail.weird),
    negative ? `--no ${negative}` : null,
  ];

  return parts.filter(Boolean).join(" ");
}

export function buildPicturePrompt(
  subject: string,
  fragments: Record<PictureSection, readonly string[]>,
  tail: PictureTail,
): string {
  const cleanSubject = cleanFragment(subject);
  if (!cleanSubject) {
    return PICTURE_INCOMPLETE_TEXT;
  }

  const cleaned = cleanedSectionFragments(fragments);
  const line = [
    cleanSubject,
    ...PICTURE_MERGE_ORDER.flatMap((section) => cleaned[section]),
  ].join(", ");
  const tailString = buildTailString(tail);

  return tailString ? `${line} ${tailString}` : line;
}

export function buildPictureSections(
  subject: string,
  fragments: Record<PictureSection, readonly string[]>,
  tail: PictureTail,
): PicturePromptSection[] | null {
  const cleanSubject = cleanFragment(subject);
  if (!cleanSubject) {
    return null;
  }

  const cleaned = cleanedSectionFragments(fragments);
  const sections: PicturePromptSection[] = [
    {
      key: "subject",
      heading: "SUBJECT",
      label: "Subject",
      body: cleanSubject,
    },
  ];

  for (const section of PICTURE_SECTIONS) {
    if (cleaned[section].length > 0) {
      sections.push({
        key: section,
        heading: SECTION_HEADINGS[section].heading,
        label: SECTION_HEADINGS[section].label,
        body: cleaned[section].join(", "),
      });
    }
  }

  const tailString = buildTailString(tail);
  if (tailString) {
    sections.push({
      key: "tail",
      heading: "PARAMETERS",
      label: "Parameters",
      body: tailString,
    });
  }

  return sections;
}
