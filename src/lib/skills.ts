import skillsData from "@/data/skills.json";

export type SkillLayer = "Design" | "Engineering" | "QA" | "Optional";

export type SkillCommand = {
  command: string;
  note?: string;
};

export type SkillOption = {
  name: string;
  note: string;
};

export type Skill = {
  id: string;
  name: string;
  layer: SkillLayer;
  summary: string;
  useFor: string;
  source: string;
  // The install command(s) — most skills only have these (they are instruction
  // packs the agent reads, not CLI tools you run afterward).
  install: SkillCommand[];
  // Usage modes you invoke (e.g. Avoid AI Writing: rewrite / detect / edit).
  modes?: SkillOption[];
  // Named sub-skills within a bundle (e.g. Taste Skill variants).
  subSkills?: SkillOption[];
};

export type SkillsCatalog = {
  schemaVersion: number;
  skills: Skill[];
};

export type SkillGroup = {
  id: SkillLayer;
  label: string;
  blurb: string;
  skills: Skill[];
};

const catalog = skillsData as SkillsCatalog;

export const SKILLS = catalog.skills;

// Display order + labels for the layer groups (matches docs/AI_STACK.md layers).
const SKILL_LAYERS: Array<Omit<SkillGroup, "skills">> = [
  {
    id: "Design",
    label: "Design",
    blurb: "Visual direction, interaction feel, and copy voice.",
  },
  {
    id: "Engineering",
    label: "Engineering",
    blurb: "Framework correctness, component quality, and discipline.",
  },
  {
    id: "QA",
    label: "QA / Deployment",
    blurb: "Accessibility, browser testing, and ship-readiness.",
  },
  {
    id: "Optional",
    label: "Optional",
    blurb: "Per-project add-ons, installed only when a project needs them.",
  },
];

export function getSkills(): Skill[] {
  return SKILLS;
}

export function getSkillsByLayer(): SkillGroup[] {
  return SKILL_LAYERS.map((layer) => ({
    ...layer,
    skills: SKILLS.filter((skill) => skill.layer === layer.id),
  })).filter((group) => group.skills.length > 0);
}
