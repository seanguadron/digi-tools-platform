"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
} from "@xyflow/react";
import { getBlockDefinition } from "@/lib/architect/blocks";
import type {
  ArchitectNode,
  ArchitectProject,
  BlockType,
} from "@/lib/architect/types";

export const ARCHITECT_BLOCK_MIME = "application/x-architect-block";

type Completeness = "stub" | "partial" | "full";

type BlockNodeData = {
  typeLabel: string;
  glyph: string;
  accent: string;
  name: string;
  description: string;
  fieldCount: number;
  respCount: number;
  completeness: Completeness;
  editing: boolean;
  onRename: (value: string) => void;
  onFinishRename: () => void;
};

type ArchitectBlockNode = Node<BlockNodeData, "block">;
type SubsystemNodeData = { name: string };
type ArchitectSubsystemNode = Node<SubsystemNodeData, "subsystem">;
type ArchitectFlowNode = ArchitectBlockNode | ArchitectSubsystemNode;

const COMPLETENESS_TITLE: Record<Completeness, string> = {
  full: "Fleshed out — goal and detail",
  partial: "Partially defined",
  stub: "Stub — barely sketched",
};

function completenessOf(node: ArchitectNode): Completeness {
  const hasPurpose = Boolean(node.goal.trim() || node.description.trim());
  const hasSubstance =
    node.responsibilities.some((item) => item.trim()) ||
    node.fields.some((field) => field.name.trim() || field.type.trim()) ||
    node.dataNotes.trim().length > 0;
  if (hasPurpose && hasSubstance) {
    return "full";
  }
  if (node.name.trim() && (hasPurpose || hasSubstance)) {
    return "partial";
  }
  return "stub";
}

function buildNodeData(
  node: ArchitectNode,
  editing: boolean,
  onRename: (value: string) => void,
  onFinishRename: () => void,
): BlockNodeData {
  const def = getBlockDefinition(node.type);
  return {
    typeLabel: def.label,
    glyph: def.glyph,
    accent: def.accent,
    name: node.name,
    description: node.description,
    fieldCount: node.fields.length,
    respCount: node.responsibilities.length,
    completeness: completenessOf(node),
    editing,
    onRename,
    onFinishRename,
  };
}

