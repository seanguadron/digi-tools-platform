"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EditorMenubar } from "@/components/editor-menubar";
import { EditorTabs, tabPanelProps } from "@/components/editor-tabs";
import {
  ToolSaveStateChip,
  ToolSubbar,
  ToolSubbarActions,
} from "@/components/tool-subbar";
import {
  VectorDocSetupDialog,
  type DocSetupValue,
} from "@/components/vector-editor-docsetup-dialog";
import {
  VectorExportDialog,
  type VectorExportOptions,
} from "@/components/vector-editor-export-dialog";
import {
  VectorCanvas,
  type AnchorSelection,
  type TextCommit,
} from "@/components/vector-editor-canvas";
import { VectorLayers } from "@/components/vector-editor-layers";
import { VectorProperties } from "@/components/vector-editor-properties";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { useUndoableState } from "@/hooks/use-undoable-state";
import {
  downloadBlob,
  downloadTextFile,
  slugifyFilename,
} from "@/lib/browser-download";
import { roundForUnit, fromPx } from "@/lib/units";
import { applyAnchorType, removeAnchors } from "@/lib/vector-editor/bezier";
import {
  addObject,
  createShape,
  moveObject,
  patchObject,
  removeObject,
  updateObject,
} from "@/lib/vector-editor/document";
import {
  convertToPath,
  createPathObject,
  isConvertibleToPath,
  minAnchorCount,
  withAnchors,
} from "@/lib/vector-editor/paths";
import {
  createTextObject,
  withMeasuredText,
} from "@/lib/vector-editor/text-measure";
import {
  loadDocName,
  loadProject,
  saveDocName,
  saveProject,
} from "@/lib/vector-editor/project-io";
import {
  rasterizeBitmap,
  serializeSvg,
} from "@/lib/vector-editor/svg-export";
import { translateObject } from "@/lib/vector-editor/transform";
import {
  createEmptyDocument,
  type PathAnchor,
  type AnchorType,
  type VectorDocument,
  type VectorObject,
} from "@/lib/vector-editor/types";
import {
  isDragShapeTool,
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorSelection, setAnchorSelection] =
    useState<AnchorSelection | null>(null);
  const [dockTab, setDockTab] = useState<DockTab>("design");
  const [zoom, setZoom] = useState(1);
  const [docName, setDocName] = useState("Untitled");
  const [docSetupOpen, setDocSetupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const statusTarget = usePortalTarget("app-statusbar-slot");
  const selectedObjects = doc.objects.filter((object) =>
    selectedIds.includes(object.id),
  );
  const soleSelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
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
      setDocName(loadDocName());
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

  // Selection state may hold ids/indices that no longer exist after an undo
  // or delete — every consumer filters against the live document instead of
  // pruning state in an effect (which would cascade renders).
  function liveAnchorIndices(target: { anchors: unknown[] }): number[] {
    if (!anchorSelection) return [];
    return anchorSelection.indices.filter(
      (index) => index < target.anchors.length,
    );
  }

  function selectOnly(id: string | null) {
    setSelectedIds(id ? [id] : []);
    setAnchorSelection(null);
  }

  function handleDraw(object: VectorObject) {
    commit((current) => addObject(current, object));
    selectOnly(object.id);
  }

  function handleCreatePath(anchors: PathAnchor[], closed: boolean) {
    const object = createPathObject(anchors, closed, doc.objects);
    commit((current) => addObject(current, object));
    setSelectedIds([object.id]);
    setAnchorSelection(null);
  }

  function handleTransform(object: VectorObject) {
    commit(
      (current) => updateObject(current, object.id, () => object),
      `xf:${object.id}`,
    );
  }

  function handleTransformMany(objects: VectorObject[]) {
    commit(
      (current) =>
        objects.reduce(
          (acc, object) => updateObject(acc, object.id, () => object),
          current,
        ),
      "xf:multi",
    );
  }

  function handleEditPath(object: VectorObject) {
    commit(
      (current) => updateObject(current, object.id, () => object),
      `path:${object.id}`,
    );
  }

  function handleUpdateObject(object: VectorObject) {
    // Text extents track content and font — re-stamp on every property edit.
    const next = object.kind === "text" ? withMeasuredText(object) : object;
    commit(
      (current) => updateObject(current, next.id, () => next),
      `prop:${next.id}`,
    );
  }

  function handleCommitText(edit: TextCommit) {
    const value = edit.value.trim();
    if (edit.id) {
      const target = doc.objects.find((object) => object.id === edit.id);
      if (!target || target.kind !== "text") return;
      if (value.length === 0) {
        // Emptied out in the editor = deleted, like every pro editor.
        commit((current) => removeObject(current, target.id));
        selectOnly(null);
        return;
      }
      commit(
        (current) =>
          updateObject(current, target.id, () =>
            withMeasuredText({ ...target, text: edit.value }),
          ),
        `text:${target.id}`,
      );
      return;
    }
    if (value.length === 0) return;
    const object = createTextObject(edit.x, edit.y, edit.value, doc.objects);
    commit((current) => addObject(current, object));
    setSelectedIds([object.id]);
    setAnchorSelection(null);
  }

  function handleConvertToPath(id: string) {
    const target = doc.objects.find((object) => object.id === id);
    if (!target || !isConvertibleToPath(target)) return;
    commit((current) =>
      updateObject(current, id, (object) => convertToPath(object)),
    );
    setSelectedIds([id]);
    setAnchorSelection(null);
    setTool("direct");
  }

  function handleConvertSelectedToPath() {
    const convertible = selectedObjects.filter(isConvertibleToPath);
    if (convertible.length === 0) return;
    commit((current) =>
      convertible.reduce(
        (acc, target) =>
          updateObject(acc, target.id, (object) => convertToPath(object)),
        current,
      ),
    );
    setAnchorSelection(null);
  }

  function handleConvertAnchors(type: AnchorType) {
    if (!anchorSelection) return;
    const target = doc.objects.find(
      (object) => object.id === anchorSelection.objectId,
    );
    if (!target || target.kind !== "path") return;
    const anchors = liveAnchorIndices(target).reduce(
      (acc, index) => applyAnchorType(acc, index, type, target.closed),
      target.anchors,
    );
    commit(
      (current) =>
        updateObject(current, target.id, () => withAnchors(target, anchors)),
      `anchor-type:${target.id}`,
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

  function deleteSelection() {
    // Direct tool with anchors selected deletes the anchors; a path that
    // would fall below its minimum is removed whole.
    if (anchorSelection && tool === "direct") {
      const target = doc.objects.find(
        (object) => object.id === anchorSelection.objectId,
      );
      if (target && target.kind === "path") {
        const indices = liveAnchorIndices(target);
        if (indices.length === 0) {
          setAnchorSelection(null);
          return;
        }
        const remaining = target.anchors.length - indices.length;
        if (remaining < minAnchorCount(target.closed)) {
          commit((current) => removeObject(current, target.id));
          selectOnly(null);
        } else {
          const anchors = removeAnchors(target.anchors, indices);
          commit((current) =>
            updateObject(current, target.id, () =>
              withAnchors(target, anchors),
            ),
          );
          setAnchorSelection(null);
        }
        return;
      }
    }
    if (selectedIds.length === 0) return;
    commit((current) =>
      selectedIds.reduce((acc, id) => removeObject(acc, id), current),
    );
    selectOnly(null);
  }

  function nudgeSelection(dx: number, dy: number) {
    if (anchorSelection && tool === "direct") {
      const target = doc.objects.find(
        (object) => object.id === anchorSelection.objectId,
      );
      if (target && target.kind === "path") {
        const selectedSet = new Set(liveAnchorIndices(target));
        const anchors = target.anchors.map((anchor, index) =>
          selectedSet.has(index)
            ? {
                ...anchor,
                point: { x: anchor.point.x + dx, y: anchor.point.y + dy },
              }
            : anchor,
        );
        commit(
          (current) =>
            updateObject(current, target.id, () =>
              withAnchors(target, anchors),
            ),
          `nudge:${target.id}`,
        );
        return;
      }
    }
    if (selectedObjects.length === 0) return;
    commit(
      (current) =>
        selectedObjects.reduce(
          (acc, object) =>
            updateObject(acc, object.id, (live) =>
              translateObject(live, dx, dy),
            ),
          current,
        ),
      "nudge:objects",
    );
  }

  const fileBase = slugifyFilename(docName, "vector-artboard");

  function renameDoc(name: string) {
    setDocName(name);
    saveDocName(name);
  }

  function resizeArtboard(width: number, height: number) {
    const w = Math.min(20000, Math.max(1, Math.round(width)));
    const h = Math.min(20000, Math.max(1, Math.round(height)));
    commit((current) => ({ ...current, width: w, height: h }), "artboard");
  }

  function applyDocSetup(next: DocSetupValue) {
    // Same defensive clamp as resizeArtboard — never trust the caller's
    // gate alone.
    const width = Math.min(20000, Math.max(1, Math.round(next.width)));
    const height = Math.min(20000, Math.max(1, Math.round(next.height)));
    commit((current) => ({
      ...current,
      width,
      height,
      background: next.background,
      unit: next.unit,
      ppi: next.ppi,
    }));
    setDocSetupOpen(false);
  }

  function exportSvg() {
    downloadTextFile(`${fileBase}.svg`, serializeSvg(doc), "image/svg+xml");
  }

  async function runExport(options: VectorExportOptions) {
    setExportOpen(false);
    if (options.format === "svg") {
      exportSvg();
      return;
    }
    try {
      const blob = await rasterizeBitmap(doc, {
        format: options.format,
        scale: options.scale,
        transparent: options.transparent,
        quality: options.quality,
      });
      const extension = options.format === "jpeg" ? "jpg" : "png";
      downloadBlob(`${fileBase}.${extension}`, blob);
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

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedIds.length > 0 || anchorSelection) {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (event.key === "Escape") {
        if (anchorSelection) setAnchorSelection(null);
        else selectOnly(null);
        return;
      }
      if (event.key.startsWith("Arrow")) {
        if (selectedIds.length === 0 && !anchorSelection) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx =
          event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy =
          event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        nudgeSelection(dx, dy);
        return;
      }
      // Enter drops a default-size shape at the artboard center — a full
      // keyboard/no-drag path to create objects (the shape tools otherwise
      // only draw by dragging). Switches to Select so it's ready to adjust.
      // The pen handles its own Enter (finish path) in the canvas.
      if (event.key === "Enter" && isDragShapeTool(tool)) {
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
        selectOnly(shape.id);
        setTool("select");
        return;
      }
      const shortcut = VECTOR_TOOL_BY_SHORTCUT[key];
      if (shortcut) setTool(shortcut);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, anchorSelection, tool, doc, commit, history]);

  const convertibleSelected = selectedObjects.some(isConvertibleToPath);

  const menus = [
    {
      id: "file",
      label: "File",
      items: [
        {
          label: "Document setup…",
          onSelect: () => setDocSetupOpen(true),
        },
        { label: "", separator: true },
        {
          label: "Export…",
          onSelect: () => setExportOpen(true),
          disabled: objectCount === 0,
        },
        {
          label: "Export SVG",
          onSelect: exportSvg,
          disabled: objectCount === 0,
        },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        {
          label: "Undo",
          shortcut: "Ctrl+Z",
          onSelect: () => history.undo(),
          disabled: !history.canUndo,
        },
        {
          label: "Redo",
          shortcut: "Ctrl+Shift+Z",
          onSelect: () => history.redo(),
          disabled: !history.canRedo,
        },
        { label: "", separator: true },
        {
          label: "Delete",
          shortcut: "Del",
          onSelect: deleteSelection,
          disabled: selectedIds.length === 0 && !anchorSelection,
        },
      ],
    },
    {
      id: "object",
      label: "Object",
      items: [
        {
          label: "Convert to path",
          onSelect: handleConvertSelectedToPath,
          disabled: !convertibleSelected,
        },
        { label: "", separator: true },
        {
          label: "Raise",
          onSelect: () => soleSelected && handleMove(soleSelected.id, 1),
          disabled: !soleSelected,
        },
        {
          label: "Lower",
          onSelect: () => soleSelected && handleMove(soleSelected.id, -1),
          disabled: !soleSelected,
        },
      ],
    },
  ];

  const statusBar = (
    <div className="vector-editor-statusbar">
      <span className="ve-status-zoom" role="status">
        {Math.round(zoom * 100)}%
      </span>
      <span className="ve-status-dims">
        {doc.unit === "px"
          ? `${doc.width} × ${doc.height} px`
          : `${roundForUnit(fromPx(doc.width, doc.unit, doc.ppi), doc.unit)} × ${roundForUnit(fromPx(doc.height, doc.unit, doc.ppi), doc.unit)} ${doc.unit} @ ${doc.ppi}ppi`}
      </span>

      <span className="ve-status-count">
        {objectCount} object{objectCount === 1 ? "" : "s"}
      </span>
    </div>
  );

  return (
    <div className="tool-page vector-editor-page">
      <ToolSubbar className="vector-editor-subbar">
        <EditorMenubar menus={menus} label="Vector editor menu" />
        <input
          className="ve-title-input"
          value={docName}
          spellCheck={false}
          aria-label="Artwork name"
          onChange={(event) => renameDoc(event.target.value)}
        />
        <ToolSaveStateChip
          status={persistence.status}
          lastSavedAt={persistence.lastSavedAt}
        />
        <ToolSubbarActions>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setExportOpen(true)}
            disabled={objectCount === 0}
          >
            Export
          </button>
        </ToolSubbarActions>
      </ToolSubbar>

      <VectorDocSetupDialog
        open={docSetupOpen}
        value={{
          width: doc.width,
          height: doc.height,
          ppi: doc.ppi,
          unit: doc.unit,
          background: doc.background,
        }}
        onClose={() => setDocSetupOpen(false)}
        onApply={applyDocSetup}
      />

      <VectorExportDialog
        open={exportOpen}
        width={doc.width}
        height={doc.height}
        ppi={doc.ppi}
        unit={doc.unit}
        hasBackground={doc.background !== null}
        fileBase={fileBase}
        onClose={() => setExportOpen(false)}
        onExport={(options) => void runExport(options)}
      />

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
          selectedIds={selectedIds}
          anchorSelection={anchorSelection}
          onDraw={handleDraw}
          onCreatePath={handleCreatePath}
          onSelectIds={setSelectedIds}
          onAnchorSelection={setAnchorSelection}
          onTransform={handleTransform}
          onTransformMany={handleTransformMany}
          onEditPath={handleEditPath}
          onTransformEnd={seal}
          onConvertToPath={handleConvertToPath}
          onCommitText={handleCommitText}
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
                objects={selectedObjects}
                doc={doc}
                anchorSelection={anchorSelection}
                onUpdate={handleUpdateObject}
                onConvertToPath={handleConvertToPath}
                onConvertAnchors={handleConvertAnchors}
                onArtboardResize={resizeArtboard}
                onOpenDocSetup={() => setDocSetupOpen(true)}
              />
            </div>
          ) : (
            <div
              {...tabPanelProps("ve-dock", "layers")}
              className="vector-editor-dock-panel"
            >
              <VectorLayers
                objects={doc.objects}
                selectedIds={selectedIds}
                onSelect={selectOnly}
                onToggleHidden={handleToggleHidden}
                onToggleLocked={handleToggleLocked}
                onMove={handleMove}
                onDeleteSelected={deleteSelection}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
