import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPicturePrompt,
  buildPictureSections,
  buildTailString,
  PICTURE_INCOMPLETE_TEXT,
  PICTURE_MERGE_ORDER,
  PICTURE_SECTIONS,
} from "../src/lib/picture-prompt.ts";

const EMPTY_FRAGMENTS = Object.fromEntries(
  PICTURE_SECTIONS.map((section) => [section, []]),
);

const OFF_TAIL = {
  enabled: false,
  aspectRatio: "3:2",
  stylize: 250,
  chaos: 10,
  weird: null,
  negative: "text, watermark",
};

test("merge order is a permutation of the panel sections", () => {
  assert.deepEqual(
    [...PICTURE_MERGE_ORDER].sort(),
    [...PICTURE_SECTIONS].sort(),
  );
});

test("an empty subject yields the incomplete text and null sections", () => {
  assert.equal(
    buildPicturePrompt("  ", EMPTY_FRAGMENTS, OFF_TAIL),
    PICTURE_INCOMPLETE_TEXT,
  );
  assert.equal(buildPictureSections("", EMPTY_FRAGMENTS, OFF_TAIL), null);
});

test("fragments join in merge order, subject first", () => {
  const prompt = buildPicturePrompt(
    "a fox in a raincoat",
    {
      ...EMPTY_FRAGMENTS,
      illumination: ["golden-hour glow"],
      canvas: ["loose watercolor"],
      execution: ["wide establishing shot"],
    },
    OFF_TAIL,
  );

  assert.equal(
    prompt,
    "a fox in a raincoat, loose watercolor, golden-hour glow, wide establishing shot",
  );
});

test("comma hygiene: whitespace collapses, trailing commas drop, duplicates dedupe", () => {
  const prompt = buildPicturePrompt(
    "  a\nfox  ",
    {
      ...EMPTY_FRAGMENTS,
      illumination: ["  golden glow,, ", "", "Golden Glow"],
      tone: ["muted palette,"],
    },
    OFF_TAIL,
  );

  assert.equal(prompt, "a fox, golden glow, muted palette");
});

test("the tail joins only while enabled", () => {
  const fragments = { ...EMPTY_FRAGMENTS, canvas: ["oil painting"] };
  const onTail = { ...OFF_TAIL, enabled: true };

  assert.equal(
    buildPicturePrompt("a fox", fragments, onTail),
    "a fox, oil painting --ar 3:2 --stylize 250 --chaos 10 --no text, watermark",
  );
  assert.equal(
    buildPicturePrompt("a fox", fragments, OFF_TAIL),
    "a fox, oil painting",
  );
});

test("tail guards: bad ratio, negative numbers, and non-finite values drop out", () => {
  assert.equal(
    buildTailString({
      enabled: true,
      aspectRatio: "banana",
      stylize: -5,
      chaos: Number.NaN,
      weird: 2999.6,
      negative: "  ",
    }),
    "--weird 3000",
  );
  assert.equal(
    buildTailString({
      enabled: true,
      aspectRatio: "",
      stylize: null,
      chaos: null,
      weird: null,
      negative: "",
    }),
    "",
  );
});

test("sections carry only non-empty panels plus subject and parameters", () => {
  const sections = buildPictureSections(
    "a fox",
    { ...EMPTY_FRAGMENTS, references: ["ukiyo-e woodblock style"] },
    { ...OFF_TAIL, enabled: true, negative: "" },
  );

  assert.deepEqual(
    sections.map((section) => section.key),
    ["subject", "references", "tail"],
  );
  assert.equal(sections[1].heading, "REFERENCES");
  assert.equal(sections[2].body, "--ar 3:2 --stylize 250 --chaos 10");
});
