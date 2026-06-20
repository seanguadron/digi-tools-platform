import type { ArchitectProject } from "@/lib/architect/types";

// A gap (would make the build brief ambiguous) or a warn (smells off against the
// Manager/Worker/Service philosophy, but may be intentional).
export type ReadinessIssue = {
  id: string;
  nodeId?: string;
  severity: "gap" | "warn";
  message: string;
};

function hasFields(node: ArchitectProject["nodes"][number]): boolean {
  return node.fields.some((field) => field.name.trim() || field.type.trim());
}

export function computeReadiness(project: ArchitectProject): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const { nodes, edges } = project;

  if (nodes.length > 0 && !project.systemName.trim()) {
    issues.push({
      id: "sys-name",
      severity: "gap",
      message: "The system has no name.",
    });
  }
  if (nodes.length > 0 && !project.systemGoal.trim()) {
    issues.push({
      id: "sys-goal",
      severity: "warn",
      message: "The system has no goal — the brief opens without a purpose.",
    });
  }

  const touched = new Set<string>();
  for (const edge of edges) {
    touched.add(edge.source);
    touched.add(edge.target);
  }

  for (const node of nodes) {
    const label = node.name.trim() || "Unnamed component";
    const named = node.name.trim().length > 0;
    const hasPurpose = Boolean(node.goal.trim() || node.description.trim());
    const hasSubstance =
      node.responsibilities.some((item) => item.trim()) ||
      hasFields(node) ||
      node.dataNotes.trim().length > 0;

    if (!named) {
      issues.push({
        id: `name-${node.id}`,
        nodeId: node.id,
        severity: "gap",
        message: "A component has no name.",
      });
    }
    if (named && !hasPurpose) {
      issues.push({
        id: `purpose-${node.id}`,
        nodeId: node.id,
        severity: "gap",
        message: `${label} has no goal or description.`,
      });
    }
    if (named && hasPurpose && !hasSubstance && node.type !== "external") {
      issues.push({
        id: `stub-${node.id}`,
        nodeId: node.id,
        severity: "warn",
        message: `${label} is a stub — no responsibilities or data yet.`,
      });
    }
    if (node.type === "data" && !hasFields(node) && !node.dataNotes.trim()) {
      issues.push({
        id: `data-${node.id}`,
        nodeId: node.id,
        severity: "gap",
        message: `${label} is a Data block with no fields or data notes.`,
      });
    }
    if (nodes.length > 1 && !touched.has(node.id)) {
      issues.push({
        id: `orphan-${node.id}`,
        nodeId: node.id,
        severity: "warn",
        message: `${label} is not connected to anything.`,
      });
    }

    // Philosophy guardrails (Manager/Worker/Service + class-with-data).
    const emitsActively = edges.some(
      (edge) =>
        edge.source === node.id &&
        (edge.kind === "uses" || edge.kind === "emits"),
    );
    if (node.type === "data" && emitsActively) {
      issues.push({
        id: `passive-${node.id}`,
        nodeId: node.id,
        severity: "warn",
        message: `${label} is Data but "uses"/"emits" something — data is usually passive.`,
      });
    }
    if (node.type === "manager" && named && nodes.length > 1) {
      const owns = edges.some(
        (edge) => edge.source === node.id && edge.kind === "owns",
      );
      if (!owns) {
        issues.push({
          id: `manager-owns-${node.id}`,
          nodeId: node.id,
          severity: "warn",
          message: `${label} is a Manager that owns nothing — managers usually own a domain object.`,
        });
      }
    }
  }

  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({
        id: `edge-${edge.id}`,
        severity: "gap",
        message: "A connection points to a missing component.",
      });
    }
  }

  return issues;
}
