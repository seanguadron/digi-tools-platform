"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageEditorCanvas } from "@/components/image-editor-canvas";
import { ImageEditorFilters } from "@/components/image-editor-filters";
import { ImageEditorHistory } from "@/components/image-editor-history";
import { ImageEditorImageSizeDialog } from "@/components/image-editor-imagesize-dialog";
import { ImageEditorLayers } from "@/components/image-editor-layers";
import { ImageEditorNewDialog } from "@/components/image-editor-new-dialog";
import { ImageEditorToolbar } from "@/components/image-editor-toolbar";
import { useCanvasViewport } from "@/hooks/use-canvas-viewport";
import { useImageEditorHistory } from "@/hooks/use-image-editor-history";
import { useImageEditorPersistence } from "@/hooks/use-image-editor-persistence";
import {
  downloadBlob,
  downloadTextFile,
  slugifyFilename,
} from "@/lib/browser-download";
import {
  activeLayerOf,
  addImageLayer,
  addLayer,
  commitLayerBitmap,
  commitPaintedBitmap,
  createDoc,
  createDocFromImage,
  deleteLayer,
  duplicateLayer,
  flattenDoc,
  flipDoc,
  mergeLayerDown,
  moveLayerToIndex,
  patchLayer,
  reorderLayer,
  resampleDoc,
  rotateDoc,
  setActiveLayer,
  setBlendMode,
  setSelection,
} from "@/lib/image-editor/document";
import { applyAdjustments } from "@/lib/image-editor/filters";
import {
  parseProjectJson,
  serializeDocJson,
} from "@/lib/image-editor/project-io";
import {
  cloneBitmap,
  composite,
  createBitmap,
  decodeImageFile,
  get2d,
} from "@/lib/image-editor/raster";
import {
  applySelectionClip,
  clearInSelection,
  extractSelection,
  featherSelection,
  invertSelection,
  resizeSelection,
  selectAll,
  strokeSelectionBitmap,
  translateSelection,
} from "@/lib/image-editor/selection";
import {
  DEFAULT_BRUSH,
  DEFAULT_GRADIENT,
  DEFAULT_SHAPE,
  DEFAULT_TEXT,
  toolForShortcut,
} from "@/lib/image-editor/tools";
import type {
  BrushSettings,
  GradientSettings,
  ShapeSettings,
  TextSettings,
  ToolId,
} from "@/lib/image-editor/tools";
import type { BlendMode, ImageDoc } from "@/lib/image-editor/types";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";

const IMAGE_LIMITS = {
  maxPixels: MAX_DOC_PIXELS,
  maxDimension: MAX_DOC_DIMENSION,
};

// Early reject an oversized .json project before reading it fully into memory.
const MAX_PROJECT_BYTES = 96_000_000;

function saveStatusLabel(
  status: "restoring" | "saved" | "large" | "unavailable",
  lastSavedAt: Date | null,
): string {
  if (status === "restoring") {
    return "Restoring…";
  }
  if (status === "unavailable") {
    return "Local save unavailable";
  }
  if (status === "large") {
    return "Too large to autosave — use Save";
  }
  return lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Saved locally";
}

