import { getBlockDefinition } from "@/lib/architect/blocks";
import type {
  ArchitectEdgeKind,
  ArchitectNode,
  ArchitectProject,
} from "@/lib/architect/types";

function nodeName(project: ArchitectProject, id: string): string {
  return project.nodes.find((node) => node.id === id)?.name.trim() ?? "";
}

function displayName(node: ArchitectNode): string {
  return node.name.trim() || "Unnamed component";
}

// --- Mermaid diagram (travels with the doc; renders on GitHub and most viewers) ---
function mermaidText(text: string): string {
  return text.replace(/"/g, "'").replace(/\s*\n\s*/g, " ");
}

const MERMAID_ARROW: Record<ArchitectEdgeKind, string> = {
  uses: "-->",
  owns: "==>",
  extends: "-.->",
  emits: "-->",
};

const KIND_WORD: Record<ArchitectEdgeKind, string> = {
  owns: "Owns",
  extends: "Extends",
  uses: "Uses",
  emits: "Emits to",
};

const KIND_ORDER: ArchitectEdgeKind[] = ["owns", "extends", "uses", "emits"];

function buildMermaid(project: ArchitectProject): string[] {
  if (project.nodes.length === 0) {
    return [];
  }

  const idMap = new Map(project.nodes.map((node, index) => [node.id, `n${index}`]));
  const lines = ["```mermaid", "graph LR"];

  for (const node of project.nodes) {
    const def = getBlockDefinition(node.type);
    lines.push(
      `  ${idMap.get(node.id)}["${mermaidText(displayName(node))}<br/><i>${def.label}</i>"]`,
    );
  }

  for (const edge of project.edges) {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) {
      continue;
    }
    const label = mermaidText(edge.label?.trim() || edge.kind);
    lines.push(`  ${source} ${MERMAID_ARROW[edge.kind]}|${label}| ${target}`);
  }

  lines.push("```");
  return lines;
}

// --- Build order (topological: prerequisites before the things that use them) ---
function buildSequence(project: ArchitectProject): {
  order: ArchitectNode[];
  cyclic: ArchitectNode[];
} {
  const ids = new Set(project.nodes.map((node) => node.id));
  const deps = new Map<string, Set<string>>();
  for (const node of project.nodes) {
    deps.set(node.id, new Set());
  }
  for (const edge of project.edges) {
    // The source depends on the target, so build the target first.
    if (
      edge.source !== edge.target &&
      ids.has(edge.source) &&
      ids.has(edge.target)
    ) {
      deps.get(edge.source)?.add(edge.target);
    }
  }

  const placed: ArchitectNode[] = [];
  const placedSet = new Set<string>();
  let remaining = [...project.nodes];

  while (remaining.length > 0) {
    const ready = remaining.filter((node) => {
      const need = deps.get(node.id) ?? new Set<string>();
      return [...need].every((dep) => placedSet.has(dep));
    });

    if (ready.length === 0) {
      // A dependency cycle — nothing else can be ordered cleanly.
      return { order: placed, cyclic: remaining };
    }

    for (const node of ready) {
      placed.push(node);
      placedSet.add(node.id);
    }
    remaining = remaining.filter((node) => !placedSet.has(node.id));
  }

  return { order: placed, cyclic: [] };
}

function collectOpenQuestions(project: ArchitectProject): string[] {
  const out: string[] = [];
  for (const node of project.nodes) {
    const questions = node.openQuestions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const question of questions) {
      out.push(`- [ ] [${displayName(node)}] ${question}`);
    }
  }
  return out;
}