function BlockNode({ data, selected }: NodeProps<ArchitectBlockNode>) {
  return (
    <div className={selected ? "architect-node is-selected" : "architect-node"}>
      <Handle type="target" position={Position.Left} />
      <span
        className={`architect-node-dot is-${data.completeness}`}
        title={COMPLETENESS_TITLE[data.completeness]}
        aria-hidden="true"
      />
      <span className="architect-node-type" style={{ color: data.accent }}>
        {data.glyph} · {data.typeLabel}
      </span>
      {data.editing ? (
        <input
          className="architect-node-rename nodrag"
          defaultValue={data.name}
          autoFocus
          aria-label="Rename component"
          onChange={(event) => data.onRename(event.target.value)}
          onBlur={data.onFinishRename}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              data.onFinishRename();
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      ) : (
        <strong className="architect-node-name">
          {data.name || "Untitled component"}
        </strong>
      )}
      {data.description ? (
        <p className="architect-node-desc">{data.description}</p>
      ) : null}
      {data.fieldCount > 0 || data.respCount > 0 ? (
        <span className="architect-node-meta">
          {data.fieldCount > 0 ? (
            <span>
              {data.fieldCount} {data.fieldCount === 1 ? "field" : "fields"}
            </span>
          ) : null}
          {data.respCount > 0 ? (
            <span>
              {data.respCount} {data.respCount === 1 ? "duty" : "duties"}
            </span>
          ) : null}
        </span>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SubsystemNode({ data }: NodeProps<ArchitectSubsystemNode>) {
  return (
    <div className="architect-subsystem">
      <div className="architect-subsystem-bar" title="Drag to move this region">
        <span className="architect-subsystem-label">
          {data.name || "Subsystem"}
        </span>
        <span className="architect-subsystem-grip" aria-hidden="true">
          ⋮⋮
        </span>
      </div>
    </div>
  );
}

const NODE_TYPES = { block: BlockNode, subsystem: SubsystemNode };

type CanvasProps = {
  project: ArchitectProject;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onAddNode: (type: BlockType, position: { x: number; y: number }) => void;
  onMoveNode: (id: string, position: { x: number; y: number }) => void;
  onMoveNodes: (
    updates: Array<{ id: string; position: { x: number; y: number } }>,
  ) => void;
  onConnectNodes: (source: string, target: string) => void;
  onSelect: (nodeId: string | null, edgeId: string | null) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
  fitSignal: number;
  focusRequest: { id: string; n: number } | null;
};

function CanvasInner({
  project,
  selectedNodeId,
  selectedEdgeId,
  onAddNode,
  onMoveNode,
  onMoveNodes,
  onConnectNodes,
  onSelect,
  onDeleteNode,
  onDeleteEdge,
  onRenameNode,
  fitSignal,
  focusRequest,
}: CanvasProps) {
  const [rfNodes, setRfNodes, onNodesChange] =
    useNodesState<ArchitectFlowNode>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const groupDragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    members: Map<string, { x: number; y: number }>;
  } | null>(null);
  const onRenameRef = useRef(onRenameNode);
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    onRenameRef.current = onRenameNode;
  }, [onRenameNode]);

  useEffect(() => {
    if (fitSignal <= 0) {
      return;
    }
    const raf = window.requestAnimationFrame(() =>
      fitView({ duration: 350, padding: 0.2 }),
    );
    return () => window.cancelAnimationFrame(raf);
  }, [fitSignal, fitView]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const targetId = focusRequest.id;
    const raf = window.requestAnimationFrame(() =>
      fitView({
        nodes: [{ id: targetId }],
        duration: 400,
        maxZoom: 1.2,
        padding: 0.5,
      }),
    );
    return () => window.cancelAnimationFrame(raf);
  }, [focusRequest, fitView]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      project.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label?.trim() || edge.kind,
        selected: edge.id === selectedEdgeId,
        className: `architect-edge architect-edge--${edge.kind}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      })),
    [project.edges, selectedEdgeId],
  );

  // Mirror the project into React Flow's own node state. Existing nodes keep
  // their live position and measured size (so a content edit never interrupts a
  // drag); only data and selection refresh. React Flow owns positions during a
  // drag and the project is updated once on drag-stop, so autosave stays quiet.
  useEffect(() => {
    setRfNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));
      const blockNodes: ArchitectFlowNode[] = project.nodes.map((node) => {
        const data = buildNodeData(
          node,
          node.id === editingId,
          (value) => onRenameRef.current(node.id, value),
          () => setEditingId(null),
        );
        const existing = byId.get(node.id);
        if (existing && existing.type === "block") {
          return {
            ...existing,
            position: draggingRef.current ? existing.position : node.position,
            data,
            selected: node.id === selectedNodeId,
          };
        }
        return {
          id: node.id,
          type: "block" as const,
          position: node.position,
          data,
          selected: node.id === selectedNodeId,
        };
      });

      const PAD = 26;
      const LABEL = 24;
      const groupNodes: ArchitectFlowNode[] = project.groups
        .map((group): ArchitectSubsystemNode | null => {
          const members = project.nodes.filter(
            (node) => node.groupId === group.id,
          );
          if (members.length === 0) {
            return null;
          }
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const member of members) {
            const existing = byId.get(member.id);
            const position =
              existing && existing.type === "block" && draggingRef.current
                ? existing.position
                : member.position;
            const width = existing?.measured?.width ?? 210;
            const height = existing?.measured?.height ?? 120;
            minX = Math.min(minX, position.x);
            minY = Math.min(minY, position.y);
            maxX = Math.max(maxX, position.x + width);
            maxY = Math.max(maxY, position.y + height);
          }
          return {
            id: `group-${group.id}`,
            type: "subsystem",
            position: { x: minX - PAD, y: minY - PAD - LABEL },
            data: { name: group.name },
            style: {
              width: maxX - minX + PAD * 2,
              height: maxY - minY + PAD * 2 + LABEL,
            },
            draggable: true,
            selectable: false,
            dragHandle: ".architect-subsystem-bar",
            zIndex: -1,
          };
        })
        .filter((node): node is ArchitectSubsystemNode => node !== null);

      return [...groupNodes, ...blockNodes];
    });
  }, [project.nodes, project.groups, selectedNodeId, editingId, setRfNodes]);

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (
        connection.source &&
        connection.target &&
        connection.source !== connection.target
      ) {
        onConnectNodes(connection.source, connection.target);
      }
    },
    [onConnectNodes],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(ARCHITECT_BLOCK_MIME) as BlockType;
      if (!type) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onAddNode(type, position);
    },
    [onAddNode, screenToFlowPosition],
  );

  return (
    <div
      className="architect-canvas"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={() => {}}
        onConnect={handleConnect}
        onNodeDragStart={(_, node) => {
          draggingRef.current = true;
          if (node.type === "subsystem") {
            const groupId = node.id.slice("group-".length);
            const members = new Map(
              project.nodes
                .filter((member) => member.groupId === groupId)
                .map((member) => [
                  member.id,
                  { x: member.position.x, y: member.position.y },
                ]),
            );
            groupDragRef.current = {
              nodeId: node.id,
              startX: node.position.x,
              startY: node.position.y,
              lastX: node.position.x,
              lastY: node.position.y,
              members,
            };
          }
        }}
        onNodeDrag={(_, node) => {
          const drag = groupDragRef.current;
          if (node.type !== "subsystem" || !drag || drag.nodeId !== node.id) {
            return;
          }
          const dx = node.position.x - drag.lastX;
          const dy = node.position.y - drag.lastY;
          if (dx === 0 && dy === 0) {
            return;
          }
          drag.lastX = node.position.x;
          drag.lastY = node.position.y;
          setRfNodes((current) =>
            current.map((other) =>
              drag.members.has(other.id)
                ? {
                    ...other,
                    position: {
                      x: other.position.x + dx,
                      y: other.position.y + dy,
                    },
                  }
                : other,
            ),
          );
        }}
        onNodeDragStop={(_, node) => {
          draggingRef.current = false;
          const drag = groupDragRef.current;
          if (node.type === "subsystem") {
            if (drag && drag.nodeId === node.id) {
              const dx = node.position.x - drag.startX;
              const dy = node.position.y - drag.startY;
              const updates = Array.from(drag.members.entries()).map(
                ([id, origin]) => ({
                  id,
                  position: { x: origin.x + dx, y: origin.y + dy },
                }),
              );
              groupDragRef.current = null;
              if (updates.length > 0) {
                onMoveNodes(updates);
              }
            }
            return;
          }
          onMoveNode(node.id, node.position);
        }}
        onNodeClick={(_, node) => onSelect(node.id, null)}
        onNodeDoubleClick={(_, node) => setEditingId(node.id)}
        onEdgeClick={(_, edge) => onSelect(null, edge.id)}
        onPaneClick={() => onSelect(null, null)}
        onNodesDelete={(deleted) =>
          deleted.forEach((node) => onDeleteNode(node.id))
        }
        onEdgesDelete={(deleted) =>
          deleted.forEach((edge) => onDeleteEdge(edge.id))
        }
        fitView
        minZoom={0.2}
        maxZoom={1.75}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {project.nodes.length === 0 ? (
        <div className="architect-canvas-hint" aria-hidden="true">
          <strong>Start your architecture</strong>
          <p>
            Drag a block from the palette onto the canvas, or click one to add
            it. Connect blocks by dragging between their handles.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ArchitectCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