export function ImageEditor() {
  const [doc, setDoc] = useState<ImageDoc | null>(null);
  const [tool, setTool] = useState<ToolId>("brush");
  const [color, setColor] = useState("#111111");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [activeSwatch, setActiveSwatch] = useState<"fg" | "bg">("fg");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [shape, setShape] = useState<ShapeSettings>(DEFAULT_SHAPE);
  const [text, setText] = useState<TextSettings>(DEFAULT_TEXT);
  const [gradient, setGradient] = useState<GradientSettings>(DEFAULT_GRADIENT);
  const [tolerance, setTolerance] = useState(32);
  const [imageSizeOpen, setImageSizeOpen] = useState(false);
  const clipboardRef = useRef<HTMLCanvasElement | null>(null);
  const [name, setName] = useState("Untitled");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [canvasMenuOpen, setCanvasMenuOpen] = useState(false);
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [grid, setGrid] = useState({ show: false, size: 32, snap: false });
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({
    x: [],
    y: [],
  });
  const [notice, setNotice] = useState<string | null>(null);

  const viewport = useCanvasViewport();
  const history = useImageEditorHistory({ doc, setDoc });
  const persistence = useImageEditorPersistence({ doc, setDoc, name, setName });
  const fitDimsRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  // Fit the document into the stage on first measure and whenever its
  // dimensions change (New / Open / Crop). Keyed on the size so ordinary edits
  // and pan/zoom don't refit.
  useEffect(() => {
    if (!doc || viewport.size.width < 2) {
      return;
    }
    const key = `${doc.width}x${doc.height}`;
    if (fitDimsRef.current !== key) {
      viewport.fit(doc.width, doc.height);
      fitDimsRef.current = key;
    }
  }, [doc, viewport]);

  const setDocOp = useCallback((op: (current: ImageDoc) => ImageDoc) => {
    setDoc((current) => (current ? op(current) : current));
  }, []);

  const commit = useCallback(
    (op: (current: ImageDoc) => ImageDoc, tag?: string) => {
      history.checkpoint(tag);
      setDocOp(op);
    },
    [history, setDocOp],
  );

  // The color picker edits whichever swatch (foreground/background) is active.
  const setActiveColor = useCallback(
    (hex: string) => {
      if (activeSwatch === "fg") {
        setColor(hex);
      } else {
        setBgColor(hex);
      }
    },
    [activeSwatch],
  );
  const swapColors = useCallback(() => {
    setColor(bgColor);
    setBgColor(color);
  }, [color, bgColor]);
  const resetColors = useCallback(() => {
    setColor("#000000");
    setBgColor("#ffffff");
  }, []);

  // Track recently used foreground colors (added once the value settles).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecentColors((prev) => [color, ...prev.filter((c) => c !== color)].slice(0, 12));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [color]);

  // Fill the active layer (or selection) with a solid color.
  const fillActive = useCallback(
    (hex: string) => {
      commit((current) => {
        const layer = activeLayerOf(current);
        if (!layer) {
          return current;
        }
        const filled = createBitmap(current.width, current.height);
        const ctx = get2d(filled);
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, current.width, current.height);
        return commitPaintedBitmap(current, current.activeLayerId, filled);
      });
    },
    [commit],
  );

  // Copy the selected pixels (or whole layer) to an in-app clipboard.
  const copyToClipboard = useCallback(() => {
    if (!doc) {
      return;
    }
    const layer = activeLayerOf(doc);
    if (!layer) {
      return;
    }
    clipboardRef.current = doc.selection
      ? extractSelection(layer.bitmap, doc.selection)
      : cloneBitmap(layer.bitmap);
  }, [doc]);

  const cutToClipboard = useCallback(() => {
    copyToClipboard();
    commit((current) => {
      const layer = activeLayerOf(current);
      if (!layer) {
        return current;
      }
      const cleared = current.selection
        ? clearInSelection(layer.bitmap, current.selection)
        : createBitmap(current.width, current.height);
      return commitLayerBitmap(current, current.activeLayerId, cleared);
    });
  }, [copyToClipboard, commit]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (clip) {
      commit((current) => addImageLayer(current, clip, "Pasted"));
    }
  }, [commit]);

  const nudgeActive = useCallback(
    (dx: number, dy: number) => {
      const selectionTool =
        tool === "select-rect" ||
        tool === "select-ellipse" ||
        tool === "select-lasso" ||
        tool === "magic-wand";
      commit((current) => {
        if (selectionTool && current.selection) {
          return setSelection(
            current,
            translateSelection(
              current.selection,
              dx,
              dy,
              current.width,
              current.height,
            ),
          );
        }
        const layer = activeLayerOf(current);
        if (!layer) {
          return current;
        }
        const shifted = createBitmap(current.width, current.height);
        get2d(shifted).drawImage(layer.bitmap, dx, dy);
        return commitLayerBitmap(current, current.activeLayerId, shifted);
      }, "nudge");
    },
    [commit, tool],
  );

  const flipCanvas = useCallback(
    (axis: "horizontal" | "vertical") => commit((c) => flipDoc(c, axis)),
    [commit],
  );
  const rotateCanvas = useCallback(
    (dir: "cw" | "ccw") => {
      commit((c) => rotateDoc(c, dir));
      fitDimsRef.current = "";
    },
    [commit],
  );
  const applyImageSize = useCallback(
    (width: number, height: number) => {
      commit((c) => resampleDoc(c, width, height));
      fitDimsRef.current = "";
      setImageSizeOpen(false);
    },
    [commit],
  );

  type SelectAction =
    | "deselect"
    | "invert"
    | "feather"
    | "grow"
    | "shrink"
    | "stroke";
  const selectAction = useCallback(
    (action: SelectAction) => {
      commit(
        (d) => {
          if (action === "deselect") {
            return setSelection(d, null);
          }
          if (!d.selection) {
            return d;
          }
          if (action === "invert") {
            return setSelection(d, invertSelection(d.selection, d.width, d.height));
          }
          if (action === "feather") {
            return setSelection(
              d,
              featherSelection(d.selection, 4, d.width, d.height),
            );
          }
          if (action === "grow") {
            return setSelection(
              d,
              resizeSelection(d.selection, 2, d.width, d.height),
            );
          }
          if (action === "shrink") {
            return setSelection(
              d,
              resizeSelection(d.selection, -2, d.width, d.height),
            );
          }
          // stroke the selection edge onto the active layer with the fg color.
          // The ring straddles the boundary, so we don't clip to the selection
          // (clipToSelection: false) — but a transparency-locked layer still
          // confines the stroke to its existing pixels, via commitPaintedBitmap.
          const layer = activeLayerOf(d);
          if (!layer) {
            return d;
          }
          const ring = strokeSelectionBitmap(d.selection, color, 4, d.width, d.height);
          const working = cloneBitmap(layer.bitmap);
          working.getContext("2d")?.drawImage(ring, 0, 0);
          return commitPaintedBitmap(d, d.activeLayerId, working, false);
        },
        action === "stroke" ? undefined : "select",
      );
      setSelectMenuOpen(false);
    },
    [commit, color],
  );

  // Global keyboard: undo/redo, tool + pro shortcuts, fills, nudge, colors.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A dropdown owns the keyboard while open (Escape closes it).
      if (canvasMenuOpen || selectMenuOpen || viewMenuOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          if (canvasMenuOpen) {
            setCanvasMenuOpen(false);
            canvasMenuButtonRef.current?.focus();
          }
          if (selectMenuOpen) {
            setSelectMenuOpen(false);
            selectMenuButtonRef.current?.focus();
          }
          if (viewMenuOpen) {
            setViewMenuOpen(false);
            viewMenuButtonRef.current?.focus();
          }
        }
        return;
      }
      // A modal owns the keyboard while it's open.
      if (newDialogOpen || filtersOpen || imageSizeOpen) {
        return;
      }
      const el = document.activeElement;
      const tag = el?.tagName;
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el instanceof HTMLElement && el.isContentEditable);

      // Fill: Alt+Backspace = foreground, Ctrl/Cmd+Backspace = background.
      if (!inField && (event.key === "Backspace" || event.key === "Delete")) {
        if (event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          fillActive(color);
          return;
        }
        if ((event.ctrlKey || event.metaKey) && !event.altKey) {
          event.preventDefault();
          fillActive(bgColor);
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (inField) {
          return;
        }
        const key = event.key.toLowerCase();
        const shift = event.shiftKey;
        if (key === "a") {
          event.preventDefault();
          commit((d) => setSelection(d, selectAll(d.width, d.height)), "select");
        } else if (key === "d") {
          event.preventDefault();
          commit((d) => setSelection(d, null), "select");
        } else if (key === "i" && shift) {
          event.preventDefault();
          commit(
            (d) =>
              d.selection
                ? setSelection(d, invertSelection(d.selection, d.width, d.height))
                : d,
            "select",
          );
        } else if (key === "c") {
          event.preventDefault();
          copyToClipboard();
        } else if (key === "x") {
          event.preventDefault();
          cutToClipboard();
        } else if (key === "v") {
          event.preventDefault();
          pasteClipboard();
        } else if (key === "j") {
          event.preventDefault();
          commit((d) => duplicateLayer(d, d.activeLayerId));
        } else if (key === "n" && shift) {
          event.preventDefault();
          commit((d) => addLayer(d));
        } else if (key === "e" && shift) {
          event.preventDefault();
          commit((d) => flattenDoc(d));
        } else if (key === "e") {
          event.preventDefault();
          commit((d) => mergeLayerDown(d, d.activeLayerId));
        } else if (key === "0" && doc) {
          event.preventDefault();
          viewport.fit(doc.width, doc.height);
        } else if (key === "1") {
          event.preventDefault();
          viewport.zoomTo(1);
        } else if (key === "z" && !shift) {
          event.preventDefault();
          history.undo();
        } else if (key === "y" || (key === "z" && shift)) {
          event.preventDefault();
          history.redo();
        }
        return;
      }

      if (event.altKey || inField) {
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeActive(-step, 0);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeActive(step, 0);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeActive(0, -step);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeActive(0, step);
        return;
      }

      // Delete / Backspace clears the selected pixels.
      if (event.key === "Delete" || event.key === "Backspace") {
        if (doc?.selection) {
          event.preventDefault();
          commit((d) => {
            const layer = activeLayerOf(d);
            if (!layer || !d.selection) {
              return d;
            }
            return commitLayerBitmap(
              d,
              d.activeLayerId,
              clearInSelection(layer.bitmap, d.selection),
            );
          });
        }
        return;
      }

      // Brush size.
      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const up = event.key === "]";
        setBrush((b) => {
          const stepPx = Math.max(1, Math.round(b.size * 0.15));
          return {
            ...b,
            size: Math.min(400, Math.max(1, b.size + (up ? stepPx : -stepPx))),
          };
        });
        return;
      }

      // Color swap / reset (Photoshop's X / D).
      if (event.key === "x" || event.key === "X") {
        event.preventDefault();
        swapColors();
        return;
      }
      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        resetColors();
        return;
      }

      const next = toolForShortcut(event.key);
      if (next) {
        event.preventDefault();
        setTool(next);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    history,
    doc,
    commit,
    newDialogOpen,
    filtersOpen,
    imageSizeOpen,
    canvasMenuOpen,
    selectMenuOpen,
    viewMenuOpen,
    color,
    bgColor,
    viewport,
    fillActive,
    copyToClipboard,
    cutToClipboard,
    pasteClipboard,
    nudgeActive,
    swapColors,
    resetColors,
  ]);

  const exportPng = useCallback(() => {
    if (!doc) {
      return;
    }
    const flat = composite(doc);
    flat.toBlob((blob) => {
      if (blob) {
        downloadBlob(`${slugifyFilename(name)}.png`, blob);
      }
    }, "image/png");
  }, [doc, name]);

  const exportJpeg = useCallback(() => {
    if (!doc) {
      return;
    }
    const flat = composite(doc);
    flat.toBlob(
      (blob) => {
        if (blob) {
          downloadBlob(`${slugifyFilename(name)}.jpg`, blob);
        }
      },
      "image/jpeg",
      0.92,
    );
  }, [doc, name]);

  const saveProject = useCallback(() => {
    if (!doc) {
      return;
    }
    downloadTextFile(
      `${slugifyFilename(name)}.json`,
      serializeDocJson(doc, name),
      "application/json;charset=utf-8",
    );
  }, [doc, name]);

  const openProjectFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_PROJECT_BYTES) {
        setNotice("That project file is too large to open.");
        return;
      }
      let result: Awaited<ReturnType<typeof parseProjectJson>> = null;
      try {
        result = await parseProjectJson(await file.text());
      } catch {
        result = null;
      }
      if (!result) {
        setNotice("That project file could not be read.");
        return;
      }
      history.reset();
      fitDimsRef.current = "";
      setDoc(result.doc);
      setName(result.name);
      setNotice(null);
    },
    [history],
  );

  const createSizedDoc = useCallback(
    (width: number, height: number) => {
      history.reset();
      fitDimsRef.current = "";
      setDoc(createDoc(width, height));
      setName("Untitled");
      setNewDialogOpen(false);
      setNotice(null);
    },
    [history],
  );

  // Open an image as a brand-new document sized to the image.
  const openImageFile = useCallback(
    async (file: File) => {
      const result = await decodeImageFile(file, IMAGE_LIMITS);
      if ("error" in result) {
        setNotice(result.error);
        return;
      }
      history.reset();
      fitDimsRef.current = "";
      setDoc(createDocFromImage(result.bitmap, result.width, result.height));
      setName(file.name.replace(/\.[^.]+$/, "") || "Image");
      setNotice(null);
    },
    [history],
  );

  // Drop an image onto the canvas to place it as a new layer.
  const placeImageFiles = useCallback(
    async (files: FileList) => {
      const file = Array.from(files).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!file) {
        return;
      }
      const result = await decodeImageFile(file, IMAGE_LIMITS);
      if ("error" in result) {
        setNotice(result.error);
        return;
      }
      const label = file.name.replace(/\.[^.]+$/, "") || "Image";
      commit((current) => addImageLayer(current, result.bitmap, label));
      setNotice(null);
    },
    [commit],
  );

  const zoomPct = Math.round(viewport.view.scale * 100);

  const header = (
    <div className="prompt-subbar image-editor-subbar" data-component="Header:Tool">
      <div className="prompt-flow-title">
        <span className="tool-kicker">Image Editor</span>
        <input
          className="image-editor-title-input"
          value={name}
          spellCheck={false}
          aria-label="Image name"
          onChange={(event) => setName(event.target.value)}
        />
        {notice ? (
          <span className="image-editor-notice" role="status">
            {notice}
          </span>
        ) : (
          <span
            className={
              persistence.status === "unavailable" ||
              persistence.status === "large"
                ? "builder-save-state is-unavailable"
                : "builder-save-state"
            }
            role="status"
          >
            {saveStatusLabel(persistence.status, persistence.lastSavedAt)}
          </span>
        )}
      </div>

      <div className="image-editor-subbar-tools" role="group" aria-label="View">
        <button
          type="button"
          className="button button-quiet"
          onClick={() => viewport.zoomTo(viewport.view.scale * 0.8)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="image-editor-zoom-readout" role="status">
          {zoomPct}%
        </span>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => viewport.zoomTo(viewport.view.scale * 1.25)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => doc && viewport.fit(doc.width, doc.height)}
          title="Fit to screen"
        >
          Fit
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => viewport.zoomTo(1)}
          title="Actual size"
        >
          100%
        </button>
      </div>

      <div className="prompt-flow-header-actions">
        <button
          type="button"
          className="button button-quiet"
          onClick={() => history.undo()}
          disabled={!history.canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => history.redo()}
          disabled={!history.canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => setNewDialogOpen(true)}
        >
          New
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => fileInputRef.current?.click()}
          title="Open an image or a saved .json project"
        >
          Open
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={saveProject}
          disabled={!doc}
          title="Save the layered project as a .json file"
        >
          Save
        </button>
        <div className="image-editor-menu-wrap">
          <button
            ref={selectMenuButtonRef}
            type="button"
            className="button button-quiet"
            onClick={() => setSelectMenuOpen((open) => !open)}
            disabled={!doc}
            aria-haspopup="true"
            aria-expanded={selectMenuOpen}
          >
            Select ▾
          </button>
          {selectMenuOpen ? (
            <>
              <button
                type="button"
                className="image-editor-menu-backdrop"
                aria-label="Close menu"
                onClick={() => setSelectMenuOpen(false)}
              />
              <div
                className="image-editor-menu"
                role="group"
                aria-label="Selection actions"
              >
                <button
                  type="button"
                  disabled={!doc?.selection}
                  onClick={() => selectAction("deselect")}
                >
                  Deselect
                </button>
                <button
                  type="button"
                  disabled={!doc?.selection}
                  onClick={() => selectAction("invert")}
                >
                  Inverse
                </button>
                <button
                  type="button"
                  disabled={!doc?.selection}
                  onClick={() => selectAction("feather")}
                >
                  Feather 4px
                </button>
                <button
                  type="button"
                  disabled={!doc?.selection}
                  onClick={() => selectAction("grow")}
                >
                  Grow 2px
                </button>
                <button
                  type="button"
                  disabled={!doc?.selection}
                  onClick={() => selectAction("shrink")}
                >
                  Shrink 2px
                </button>
                <button
                  type="button"
                  disabled={!doc?.selection}
                  onClick={() => selectAction("stroke")}
                >
                  Stroke edge
                </button>
              </div>
            </>
          ) : null}
        </div>
        <div className="image-editor-menu-wrap">
          <button
            ref={canvasMenuButtonRef}
            type="button"
            className="button button-quiet"
            onClick={() => setCanvasMenuOpen((open) => !open)}
            disabled={!doc}
            aria-haspopup="true"
            aria-expanded={canvasMenuOpen}
          >
            Canvas ▾
          </button>
          {canvasMenuOpen ? (
            <>
              <button
                type="button"
                className="image-editor-menu-backdrop"
                aria-label="Close menu"
                onClick={() => setCanvasMenuOpen(false)}
              />
              <div
                className="image-editor-menu"
                role="group"
                aria-label="Canvas actions"
              >
                <button
                  type="button"
                  onClick={() => {
                    flipCanvas("horizontal");
                    setCanvasMenuOpen(false);
                  }}
                >
                  Flip horizontal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    flipCanvas("vertical");
                    setCanvasMenuOpen(false);
                  }}
                >
                  Flip vertical
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rotateCanvas("cw");
                    setCanvasMenuOpen(false);
                  }}
                >
                  Rotate 90° right
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rotateCanvas("ccw");
                    setCanvasMenuOpen(false);
                  }}
                >
                  Rotate 90° left
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageSizeOpen(true);
                    setCanvasMenuOpen(false);
                  }}
                >
                  Image size…
                </button>
              </div>
            </>
          ) : null}
        </div>
        <div className="image-editor-menu-wrap">
          <button
            ref={viewMenuButtonRef}
            type="button"
            className="button button-quiet"
            onClick={() => setViewMenuOpen((open) => !open)}
            disabled={!doc}
            aria-haspopup="true"
            aria-expanded={viewMenuOpen}
          >
            View ▾
          </button>
          {viewMenuOpen ? (
            <>
              <button
                type="button"
                className="image-editor-menu-backdrop"
                aria-label="Close menu"
                onClick={() => setViewMenuOpen(false)}
              />
              <div
                className="image-editor-menu"
                role="group"
                aria-label="View options"
              >
                <button
                  type="button"
                  aria-pressed={grid.show}
                  onClick={() => setGrid((g) => ({ ...g, show: !g.show }))}
                >
                  {grid.show ? "✓ " : ""}Show grid
                </button>
                <button
                  type="button"
                  aria-pressed={grid.snap}
                  onClick={() => setGrid((g) => ({ ...g, snap: !g.snap }))}
                >
                  {grid.snap ? "✓ " : ""}Snap to grid
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGrid((g) => ({
                      ...g,
                      size: g.size >= 64 ? 8 : g.size * 2,
                    }))
                  }
                >
                  Grid size: {grid.size}px
                </button>
                <button
                  type="button"
                  disabled={!doc}
                  onClick={() =>
                    doc &&
                    setGuides((gs) => ({
                      ...gs,
                      x: [...gs.x, Math.round(doc.width / 2)],
                    }))
                  }
                >
                  Add vertical guide
                </button>
                <button
                  type="button"
                  disabled={!doc}
                  onClick={() =>
                    doc &&
                    setGuides((gs) => ({
                      ...gs,
                      y: [...gs.y, Math.round(doc.height / 2)],
                    }))
                  }
                >
                  Add horizontal guide
                </button>
                <button
                  type="button"
                  disabled={guides.x.length === 0 && guides.y.length === 0}
                  onClick={() => setGuides({ x: [], y: [] })}
                >
                  Clear guides
                </button>
                <p className="image-editor-menu-hint">
                  Drag a guide with the Move tool; drag it off the canvas to
                  remove it.
                </p>
              </div>
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => setFiltersOpen(true)}
          disabled={!doc}
        >
          Adjust
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={exportJpeg}
          disabled={!doc}
          title="Export a flattened JPEG"
        >
          JPG
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={exportPng}
          disabled={!doc}
        >
          Export PNG
        </button>
      </div>
    </div>
  );

  const subbarTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("app-subbar-slot");

  return (
    <div className="tool-page image-editor-page">
      {subbarTarget ? createPortal(header, subbarTarget) : null}

      {doc ? (
        <div className="image-editor-layout">
          <ImageEditorToolbar
            tool={tool}
            onToolChange={setTool}
            fgColor={color}
            bgColor={bgColor}
            activeSwatch={activeSwatch}
            recentColors={recentColors}
            onColorChange={setActiveColor}
            onSelectSwatch={setActiveSwatch}
            onSwapColors={swapColors}
            onResetColors={resetColors}
            brush={brush}
            onBrushChange={(patch) =>
              setBrush((current) => ({ ...current, ...patch }))
            }
            shape={shape}
            onShapeChange={(patch) =>
              setShape((current) => ({ ...current, ...patch }))
            }
            text={text}
            onTextChange={(patch) =>
              setText((current) => ({ ...current, ...patch }))
            }
            gradient={gradient}
            onGradientChange={(patch) =>
              setGradient((current) => ({ ...current, ...patch }))
            }
            tolerance={tolerance}
            onToleranceChange={setTolerance}
          />

          <ImageEditorCanvas
            doc={doc}
            viewport={viewport}
            tool={tool}
            brush={brush}
            shape={shape}
            text={text}
            gradient={gradient}
            color={color}
            bgColor={bgColor}
            tolerance={tolerance}
            grid={grid}
            guides={guides}
            onGuidesChange={setGuides}
            onCommitDoc={commit}
            onPickColor={setColor}
            onDropFiles={placeImageFiles}
          />

          <div className="image-editor-right">
          <ImageEditorLayers
            doc={doc}
            onSelectLayer={(id) => setDocOp((current) => setActiveLayer(current, id))}
            onAddLayer={() => commit((current) => addLayer(current))}
            onDuplicateLayer={(id) => commit((current) => duplicateLayer(current, id))}
            onDeleteLayer={(id) => commit((current) => deleteLayer(current, id))}
            onMergeDown={(id) => commit((current) => mergeLayerDown(current, id))}
            onToggleVisible={(id) =>
              commit((current) => {
                const layer = current.layers.find((item) => item.id === id);
                return patchLayer(current, id, { visible: !layer?.visible });
              })
            }
            onOpacity={(id, opacity) =>
              commit((current) => patchLayer(current, id, { opacity }), `op:${id}`)
            }
            onBlendMode={(id, mode: BlendMode) =>
              commit((current) => setBlendMode(current, id, mode))
            }
            onToggleLock={(id) =>
              commit((current) => {
                const layer = current.layers.find((item) => item.id === id);
                return patchLayer(current, id, { locked: !layer?.locked });
              })
            }
            onToggleClip={(id) =>
              commit((current) => {
                const layer = current.layers.find((item) => item.id === id);
                return patchLayer(current, id, { clipped: !layer?.clipped });
              })
            }
            onRename={(id, newName) =>
              commit((current) => patchLayer(current, id, { name: newName }), `name:${id}`)
            }
            onReorderDelta={(id, delta) =>
              commit((current) => reorderLayer(current, id, delta))
            }
            onReorderTo={(id, toIndex) =>
              commit((current) => moveLayerToIndex(current, id, toIndex))
            }
          />
          <ImageEditorHistory
            depth={history.depth}
            position={history.position}
            onJump={history.jump}
          />
          </div>
        </div>
      ) : (
        <div className="image-editor-loading" role="status">
          Preparing canvas…
        </div>
      )}

      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="image/*,application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            const isProject =
              file.type === "application/json" ||
              file.name.toLowerCase().endsWith(".json");
            void (isProject ? openProjectFile(file) : openImageFile(file));
          }
          event.target.value = "";
        }}
      />

      <ImageEditorNewDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreate={createSizedDoc}
      />

      <ImageEditorFilters
        open={filtersOpen}
        sourceBitmap={doc ? (activeLayerOf(doc)?.bitmap ?? null) : null}
        onClose={() => setFiltersOpen(false)}
        onApply={(adj) => {
          commit((current) => {
            const layer = activeLayerOf(current);
            if (!layer) {
              return current;
            }
            const adjusted = applyAdjustments(layer.bitmap, adj);
            const result = current.selection
              ? applySelectionClip(layer.bitmap, adjusted, current.selection)
              : adjusted;
            return commitLayerBitmap(current, current.activeLayerId, result);
          });
          setFiltersOpen(false);
        }}
      />

      <ImageEditorImageSizeDialog
        open={imageSizeOpen}
        width={doc?.width ?? 1280}
        height={doc?.height ?? 800}
        onClose={() => setImageSizeOpen(false)}
        onApply={applyImageSize}
      />
    </div>
  );
}
