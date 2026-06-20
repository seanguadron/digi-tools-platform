export type ToolId = "prompt-builder" | "architect-wizard" | "skills";

export interface ToolDescriptor {
  id: ToolId;
  name: string;
  shortName: string;
  tagline: string;
  href: string;
  // When true, the tool renders full-bleed (escapes the centered page-stage).
  fullBleed?: boolean;
}

export const TOOL_REGISTRY: Record<ToolId, ToolDescriptor> = {
  "prompt-builder": {
    id: "prompt-builder",
    name: "Prompt Builder",
    shortName: "Prompts",
    tagline: "Turn a rough request into a clear, reusable model prompt.",
    href: "/tools/prompt-builder",
    fullBleed: true,
  },
  "architect-wizard": {
    id: "architect-wizard",
    name: "Architect Wizard",
    shortName: "Architect",
    tagline:
      "Sketch an application's architecture and data model, then export a build brief for an AI agent.",
    href: "/tools/architect-wizard",
    fullBleed: true,
  },
  skills: {
    id: "skills",
    name: "Skills",
    shortName: "Skills",
    tagline:
      "A curated library of AI skills — what each one does and how to install it.",
    href: "/tools/skills",
    fullBleed: false,
  },
};

export const TOOLS = Object.values(TOOL_REGISTRY);
