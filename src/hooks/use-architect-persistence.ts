"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { readStored, writeStored } from "@/lib/prompt-storage";
import type {
  ArchitectEdge,
  ArchitectNode,
  ArchitectProject,
  BlockType,
} from "@/lib/architect/types";

const PROJECT_KEY = "digitools.architect-wizard.project-v1";
const SAVED_AT_KEY = "digitools.architect-wizard.saved-at-v1";

// Legacy (v1) shapes kept only so we can migrate an in-progress sketch forward.
type LegacyField = { id: string; name?: string; type?: string; description?: string };
type LegacyEntity = {
  id: string;
  name?: string;
  description?: string;
  fields?: LegacyField[];
};
type LegacyNode = {
  id: string;
  type: string;
  name?: string;
  description?: string;
  dataEntityIds?: string[];
  position?: { x: number; y: number };
};
type LegacyProject = {
  version: 1;
  systemName?: string;
  systemGoal?: string;
  nodes?: LegacyNode[];
  edges?: ArchitectEdge[];
  entities?: LegacyEntity[];
};

// Removed v1 block types fold into the closest surviving v2 type.
const LEGACY_TYPE_MAP: Record<string, BlockType> = {
  manager: "manager",
  worker: "worker",
  service: "service",
  controller: "manager",
  model: "data",
  store: "data",
  adapter: "adapter",
  ui: "worker",
  utility: "utility",
  external: "external",
};

function mapLegacyType(type: string): BlockType {
  return LEGACY_TYPE_MAP[type] ?? "worker";
}

function migrateV1(raw: LegacyProject): ArchitectProject {
  const nodes: ArchitectNode[] = (raw.nodes ?? []).map((node) => ({
    id: node.id,
    type: mapLegacyType(node.type),
    name: node.name ?? "",
    goal: "",
    description: node.description ?? "",
    responsibilities: [],
    fields: [],
    dataNotes: "",
    notes: "",
    openQuestions: "",
    position: node.position ?? { x: 0, y: 0 },
  }));

  const edges: ArchitectEdge[] = [...(raw.edges ?? [])];
  const entities = raw.entities ?? [];

  // Each old global entity becomes a standalone Data node, laid out in a column.
  entities.forEach((entity, index) => {
    nodes.push({
      id: entity.id,
      type: "data",
      name: entity.name ?? "",
      goal: "",
      description: entity.description ?? "",
      responsibilities: [],
      fields: (entity.fields ?? []).map((field) => ({
        id: field.id,
        name: field.name ?? "",
        type: field.type ?? "",
        description: field.description ?? "",
      })),
      dataNotes: "",
      notes: "",
      openQuestions: "",
      position: { x: 760, y: 80 + index * 170 },
    });
  });

  // Preserve old node→entity links as "uses" edges to the new Data nodes.
  for (const node of raw.nodes ?? []) {
    for (const entityId of node.dataEntityIds ?? []) {
      if (entities.some((entity) => entity.id === entityId)) {
        edges.push({
          id: `mig-${node.id}-${entityId}`,
          source: node.id,
          target: entityId,
          kind: "uses",
        });
      }
    }
  }

  return {
    version: 2,
    systemName: raw.systemName ?? "",
    systemGoal: raw.systemGoal ?? "",
    nodes,
    edges,
    groups: [],
  };
}

function normalizeV2(raw: ArchitectProject): ArchitectProject {
  return {
    version: 2,
    systemName: raw.systemName ?? "",
    systemGoal: raw.systemGoal ?? "",
    nodes: (raw.nodes ?? []).map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name ?? "",
      goal: node.goal ?? "",
      description: node.description ?? "",
      responsibilities: Array.isArray(node.responsibilities)
        ? node.responsibilities
        : [],
      fields: Array.isArray(node.fields) ? node.fields : [],
      dataNotes: node.dataNotes ?? "",
      notes: node.notes ?? "",
      openQuestions: node.openQuestions ?? "",
      groupId: node.groupId,
      position: node.position ?? { x: 0, y: 0 },
    })),
    edges: raw.edges ?? [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
  };
}

function coerceProject(raw: unknown): ArchitectProject | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const version = (raw as { version?: unknown }).version;
  if (version === 2) {
    return normalizeV2(raw as ArchitectProject);
  }
  if (version === 1) {
    return migrateV1(raw as LegacyProject);
  }
  return null;
}

// Thin adapter over the shared useLocalDraft lifecycle. The saved-at value is
// stored JSON-encoded via writeStored (unlike the other tools' raw ISO
// strings) — do not unify; existing keys depend on it.
export function useArchitectPersistence({
  project,
  setProject,
}: {
  project: ArchitectProject;
  setProject: Dispatch<SetStateAction<ArchitectProject>>;
}) {
  const restore = useCallback(() => {
    const saved = coerceProject(readStored<unknown>(PROJECT_KEY, null));
    if (saved) {
      setProject(saved);
    }
    const savedAt = readStored<string | null>(SAVED_AT_KEY, null);
    return {
      status: "saved" as const,
      savedAt: savedAt ? new Date(savedAt) : null,
    };
  }, [setProject]);

  const save = useCallback((value: ArchitectProject, savedAt: Date) => {
    // writeStored swallows quota errors, so this save can never throw and the
    // "unavailable" status is unreachable here (pre-existing behavior).
    writeStored(PROJECT_KEY, value);
    writeStored(SAVED_AT_KEY, savedAt.toISOString());
    return "saved" as const;
  }, []);

  return useLocalDraft({ value: project, restore, save });
}
