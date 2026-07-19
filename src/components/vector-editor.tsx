"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EditorTabs, tabPanelProps } from "@/components/editor-tabs";
import {
  ToolSaveStateChip,
  ToolSubbar,
  ToolSubbarActions,
  ToolSubbarTitle,
} from "@/components/tool-subbar";
import { VectorCanvas } from "@/components/vector-editor-canvas";
import { VectorLayers } from "@/components/vector-editor-layers";
import { VectorProperties } from "@/components/vector-editor-properties";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { useUndoableState } from "@/hooks/use-undoable-state";
import { downloadBlob, downloadTextFile } from "@/lib/browser-download";
import {
  addObject,
  createShape,
  moveObject,
  patchObject,
  removeObject,
  updateObject,
} from "@/lib/vector-editor/document";
import { loadProject, saveProject } from "@/lib/vector-editor/project-io";
import { rasterizePng, serializeSvg } from "@/lib/vector-editor/svg-export";
import {
  createEmptyDocument,
  type VectorDocument,
  type VectorObject,
} from "@/lib/vector-editor/types";
import {
  VECTOR_TOOLS,
  VECTOR_TOOL_BY_SHORTCUT,
  type VectorToolId,
} from "@/lib/vector-editor/tools";

type DockTab = "design" | "layers";

const DOCK_TABS = [
  { id: "design", label: "Design" },
  { id: "layers", label: "Layers" },
];

const HISTORY_LIMIT = 100;

