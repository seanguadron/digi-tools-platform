"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ARCHITECT_BLOCK_MIME,
  ArchitectCanvas,
} from "@/components/architect-canvas";
import { ArchitectCommandPalette } from "@/components/architect-command-palette";
import { ArchitectInspector } from "@/components/architect-inspector";
import { ArchitectOutputDock } from "@/components/architect-output-dock";
import { useArchitectHistory } from "@/hooks/use-architect-history";
import { useArchitectPersistence } from "@/hooks/use-architect-persistence";
import { BLOCK_TYPES } from "@/lib/architect/blocks";
import {
  ARCHITECT_TEMPLATES,
  type ArchitectTemplate,
} from "@/lib/architect/templates";
import {
  buildArchitectureJson,
  buildArchitectureMarkdown,
} from "@/lib/architect-markdown";
import { computeReadiness } from "@/lib/architect/readiness";
import { layeredLayout } from "@/lib/architect/layout";
import {
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  type SavedArchitectTemplate,
} from "@/lib/architect/user-templates";
import {
  EMPTY_PROJECT,
  type ArchitectEdge,
  type ArchitectNode,
  type ArchitectProject,
  type BlockType,
  type DataField,
} from "@/lib/architect/types";
import { downloadTextFile } from "@/lib/browser-download";
import { makeId } from "@/lib/prompt-storage";

type SaveStatus = "restoring" | "saved" | "unavailable";

function getSaveStatusLabel(status: SaveStatus, lastSavedAt: Date | null) {
  if (status === "unavailable") {
    return "Local save unavailable";
  }
  if (status === "restoring") {
    return "Restoring...";
  }
  return lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Saved locally";
}

function fileSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "architecture";
}

function cloneProject(project: ArchitectProject): ArchitectProject {
  return JSON.parse(JSON.stringify(project)) as ArchitectProject;
}

