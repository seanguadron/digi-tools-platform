import type { ArchitectNode, ArchitectProject } from "@/lib/architect/types";

const COLUMN_GAP = 300;
const LANE_GAP = 340;
const ROW_GAP = 185;
const MARGIN = 60;
const UNGROUPED = "__ungrouped";

// Longest dependency chain length per node: things that depend on nothing sit at
// 0, and the components that use them climb from there. Shared by both layouts.
function dependencyDepths(
  project: ArchitectProject,
): Map<string, number> {
  const ids = new Set(project.nodes.map((node) => node.id));
  const targetsOf = new Map<string, string[]>();
  for (const node of project.nodes) {
    targetsOf.set(node.id, []);
  }
  for (const edge of project.edges) {
    if (
      edge.source !== edge.target &&
      ids.has(edge.source) &&
      ids.has(edge.target)
    ) {
      const targets = targetsOf.get(edge.source);
      if (targets) {
        targets.push(edge.target);
      }
    }
  }

  const cache = new Map<string, number>();
  function depthOf(id: string, stack: Set<string>): number {
    const cached = cache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    if (stack.has(id)) {
      return 0; // break cycles gracefully
    }
    stack.add(id);
    let depth = 0;
    for (const target of targetsOf.get(id) ?? []) {
      depth = Math.max(depth, depthOf(target, stack) + 1);
    }
    stack.delete(id);
    cache.set(id, depth);
    return depth;
  }

  const depths = new Map<string, number>();
  for (const node of project.nodes) {
    depths.set(node.id, depthOf(node.id, new Set()));
  }
  return depths;
}

