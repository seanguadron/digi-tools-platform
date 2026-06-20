import type { Metadata } from "next";
import { SkillsWiki } from "@/components/skills-wiki";
import { getSkills, getSkillsByLayer } from "@/lib/skills";

export const metadata: Metadata = {
  title: "Skills",
  description:
    "A curated library of AI skills for design, engineering, and QA — what each one does and how to install it.",
};

export default function SkillsPage() {
  const groups = getSkillsByLayer();
  const total = getSkills().length;
  return <SkillsWiki groups={groups} total={total} />;
}