export function VectorEditor() {
  const [doc, setDoc] = useState<VectorDocument>(createEmptyDocument);
  const [tool, setTool] = useState<VectorToolId>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dockTab, setDockTab] = useState<DockTab>("design");
  const [zoom, setZoom] = useState(1);

  const statusTarget = usePortalTarget("app-statusbar-slot");
  const selectedObject =
    doc.objects.find((object) => object.id === selectedId) ?? null;
  const objectCount = doc.objects.length;

  const applySnapshot = useCallback(
    (snapshot: VectorDocument) => setDoc(snapshot),
    [],
  );

  // Memoized so useLocalDraft's restore effect runs ONCE. An inline callback is
  // a new identity every render, which re-runs restore continuously and clobbers
  // live edits with the last-saved snapshot (the hook docs call for memoized
  // adapters for exactly this reason).
  const restore = useCallback(
    ({ isCancelled }: { isCancelled: () => boolean }) => {
      const loaded = loadProject();
      if (isCancelled()) return null;
      if (loaded) {
        setDoc(loaded.doc);
        return { status: "saved" as const, savedAt: loaded.savedAt };
      }
      return { status: "saved" as const, savedAt: null };
    },
    [],
  );
  const save = useCallback(
    (value: VectorDocument, savedAt: Date) => saveProject(value, savedAt),
    [],
  );
  const persistence = useLocalDraft<VectorDocument>({
    value: doc,
    restore,
    save,
    debounceMs: 600,
  });

  const history = useUndoableState<VectorDocument>({
    value: doc,
    applySnapshot,
    limit: HISTORY_LIMIT,
    enabled: persistence.ready,
  });

  // Every mutation goes through commit: it checkpoints the pre-mutation
  // document, then applies. A `tag` coalesces consecutive edits into one undo
  // step (a whole move/resize drag, or a run of property tweaks on one object).
  const { checkpoint, seal } = history;
  const commit = useCallback(
    (mutator: (document: VectorDocument) => VectorDocument, tag?: string) => {
      checkpoint(tag);
      setDoc((current) => mutator(current));
    },
    [checkpoint],
  );

  function handleDraw(object: VectorObject) {
    commit((current) => addObject(current, object));
  }

  function handleTransform(object: VectorObject) {
    commit(
      (current) => updateObject(current, object.id, () => object),
      `xf:${object.id}`,
    );
  }

  function handleUpdateObject(object: VectorObject) {
    commit(
      (current) => updateObject(current, object.id, () => object),
      `prop:${object.id}`,
    );
  }

  function handleToggleHidden(id: string) {
    commit((current) => {
      const target = current.objects.find((object) => object.id === id);
      return target
        ? patchObject(current, id, { hidden: !target.hidden })
        : current;
    });
  }

  function handleToggleLocked(id: string) {
    commit((current) => {
      const target = current.objects.find((object) => object.id === id);
      return target
        ? patchObject(current, id, { locked: !target.locked })
        : current;
    });
  }

  function handleMove(id: string, delta: number) {
    commit((current) => moveObject(current, id, delta));
  }

  function handleDelete(id: string) {
    commit((current) => removeObject(current, id));
    setSelectedId((current) => (current === id ? null : current));
  }

  function exportSvg() {
    downloadTextFile(
      "vector-artboard.svg",
      serializeSvg(doc),
      "image/svg+xml",
    );
  }

  async function exportPng() {
    try {
      const blob = await rasterizePng(doc);
      downloadBlob("vector-artboard.png", blob);
    } catch {
      // Rasterization is best-effort; the SVG export is always available.
    }
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (modifier && key === "y") {
        event.preventDefault();
        history.redo();
        return;
      }
      if (modifier || event.altKey) return;

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        commit((current) => removeObject(current, selectedId));
        setSelectedId(null);
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      // Enter drops a default-size shape at the artboard center — a full
      // keyboard/no-drag path to create objects (the shape tools otherwise
      // only draw by dragging). Switches to Select so it's ready to adjust.
      if (event.key === "Enter" && tool !== "select") {
        event.preventDefault();
        const cx = doc.width / 2;
        const cy = doc.height / 2;
        const shape = createShape(
          tool,
          { x: cx - 40, y: cy - 30 },
          { x: cx + 40, y: cy + 30 },
          doc.objects,
        );
        commit((current) => addObject(current, shape));
        setSelectedId(shape.id);
        setTool("select");
        return;
      }
      const shortcut = VECTOR_TOOL_BY_SHORTCUT[key];
      if (shortcut) setTool(shortcut);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, tool, doc, commit, history]);

  const statusBar = (
    <div className="vector-editor-statusbar">
      <span className="ve-status-zoom" role="status">
        {Math.round(zoom * 100)}%
      </span>
      <span className="ve-status-dims">
        {doc.width} × {doc.height}
      </span>
      <span className="ve-status-count">
        {objectCount} object{objectCount === 1 ? "" : "s"}
      </span>
    </div>
  );

  return (
    <div className="tool-page vector-editor-page">
      <ToolSubbar className="vector-editor-subbar">
        <ToolSubbarTitle kicker="Vector Editor" heading="Draw with vectors.">
          <ToolSaveStateChip
            status={persistence.status}
            lastSavedAt={persistence.lastSavedAt}
          />
        </ToolSubbarTitle>
        <ToolSubbarActions>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => history.undo()}
            disabled={!history.canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => history.redo()}
            disabled={!history.canRedo}
          >
            Redo
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={exportSvg}
            disabled={objectCount === 0}
          >
            SVG
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={exportPng}
            disabled={objectCount === 0}
          >
            PNG
          </button>
        </ToolSubbarActions>
      </ToolSubbar>

      {statusTarget ? createPortal(statusBar, statusTarget) : null}

      <div className="vector-editor-layout">
        <div
          className="vector-editor-toolstrip"
          role="toolbar"
          aria-label="Vector tools"
          aria-orientation="vertical"
        >
          {VECTOR_TOOLS.map((def) => (
            <button
              key={def.id}
              type="button"
              className={
                tool === def.id
                  ? "vector-editor-tool is-active"
                  : "vector-editor-tool"
              }
              aria-pressed={tool === def.id}
              title={`${def.label} (${def.shortcut}) — ${def.hint}`}
              aria-label={`${def.label} (${def.shortcut})`}
              onClick={() => setTool(def.id)}
            >
              <span aria-hidden="true">{def.glyph}</span>
            </button>
          ))}
        </div>

        <VectorCanvas
          doc={doc}
          tool={tool}
          selectedId={selectedId}
          onDraw={handleDraw}
          onSelect={setSelectedId}
          onTransform={handleTransform}
          onTransformEnd={seal}
          onZoom={setZoom}
        />

        <aside className="vector-editor-dock" aria-label="Editor panels">
          <EditorTabs
            tabs={DOCK_TABS}
            active={dockTab}
            onChange={(id) => setDockTab(id as DockTab)}
            idBase="ve-dock"
            label="Editor panels"
          />
          {dockTab === "design" ? (
            <div
              {...tabPanelProps("ve-dock", "design")}
              className="vector-editor-dock-panel"
            >
              <VectorProperties
                object={selectedObject}
                doc={doc}
                onUpdate={handleUpdateObject}
              />
            </div>
          ) : (
            <div
              {...tabPanelProps("ve-dock", "layers")}
              className="vector-editor-dock-panel"
            >
              <VectorLayers
                objects={doc.objects}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggleHidden={handleToggleHidden}
                onToggleLocked={handleToggleLocked}
                onMove={handleMove}
                onDelete={handleDelete}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
