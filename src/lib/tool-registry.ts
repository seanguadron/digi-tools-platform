export type ToolId = "prompt-builder";

export interface ToolDescriptor {
  id: ToolId;
  name: string;
  shortName: string;
  tagline: string;
  href: string;
}

export const TOOL_REGISTRY: Record<ToolId, ToolDescriptor> = {
  "prompt-builder": {
    id: "prompt-builder",
    name: "Prompt Builder",
    shortName: "Prompts",
    tagline: "Turn a rough request into a clear, reusable model prompt.",
    href: "/tools/prompt-builder",
  },
};

export const TOOLS = Object.values(TOOL_REGISTRY);