// Lay the graph out left → right by dependency depth: things that depend on
// nothing (data, base types) sit on the left, and the components that use them
// flow rightward. Hand-rolled so we don't pull in a layout dependency.
export function layeredLayout(
  project: ArchitectProject,
): Record<string, { x: number; y: number }> {
  const depths = dependencyDepths(project);
  const depthOf = (id: string) => depths.get(id) ?? 0;
  const orderIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  const positions: Record<string, { x: number; y: number }> = {};

  const hasGroups = project.nodes.some(
    (node) =>
      node.groupId &&
      project.groups.some((groupItem) => groupItem.id === node.groupId),
  );

  // --- Plain dependency-column layout (no subsystems) ---
  if (!hasGroups) {
    const byColumn = new Map<number, ArchitectNode[]>();
    for (const node of project.nodes) {
      const column = depthOf(node.id);
      const bucket = byColumn.get(column) ?? [];
      bucket.push(node);
      byColumn.set(column, bucket);
    }
    for (const [column, nodes] of byColumn) {
      const ordered = [...nodes].sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
      );
      ordered.forEach((node, row) => {
        positions[node.id] = {
          x: MARGIN + column * COLUMN_GAP,
          y: MARGIN + row * ROW_GAP,
        };
      });
    }
    return positions;
  }

  // --- Group-aware lane layout ---
  // Each subsystem becomes a tight vertical lane. Lanes are ordered left→right
  // by their average dependency depth so most edges flow one way, and members
  // within a lane are ordered by a barycenter pass to line up with what they
  // connect to on the left — which is what cuts the crossings.
  const validGroupIds = new Set(project.groups.map((groupItem) => groupItem.id));
  const laneKeyOf = (node: ArchitectNode) =>
    node.groupId && validGroupIds.has(node.groupId) ? node.groupId : UNGROUPED;
  const laneKeyById = new Map(
    project.nodes.map((node) => [node.id, laneKeyOf(node)]),
  );

  const laneMembers = new Map<string, ArchitectNode[]>();
  for (const node of project.nodes) {
    const key = laneKeyOf(node);
    const bucket = laneMembers.get(key) ?? [];
    bucket.push(node);
    laneMembers.set(key, bucket);
  }

  const avgDepth = (key: string) => {
    const members = laneMembers.get(key) ?? [];
    if (members.length === 0) {
      return 0;
    }
    const total = members.reduce((sum, node) => sum + depthOf(node.id), 0);
    return total / members.length;
  };

  // Start from flow order (by depth, ungrouped last) — also the tie-breaker.
  const laneKeysByDepth = [...laneMembers.keys()].sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    return avgDepth(a) - avgDepth(b);
  });

  // Then reorder lanes so connected subsystems sit adjacent — minimise the total
  // cross-lane edge span. Brute-forced; trivial for a handful of subsystems.
  const totalSpan = (order: string[]) => {
    const pos = new Map(order.map((key, index) => [key, index]));
    let span = 0;
    for (const edge of project.edges) {
      const a = pos.get(laneKeyById.get(edge.source) ?? UNGROUPED);
      const b = pos.get(laneKeyById.get(edge.target) ?? UNGROUPED);
      if (a !== undefined && b !== undefined) {
        span += Math.abs(a - b);
      }
    }
    return span;
  };

  let laneKeys = laneKeysByDepth;
  if (laneKeysByDepth.length <= 7) {
    let bestSpan = totalSpan(laneKeysByDepth);
    const search = (remaining: string[], chosen: string[]) => {
      if (remaining.length === 0) {
        const span = totalSpan(chosen);
        if (span < bestSpan) {
          bestSpan = span;
          laneKeys = chosen;
        }
        return;
      }
      for (let i = 0; i < remaining.length; i += 1) {
        search(
          [...remaining.slice(0, i), ...remaining.slice(i + 1)],
          [...chosen, remaining[i]],
        );
      }
    };
    search(laneKeysByDepth, []);
  }

  // Initial within-lane order: by depth, then original authoring order.
  const laneOrder = new Map<string, ArchitectNode[]>();
  for (const key of laneKeys) {
    const ordered = [...(laneMembers.get(key) ?? [])].sort(
      (a, b) =>
        depthOf(a.id) - depthOf(b.id) ||
        (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
    );
    laneOrder.set(key, ordered);
  }

  const rowIndex = new Map<string, number>();
  const reindex = (key: string) => {
    (laneOrder.get(key) ?? []).forEach((node, index) =>
      rowIndex.set(node.id, index),
    );
  };
  laneKeys.forEach(reindex);

  const neighbors = new Map<string, string[]>();
  for (const node of project.nodes) {
    neighbors.set(node.id, []);
  }
  for (const edge of project.edges) {
    if (neighbors.has(edge.source) && neighbors.has(edge.target)) {
      neighbors.get(edge.source)?.push(edge.target);
      neighbors.get(edge.target)?.push(edge.source);
    }
  }

  // Left-to-right barycenter: order each lane by the average row of the
  // neighbours already placed in the lanes to its left.
  for (let laneIdx = 1; laneIdx < laneKeys.length; laneIdx += 1) {
    const key = laneKeys[laneIdx];
    const leftKeys = new Set(laneKeys.slice(0, laneIdx));
    const laneNodes = laneOrder.get(key) ?? [];
    const barycenter = new Map<string, number>();
    laneNodes.forEach((node, index) => {
      const placedNeighbors = (neighbors.get(node.id) ?? []).filter((id) =>
        leftKeys.has(laneKeyById.get(id) ?? UNGROUPED),
      );
      if (placedNeighbors.length === 0) {
        barycenter.set(node.id, index);
        return;
      }
      const total = placedNeighbors.reduce(
        (sum, id) => sum + (rowIndex.get(id) ?? 0),
        0,
      );
      barycenter.set(node.id, total / placedNeighbors.length);
    });
    laneNodes.sort(
      (a, b) =>
        (barycenter.get(a.id) ?? 0) - (barycenter.get(b.id) ?? 0) ||
        (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
    );
    reindex(key);
  }

  laneKeys.forEach((key, laneIdx) => {
    (laneOrder.get(key) ?? []).forEach((node, row) => {
      positions[node.id] = {
        x: MARGIN + laneIdx * LANE_GAP,
        y: MARGIN + row * ROW_GAP,
      };
    });
  });
  return positions;
}
