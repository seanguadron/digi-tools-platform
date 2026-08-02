import type { Metadata } from "next";
import { PromptBuilder } from "@/components/prompt-builder";
import { getPromptRoles } from "@/lib/prompt-content";

export const metadata: Metadata = {
  title: "CRAFT Deck",
  description:
    "Build a structured prompt for ChatGPT, Claude, or another language model.",
};

export default function PromptBuilderPage() {
  const roles = getPromptRoles();

  return <PromptBuilder roles={roles} />;
}
