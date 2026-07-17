export type ToolId =
  | "prompt-builder"
  | "architect-wizard"
  | "image-editor"
  | "skills";

// The one "this is a phone" threshold. Kept byte-identical to the media query
// that drives the mobile gate in globals.css ("Mobile tool gate" section):
// when the two disagree, a width can be gated while a tool's own layout still
// thinks it is on a desktop.
export const PHONE_MEDIA_QUERY = "(max-width: 767.98px)";

export interface ToolDescriptor {
  id: ToolId;
  name: string;
  shortName: string;
  tagline: string;
  href: string;
  // When true, the tool renders full-bleed (escapes the centered page-stage).
  fullBleed?: boolean;
  // "gated": below 768px the shell swaps the tool for an explainer with a
  // session-scoped "Preview anyway" override (docs/ARCHITECTURE.md §2).
  // Omitted means the tool is fully usable at phone widths.
  mobileSupport?: "full" | "gated";
  // Gate-screen copy: 2-3 concrete lines on what the tool does and where the
  // data lives. Required when mobileSupport is "gated".
  mobileGateNotes?: string[];
}

export const TOOL_REGISTRY: Record<ToolId, ToolDescriptor> = {
  "prompt-builder": {
    id: "prompt-builder",
    name: "Prompt Builder",
    shortName: "Prompts",
    tagline: "Turn a rough request into a clear, reusable model prompt.",
    href: "/tools/prompt-builder",
    fullBleed: true,
    mobileSupport: "gated",
    mobileGateNotes: [
      "Builds C.R.A.F.T. prompts from explicit card choices — roles, tactics, modifiers, and tuning tracks.",
      "35 roles, 32 card lineages, and 25 archetype presets to start from.",
      "Drafts autosave in this browser; sessions export and import as local JSON.",
    ],
  },
  "architect-wizard": {
    id: "architect-wizard",
    name: "Architect Wizard",
    shortName: "Architect",
    tagline:
      "Sketch an application's architecture and data model, then export a build brief for an AI agent.",
    href: "/tools/architect-wizard",
    fullBleed: true,
    mobileSupport: "gated",
    mobileGateNotes: [
      "Sketches an application's architecture and data model on a node canvas.",
      "Exports a build brief an AI agent can implement from.",
      "Diagrams save locally in this browser — nothing leaves your machine.",
    ],
  },
  "image-editor": {
    id: "image-editor",
    name: "Image Editor",
    shortName: "Image",
    tagline:
      "A local, layer-based image editor — paint, select, adjust, and export in the browser.",
    href: "/tools/image-editor",
    fullBleed: true,
    mobileSupport: "gated",
    mobileGateNotes: [
      "Layer-based editing: paint, select, adjust, filter.",
      "Opens local images; exports PNG, JPG, or a layered .zip.",
      "Runs entirely in this browser — files never leave your machine.",
    ],
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