export function ArchitectWizard() {
  const [project, setProject] = useState<ArchitectProject>(EMPTY_PROJECT);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [fitSignal, setFitSignal] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    n: number;
  } | null>(null);
  const [userTemplates, setUserTemplates] = useState<SavedArchitectTemplate[]>(
    [],
  );

  const persistence = useArchitectPersistence({ project, setProject });
  const history = useArchitectHistory({ project, setProject });

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const active = document.activeElement;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        // Let form fields keep their own native text undo.
        return;
      }
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
      if (!wantsUndo && !wantsRedo) {
        return;
      }
      event.preventDefault();
      if (wantsUndo) {
        history.undo();
      } else {
        history.redo();
      }
    }

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [history]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUserTemplates(listUserTemplates());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const subbarTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("app-subbar-slot");

  const selectedNode =
    project.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge =
    project.edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const markdown = useMemo(
    () => buildArchitectureMarkdown(project),
    [project],
  );
  const json = useMemo(() => buildArchitectureJson(project), [project]);
  const readiness = useMemo(() => computeReadiness(project), [project]);

  function selectElement(nodeId: string | null, edgeId: string | null) {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(edgeId);
  }

  function focusNode(id: string) {
    selectElement(id, null);
    setFocusRequest((current) => ({ id, n: (current?.n ?? 0) + 1 }));
  }

  function mapNode(id: string, change: (node: ArchitectNode) => ArchitectNode) {
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? change(node) : node)),
    }));
  }

  function addNode(type: BlockType, position?: { x: number; y: number }) {
    history.checkpoint();
    const id = makeId();
    const offset = project.nodes.length % 6;
    const pos = position ?? { x: 140 + offset * 36, y: 110 + offset * 30 };
    setProject((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id,
          type,
          name: "",
          goal: "",
          description: "",
          responsibilities: [],
          fields: [],
          dataNotes: "",
          notes: "",
          openQuestions: "",
          position: pos,
        },
      ],
    }));
    selectElement(id, null);
  }

  function updateNode(id: string, patch: Partial<ArchitectNode>) {
    history.checkpoint(`node:${id}:${Object.keys(patch).join(",")}`);
    mapNode(id, (node) => ({ ...node, ...patch }));
  }

  function moveNode(id: string, position: { x: number; y: number }) {
    history.checkpoint();
    mapNode(id, (node) => ({ ...node, position }));
  }

  function moveNodes(
    updates: Array<{ id: string; position: { x: number; y: number } }>,
  ) {
    if (updates.length === 0) {
      return;
    }
    history.checkpoint();
    const byId = new Map(updates.map((update) => [update.id, update.position]));
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const next = byId.get(node.id);
        return next ? { ...node, position: next } : node;
      }),
    }));
  }

  function deleteNode(id: string) {
    history.checkpoint();
    setProject((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter(
        (edge) => edge.source !== id && edge.target !== id,
      ),
    }));
    setSelectedNodeId((current) => (current === id ? null : current));
  }

  function connectNodes(source: string, target: string) {
    history.checkpoint();
    setProject((current) => {
      if (
        current.edges.some(
          (edge) => edge.source === source && edge.target === target,
        )
      ) {
        return current;
      }
      return {
        ...current,
        edges: [
          ...current.edges,
          { id: makeId(), source, target, kind: "uses" as const },
        ],
      };
    });
  }

  function updateEdge(id: string, patch: Partial<ArchitectEdge>) {
    history.checkpoint(`edge:${id}:${Object.keys(patch).join(",")}`);
    setProject((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.id === id ? { ...edge, ...patch } : edge,
      ),
    }));
  }

  function deleteEdge(id: string) {
    history.checkpoint();
    setProject((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== id),
    }));
    setSelectedEdgeId((current) => (current === id ? null : current));
  }

  function addField(nodeId: string) {
    history.checkpoint();
    mapNode(nodeId, (node) => ({
      ...node,
      fields: [
        ...node.fields,
        { id: makeId(), name: "", type: "", description: "" },
      ],
    }));
  }

  function updateField(
    nodeId: string,
    fieldId: string,
    patch: Partial<DataField>,
  ) {
    history.checkpoint(`field:${fieldId}:${Object.keys(patch).join(",")}`);
    mapNode(nodeId, (node) => ({
      ...node,
      fields: node.fields.map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field,
      ),
    }));
  }

  function deleteField(nodeId: string, fieldId: string) {
    history.checkpoint();
    mapNode(nodeId, (node) => ({
      ...node,
      fields: node.fields.filter((field) => field.id !== fieldId),
    }));
  }

  function assignNodeGroup(nodeId: string, groupId: string | undefined) {
    history.checkpoint();
    mapNode(nodeId, (node) => ({ ...node, groupId }));
  }

  function createGroupForNode(nodeId: string, name: string) {
    history.checkpoint();
    const id = makeId();
    setProject((current) => ({
      ...current,
      groups: [...current.groups, { id, name }],
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, groupId: id } : node,
      ),
    }));
  }

  function linkFieldRef(nodeId: string, fieldId: string, refId: string) {
    history.checkpoint();
    const refNode = project.nodes.find((node) => node.id === refId);
    const typeName = refNode?.name.trim() ?? "";
    setProject((current) => {
      const nodes = current.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              fields: node.fields.map((field) =>
                field.id === fieldId
                  ? { ...field, ref: refId, type: typeName || field.type }
                  : field,
              ),
            }
          : node,
      );
      const hasEdge = current.edges.some(
        (edge) =>
          edge.source === nodeId &&
          edge.target === refId &&
          edge.kind === "uses",
      );
      const edges =
        hasEdge || nodeId === refId
          ? current.edges
          : [
              ...current.edges,
              {
                id: makeId(),
                source: nodeId,
                target: refId,
                kind: "uses" as const,
              },
            ];
      return { ...current, nodes, edges };
    });
  }

  function addResponsibility(nodeId: string) {
    history.checkpoint();
    mapNode(nodeId, (node) => ({
      ...node,
      responsibilities: [...node.responsibilities, ""],
    }));
  }

  function updateResponsibility(nodeId: string, index: number, value: string) {
    history.checkpoint(`resp:${nodeId}:${index}`);
    mapNode(nodeId, (node) => ({
      ...node,
      responsibilities: node.responsibilities.map((item, i) =>
        i === index ? value : item,
      ),
    }));
  }

  function removeResponsibility(nodeId: string, index: number) {
    history.checkpoint();
    mapNode(nodeId, (node) => ({
      ...node,
      responsibilities: node.responsibilities.filter((_, i) => i !== index),
    }));
  }

  function loadTemplate(template: ArchitectTemplate) {
    if (
      typeof window !== "undefined" &&
      (project.nodes.length > 0 || project.systemName.trim().length > 0) &&
      !window.confirm(
        `Replace the current architecture with the ${template.label} example?`,
      )
    ) {
      return;
    }
    history.checkpoint();
    const base = cloneProject(template.project);
    const positions = layeredLayout(base);
    setProject({
      ...base,
      nodes: base.nodes.map((node) => {
        const next = positions[node.id];
        return next ? { ...node, position: next } : node;
      }),
    });
    selectElement(null, null);
    setOutputOpen(false);
    setFitSignal((value) => value + 1);
  }

  function saveCurrentAsTemplate() {
    if (typeof window === "undefined") {
      return;
    }
    const name = window.prompt("Name this template");
    if (!name || !name.trim()) {
      return;
    }
    setUserTemplates(saveUserTemplate(name.trim(), project));
  }

  function loadUserTemplate(entry: SavedArchitectTemplate) {
    if (
      typeof window !== "undefined" &&
      (project.nodes.length > 0 || project.systemName.trim().length > 0) &&
      !window.confirm(`Replace the current architecture with "${entry.name}"?`)
    ) {
      return;
    }
    history.checkpoint();
    setProject(cloneProject(entry.project));
    selectElement(null, null);
    setOutputOpen(false);
    setFitSignal((value) => value + 1);
  }

  function removeUserTemplate(id: string) {
    setUserTemplates(deleteUserTemplate(id));
  }

  function autoLayout() {
    if (project.nodes.length === 0) {
      return;
    }
    history.checkpoint();
    const positions = layeredLayout(project);
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const next = positions[node.id];
        return next ? { ...node, position: next } : node;
      }),
    }));
    setFitSignal((value) => value + 1);
  }

  function resetProject() {
    if (
      typeof window !== "undefined" &&
      project.nodes.length > 0 &&
      !window.confirm("Clear the whole architecture and start over?")
    ) {
      return;
    }
    history.checkpoint();
    setProject(EMPTY_PROJECT);
    selectElement(null, null);
    setOutputOpen(false);
  }

  function downloadMarkdown() {
    downloadTextFile(
      `${fileSlug(project.systemName)}.md`,
      markdown,
      "text/markdown;charset=utf-8",
    );
  }

  function downloadJson() {
    downloadTextFile(
      `${fileSlug(project.systemName)}.json`,
      json,
      "application/json;charset=utf-8",
    );
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("error");
    }
  }

  const header = (
    <div className="prompt-subbar architect-subbar" data-component="Header:Tool">
      <div className="prompt-flow-title">
        <span className="tool-kicker">Architect Wizard</span>
        <h1>{project.systemName.trim() || "Design a system."}</h1>
        <span
          className={
            persistence.status === "unavailable"
              ? "builder-save-state is-unavailable"
              : "builder-save-state"
          }
          role="status"
        >
          {getSaveStatusLabel(persistence.status, persistence.lastSavedAt)}
        </span>
      </div>

      <div
        className="architect-template-picker"
        role="group"
        aria-label="Load an example"
      >
        <span className="architect-template-label">Examples</span>
        {ARCHITECT_TEMPLATES.map((template) => (
          <button
            className="architect-template-button"
            type="button"
            onClick={() => loadTemplate(template)}
            key={template.id}
          >
            {template.label}
          </button>
        ))}
        {userTemplates.map((entry) => (
          <span className="architect-user-template" key={entry.id}>
            <button
              className="architect-template-button"
              type="button"
              onClick={() => loadUserTemplate(entry)}
            >
              {entry.name}
            </button>
            <button
              className="architect-user-template-remove"
              type="button"
              aria-label={`Delete ${entry.name}`}
              onClick={() => removeUserTemplate(entry.id)}
            >
              ×
            </button>
          </span>
        ))}
        <button
          className="architect-template-button architect-template-save"
          type="button"
          onClick={saveCurrentAsTemplate}
          disabled={project.nodes.length === 0}
        >
          + Save as…
        </button>
      </div>

      <div className="prompt-flow-header-actions">
        <button
          className="button button-quiet"
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Find or add a component (Ctrl/Cmd+K)"
        >
          Find
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={() => history.undo()}
          disabled={!history.canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={() => history.redo()}
          disabled={!history.canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={autoLayout}
          disabled={project.nodes.length === 0}
          title="Auto-arrange components by dependency"
        >
          Tidy
        </button>
        {project.nodes.length > 0 ? (
          <button
            className={
              readiness.length > 0
                ? "architect-readiness-chip has-issues"
                : "architect-readiness-chip is-ready"
            }
            type="button"
            onClick={() => selectElement(null, null)}
            title="Show readiness details in the inspector"
          >
            {readiness.length > 0
              ? `${readiness.length} to resolve`
              : "Ready to build"}
          </button>
        ) : null}
        <button
          className="button button-primary"
          type="button"
          onClick={() => setOutputOpen(true)}
        >
          Build brief
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={resetProject}
        >
          Reset
        </button>
      </div>
    </div>
  );

  return (
    <div className="tool-page architect-page">
      {subbarTarget ? createPortal(header, subbarTarget) : null}

      <div className="architect-layout">
        <aside className="architect-palette" aria-label="Component blocks">
          <div className="architect-palette-heading">
            <span>Blocks</span>
            <strong>Drag or click to add</strong>
          </div>
          <div className="architect-palette-list">
            {BLOCK_TYPES.map((block) => (
              <button
                className="architect-palette-block"
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(ARCHITECT_BLOCK_MIME, block.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addNode(block.id)}
                title={block.blurb}
                key={block.id}
              >
                <span
                  className="architect-palette-glyph"
                  style={{ color: block.accent }}
                  aria-hidden="true"
                >
                  {block.glyph}
                </span>
                <strong>{block.label}</strong>
                <small>{block.blurb}</small>
              </button>
            ))}
          </div>
        </aside>

        <ArchitectCanvas
          project={project}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onAddNode={addNode}
          onMoveNode={moveNode}
          onMoveNodes={moveNodes}
          onConnectNodes={connectNodes}
          onSelect={selectElement}
          onDeleteNode={deleteNode}
          onDeleteEdge={deleteEdge}
          onRenameNode={(id, name) => updateNode(id, { name })}
          fitSignal={fitSignal}
          focusRequest={focusRequest}
        />

        <ArchitectInspector
          systemName={project.systemName}
          systemGoal={project.systemGoal}
          nodes={project.nodes}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onSystemNameChange={(value) => {
            history.checkpoint("sys:name");
            setProject((current) => ({ ...current, systemName: value }));
          }}
          onSystemGoalChange={(value) => {
            history.checkpoint("sys:goal");
            setProject((current) => ({ ...current, systemGoal: value }));
          }}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          onAddResponsibility={addResponsibility}
          onUpdateResponsibility={updateResponsibility}
          onRemoveResponsibility={removeResponsibility}
          onAddField={addField}
          onUpdateField={updateField}
          onDeleteField={deleteField}
          onUpdateEdge={updateEdge}
          onDeleteEdge={deleteEdge}
          readiness={readiness}
          onFocusNode={(id) => selectElement(id, null)}
          onLinkFieldRef={linkFieldRef}
          groups={project.groups}
          onAssignGroup={assignNodeGroup}
          onCreateGroup={createGroupForNode}
        />
      </div>

      <ArchitectOutputDock
        open={outputOpen}
        markdown={markdown}
        json={json}
        copyState={copyState}
        onClose={() => setOutputOpen(false)}
        onCopy={copyMarkdown}
        onDownloadMarkdown={downloadMarkdown}
        onDownloadJson={downloadJson}
      />

      {paletteOpen ? (
        <ArchitectCommandPalette
          nodes={project.nodes}
          onClose={() => setPaletteOpen(false)}
          onSelectNode={focusNode}
          onAddBlock={(type) => addNode(type)}
        />
      ) : null}
    </div>
  );
}