function emitNode(
  project: ArchitectProject,
  node: ArchitectNode,
  lines: string[],
  level: number,
): void {
  const def = getBlockDefinition(node.type);
  const heading = "#".repeat(level);

  lines.push("", `${heading} ${displayName(node)} — ${def.label}`);
  if (node.goal.trim()) {
    lines.push("", `**Goal:** ${node.goal.trim()}`);
  }
  if (node.description.trim()) {
    lines.push("", node.description.trim());
  }

  const outgoing = project.edges
    .filter((relationship) => relationship.source === node.id)
    .slice()
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  if (outgoing.length > 0) {
    lines.push("", "**Relationships**");
    for (const relationship of outgoing) {
      const target = nodeName(project, relationship.target) || "—";
      const label = relationship.label?.trim();
      lines.push(
        `- ${KIND_WORD[relationship.kind]} ${target}${
          label ? ` — ${label}` : ""
        }`,
      );
    }
  }

  const responsibilities = node.responsibilities
    .map((item) => item.trim())
    .filter(Boolean);
  if (responsibilities.length > 0) {
    lines.push("", "**Responsibilities**");
    for (const item of responsibilities) {
      lines.push(`- ${item}`);
    }
  }

  const fields = node.fields.filter(
    (field) => field.name.trim() || field.type.trim() || field.description.trim(),
  );
  const dataNotes = node.dataNotes.trim();
  if (fields.length > 0 || dataNotes) {
    lines.push("", "**Data**");
    if (dataNotes) {
      lines.push("", dataNotes);
    }
    if (fields.length > 0) {
      lines.push("", "| Field | Type | Description |", "| --- | --- | --- |");
      for (const field of fields) {
        lines.push(
          `| ${field.name.trim() || "—"} | ${field.type.trim() || "—"} | ${field.description.trim()} |`,
        );
      }
    }
  }

  if (node.notes.trim()) {
    lines.push("", "**Notes**", node.notes.trim());
  }
}

function emitArchitecture(project: ArchitectProject, lines: string[]): void {
  const groups = project.groups.filter((group) =>
    project.nodes.some((node) => node.groupId === group.id),
  );

  if (groups.length === 0) {
    for (const node of project.nodes) {
      emitNode(project, node, lines, 3);
    }
    return;
  }

  for (const group of groups) {
    lines.push("", `### ▦ ${group.name.trim() || "Subsystem"}`);
    for (const node of project.nodes.filter((n) => n.groupId === group.id)) {
      emitNode(project, node, lines, 4);
    }
  }

  const ungrouped = project.nodes.filter(
    (node) => !groups.some((group) => group.id === node.groupId),
  );
  if (ungrouped.length > 0) {
    lines.push("", "### ▦ Other");
    for (const node of ungrouped) {
      emitNode(project, node, lines, 4);
    }
  }
}

export function buildArchitectureMarkdown(project: ArchitectProject): string {
  const lines: string[] = [];
  const name = project.systemName.trim() || "Untitled system";

  lines.push(`# ${name}`);

  if (project.systemGoal.trim()) {
    lines.push("", "## Goal", project.systemGoal.trim());
  }

  const mermaid = buildMermaid(project);
  if (mermaid.length > 0) {
    lines.push("", "## Diagram", ...mermaid);
  }

  if (project.nodes.length > 0) {
    const { order, cyclic } = buildSequence(project);
    lines.push(
      "",
      "## Build sequence",
      "Build in this order so each component's dependencies already exist:",
    );
    order.forEach((node, index) => {
      const def = getBlockDefinition(node.type);
      lines.push(`${index + 1}. ${displayName(node)} — ${def.label}`);
    });
    if (cyclic.length > 0) {
      lines.push(
        "",
        `> ⚠ Dependency cycle among: ${cyclic
          .map((node) => displayName(node))
          .join(", ")}. Break it, or build these together behind an interface.`,
      );
    }
  }

  const openQuestions = collectOpenQuestions(project);
  if (openQuestions.length > 0) {
    lines.push(
      "",
      "## Open questions",
      "Resolve these before or early in the build — do not guess:",
      ...openQuestions,
    );
  }

  if (project.nodes.length > 0) {
    lines.push("", "## Architecture");
    emitArchitecture(project, lines);
  }

  lines.push(
    "",
    "## Build notes for the agent",
    "Scaffold the application from the architecture above. Treat each component as a high-level module — implement what it does and the data it owns, not every function. Build in the sequence given, wire the components together following the Uses / Owns / Extends / Emits relationships, and resolve the open questions before assuming anything that is not specified here.",
  );

  return `${lines.join("\n")}\n`;
}

export function buildArchitectureJson(project: ArchitectProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}
