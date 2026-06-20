export type BlockType =
  | "manager"
  | "worker"
  | "service"
  | "base"
  | "data"
  | "adapter"
  | "external"
  | "utility";

export type DataField = {
  id: string;
  name: string;
  type: string;
  description: string;
  // Optional link to a Data component whose shape this field holds. When set,
  // the builder keeps a "uses" edge to that component so the model stays coherent.
  ref?: string;
};

export type ArchitectNode = {
  id: string;
  type: BlockType;
  name: string;
  // Why this component exists — the outcome it is responsible for (frames the rest).
  goal: string;
  // What it does — how it generally works in practice, not every function.
  description: string;
  // High-level responsibilities / key functions (plain bullets, not signatures).
  responsibilities: string[];
  // The data this component owns, edited inline (class-with-data).
  fields: DataField[];
  // Prose description of the data when the fields aren't enumerated one by one.
  dataNotes: string;
  // Open notes / context — design reasoning, edge cases, relationships, ideas.
  notes: string;
  // Unknowns the build should resolve first — one question per line.
  openQuestions: string;
  // Optional subsystem this component belongs to (see ArchitectProject.groups).
  groupId?: string;
  position: { x: number; y: number };
};

// uses  — depends on / calls
// owns  — composition; the target is part of the source
// extends — implements / derives from (inheritance)
// emits — sends events to / is handled by
export type ArchitectEdgeKind = "uses" | "owns" | "extends" | "emits";

export type ArchitectEdge = {
  id: string;
  source: string;
  target: string;
  kind: ArchitectEdgeKind;
  label?: string;
};

export type ArchitectGroup = {
  id: string;
  name: string;
};

export type ArchitectProject = {
  version: 2;
  systemName: string;
  systemGoal: string;
  nodes: ArchitectNode[];
  edges: ArchitectEdge[];
  groups: ArchitectGroup[];
};

export const EMPTY_PROJECT: ArchitectProject = {
  version: 2,
  systemName: "",
  systemGoal: "",
  nodes: [],
  edges: [],
  groups: [],
};
