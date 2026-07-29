"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorMenubar, type MenuDef } from "@/components/editor-menubar";
import {
  EditorTabs,
  tabPanelProps,
  type EditorTabDef,
} from "@/components/editor-tabs";
import { ImageEditorCanvas } from "@/components/image-editor-canvas";
import { ImageEditorCanvasSizeDialog } from "@/components/image-editor-canvassize-dialog";
import { ImageEditorExportDialog } from "@/components/image-editor-export-dialog";
import { ImageEditorChannels } from "@/components/image-editor-channels";
import { ImageEditorFilters } from "@/components/image-editor-filters";
import { ImageEditorHistory } from "@/components/image-editor-history";
import {
  ImageEditorImageSizeDialog,
  type ResampleQuality,
} from "@/components/image-editor-imagesize-dialog";
import { ImageEditorLayers } from "@/components/image-editor-layers";
import { ImageEditorMinimap } from "@/components/image-editor-minimap";
import { ImageEditorNewDialog } from "@/components/image-editor-new-dialog";
import { ImageEditorProperties } from "@/components/image-editor-properties";
import { ImageEditorToolbar } from "@/components/image-editor-toolbar";
import {
  ToolSaveStateChip,
  ToolSubbar,
  ToolSubbarActions,
} from "@/components/tool-subbar";
import { useCanvasViewport } from "@/hooks/use-canvas-viewport";
import { useImageEditorHistory } from "@/hooks/use-image-editor-history";
import { useImageEditorPersistence } from "@/hooks/use-image-editor-persistence";
import { usePortalTarget } from "@/hooks/use-portal-target";
import {
  downloadBlob,
  downloadTextFile,
  slugifyFilename,
} from "@/lib/browser-download";
import {
  buildTipAlpha,
  type CustomTip,
} from "@/lib/image-editor/brush-tips";
import {
  ALL_CHANNELS,
  loadChannelAsSelection,
  type ChannelKey,
  type ChannelView,
} from "@/lib/image-editor/channels";
import {
  activeLayerOf,
  addImageLayer,
  addLayer,
  commitLayerBitmap,
  commitPaintedBitmap,
  createDoc,
  createDocFromImage,
  cropDoc,
  deleteLayer,
  duplicateLayer,
  flattenDoc,
  flipDoc,
  mergeLayerDown,
  moveLayerToIndex,
  patchLayer,
  reorderLayer,
  resampleDoc,
  resizeCanvas,
  rotateDoc,
  setActiveLayer,
  setBlendMode,
  setSelection,
} from "@/lib/image-editor/document";
import {
  exportLayersSeparately,
  exportLayersZip,
} from "@/lib/image-editor/export-archive";
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
  getTool,
  toolForShortcut,
} from "@/lib/image-editor/tools";
import type {
  BrushSettings,
  GradientSettings,
  ShapeSettings,
  TextSettings,
  ToolId,
} from "@/lib/image-editor/tools";
import type { BlendMode, ImageDoc, Rect } from "@/lib/image-editor/types";
import { MAX_DOC_DIMENSION, MAX_DOC_PIXELS } from "@/lib/image-editor/types";

const IMAGE_LIMITS = {
  maxPixels: MAX_DOC_PIXELS,
  maxDimension: MAX_DOC_DIMENSION,
};

// Early reject an oversized .json project before reading it fully into memory.
const MAX_PROJECT_BYTES = 96_000_000;

const DOCK_TABS: EditorTabDef[] = [
  { id: "layers", label: "Layers" },
  { id: "channels", label: "Channels" },
  { id: "properties", label: "Properties" },
  { id: "adjust", label: "Adjust" },
  { id: "history", label: "History" },
];

export function ImageEditor() {
  const [doc, setDoc] = useState<ImageDoc | null>(null);
  const [tool, setTool] = useState<ToolId>("brush");
  const [color, setColor] = useState("#111111");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [activeSwatch, setActiveSwatch] = useState<"fg" | "bg">("fg");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [customTips, setCustomTips] = useState<CustomTip[]>([]);
  const [shape, setShape] = useState<ShapeSettings>(DEFAULT_SHAPE);
  const [text, setText] = useState<TextSettings>(DEFAULT_TEXT);
  const [gradient, setGradient] = useState<GradientSettings>(DEFAULT_GRADIENT);
  const [tolerance, setTolerance] = useState(32);
  const [imageSizeOpen, setImageSizeOpen] = useState(false);
  const [canvasSizeOpen, setCanvasSizeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Confirm-stage crop: the pending region stays adjustable (handles, numeric
  // fields, aspect presets) until Enter/Apply commits or Escape cancels.
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [cropAspect, setCropAspect] = useState<number | null>(null);
  const clipboardRef = useRef<HTMLCanvasElement | null>(null);
  const [name, setName] = useState("Untitled");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [dockTab, setDockTab] = useState<
    "layers" | "channels" | "properties" | "adjust" | "history"
  >("layers");
  const [channelView, setChannelView] = useState<ChannelView>(ALL_CHANNELS);
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
  const tipInputRef = useRef<HTMLInputElement | null>(null);
  const tipCounter = useRef(0);

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
    (
      width: number,
      height: number,
      ppi: number,
      resample: boolean,
      quality: ResampleQuality,
    ) => {
      if (resample) {
        commit((c) => ({ ...resampleDoc(c, width, height, quality), ppi }));
        fitDimsRef.current = "";
      } else {
        // Pixels frozen — only how large they print changes.
        commit((c) => ({ ...c, ppi }));
      }
      setImageSizeOpen(false);
    },
    [commit],
  );
  const applyCanvasSize = useCallback(
    (width: number, height: number, offsetX: number, offsetY: number) => {
      commit((c) => resizeCanvas(c, width, height, offsetX, offsetY));
      fitDimsRef.current = "";
      setCanvasSizeOpen(false);
    },
    [commit],
  );
  const applyCrop = useCallback(() => {
    if (
      cropRect &&
      cropRect.width >= 2 &&
      cropRect.height >= 2 &&
      cropRect.width <= MAX_DOC_DIMENSION &&
      cropRect.height <= MAX_DOC_DIMENSION &&
      cropRect.width * cropRect.height <= MAX_DOC_PIXELS
    ) {
      commit((c) => cropDoc(c, cropRect));
      fitDimsRef.current = "";
    }
    setCropRect(null);
  }, [commit, cropRect]);
  // Keyboard-reachable entry to the crop workflow: seed a centered region at
  // 80% of the canvas, then the numeric fields / presets take over.
  const seedCrop = useCallback(() => {
    if (!doc) {
      return;
    }
    const width = Math.max(2, Math.round(doc.width * 0.8));
    const height = Math.max(2, Math.round(doc.height * 0.8));
    setCropRect({
      x: Math.round((doc.width - width) / 2),
      y: Math.round((doc.height - height) / 2),
      width,
      height,
    });
  }, [doc]);
  // Switching tools drops any pending crop, so the overlay can't go stale.
  const selectTool = useCallback((next: ToolId) => {
    setTool(next);
    if (next !== "crop") {
      setCropRect(null);
    }
  }, []);

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
    },
    [commit, color],
  );

  // Load one RGBA channel of the flattened image as a graduated selection.
  const loadChannel = useCallback(
    (channel: ChannelKey) => {
      commit((d) => {
        const sel = loadChannelAsSelection(d, channel);
        return sel ? setSelection(d, sel) : d;
      }, "select");
    },
    [commit],
  );

  // Global keyboard: undo/redo, tool + pro shortcuts, fills, nudge, colors.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A modal owns the keyboard while it's open.
      if (newDialogOpen || imageSizeOpen || canvasSizeOpen) {
        return;
      }
      const el = document.activeElement;
      const tag = el?.tagName;
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el instanceof HTMLElement && el.isContentEditable);

      // A pending crop owns Enter/Escape.
      if (!inField && tool === "crop" && cropRect) {
        if (event.key === "Enter") {
          event.preventDefault();
          applyCrop();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setCropRect(null);
          return;
        }
      }

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
        selectTool(next);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    history,
    doc,
    commit,
    newDialogOpen,
    imageSizeOpen,
    canvasSizeOpen,
    tool,
    cropRect,
    applyCrop,
    selectTool,
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
    (width: number, height: number, ppi: number, background: string | null) => {
      history.reset();
      fitDimsRef.current = "";
      setDoc(createDoc(width, height, ppi, background));
      setName("Untitled");
      setNewDialogOpen(false);
      setNotice(null);
    },
    [history],
  );

  // Scaled bitmap export via the Export dialog (PNG, or JPG with a real
  // quality choice — previously hardcoded).
  const runExport = useCallback(
    (options: {
      format: "png" | "jpeg";
      width: number;
      height: number;
      quality: number;
    }) => {
      setExportOpen(false);
      if (!doc) {
        return;
      }
      const flat = composite(doc);
      const out = createBitmap(options.width, options.height);
      const ctx = get2d(out);
      if (options.format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, options.width, options.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(flat, 0, 0, options.width, options.height);
      const mime = options.format === "jpeg" ? "image/jpeg" : "image/png";
      const extension = options.format === "jpeg" ? "jpg" : "png";
      out.toBlob(
        (blob) => {
          if (blob) {
            downloadBlob(`${slugifyFilename(name)}.${extension}`, blob);
          }
        },
        mime,
        options.format === "jpeg"
          ? Math.min(1, Math.max(0.5, options.quality))
          : undefined,
      );
    },
    [doc, name],
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

  // Import a PNG as a custom brush tip (reuses the safe image-decode path).
  const importTipFile = useCallback(async (file: File) => {
    const result = await decodeImageFile(file, IMAGE_LIMITS);
    if ("error" in result) {
      setNotice(result.error);
      return;
    }
    const id = `custom-${(tipCounter.current += 1)}`;
    const label = file.name.replace(/\.[^.]+$/, "") || "Tip";
    const image = buildTipAlpha(result.bitmap, result.width, result.height);
    // Keep the most recent tips only, so repeated imports can't grow unbounded.
    setCustomTips((prev) => [...prev, { id, label, image }].slice(-24));
    setBrush((current) => ({ ...current, tip: id }));
    setNotice(null);
  }, []);

  const zoomPct = Math.round(viewport.view.scale * 100);
  const canLayerOps = Boolean(doc && doc.layers.length > 1);
  const hasSelection = Boolean(doc?.selection);

  // The application menu bar. Every command reuses an existing handler; the bar
  // is a reorganization of the old scattered header buttons/dropdowns.
  const menus: MenuDef[] = [
    {
      id: "file",
      label: "File",
      items: [
        {
          label: "New…",
          shortcut: "Ctrl+N",
          onSelect: () => setNewDialogOpen(true),
        },
        {
          label: "Open…",
          shortcut: "Ctrl+O",
          onSelect: () => fileInputRef.current?.click(),
        },
        {
          label: "Save project",
          shortcut: "Ctrl+S",
          onSelect: saveProject,
          disabled: !doc,
        },
        { separator: true, label: "" },
        {
          label: "Export…",
          onSelect: () => setExportOpen(true),
          disabled: !doc,
        },
        { label: "Export PNG", onSelect: exportPng, disabled: !doc },
        { label: "Export JPG", onSelect: exportJpeg, disabled: !doc },
        { separator: true, label: "" },
        {
          label: "Export layers as .zip",
          onSelect: () => doc && void exportLayersZip(doc, name),
          disabled: !doc,
        },
        {
          label: "Export layers as files",
          onSelect: () => doc && void exportLayersSeparately(doc, name),
          disabled: !doc,
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
        { separator: true, label: "" },
        { label: "Cut", shortcut: "Ctrl+X", onSelect: cutToClipboard, disabled: !doc },
        {
          label: "Copy",
          shortcut: "Ctrl+C",
          onSelect: copyToClipboard,
          disabled: !doc,
        },
        {
          label: "Paste",
          shortcut: "Ctrl+V",
          onSelect: pasteClipboard,
          disabled: !doc,
        },
        { separator: true, label: "" },
        {
          label: "Fill with foreground",
          shortcut: "Alt+⌫",
          onSelect: () => fillActive(color),
          disabled: !doc,
        },
        {
          label: "Fill with background",
          shortcut: "Ctrl+⌫",
          onSelect: () => fillActive(bgColor),
          disabled: !doc,
        },
      ],
    },
    {
      id: "image",
      label: "Image",
      items: [
        {
          label: "Image size…",
          onSelect: () => setImageSizeOpen(true),
          disabled: !doc,
        },
        {
          label: "Canvas size…",
          onSelect: () => setCanvasSizeOpen(true),
          disabled: !doc,
        },
        { separator: true, label: "" },
        {
          label: "Flip horizontal",
          onSelect: () => flipCanvas("horizontal"),
          disabled: !doc,
        },
        {
          label: "Flip vertical",
          onSelect: () => flipCanvas("vertical"),
          disabled: !doc,
        },
        {
          label: "Rotate 90° right",
          onSelect: () => rotateCanvas("cw"),
          disabled: !doc,
        },
        {
          label: "Rotate 90° left",
          onSelect: () => rotateCanvas("ccw"),
          disabled: !doc,
        },
      ],
    },
    {
      id: "layer",
      label: "Layer",
      items: [
        {
          label: "New layer",
          shortcut: "Ctrl+Shift+N",
          onSelect: () => commit((d) => addLayer(d)),
          disabled: !doc,
        },
        {
          label: "Duplicate layer",
          shortcut: "Ctrl+J",
          onSelect: () => commit((d) => duplicateLayer(d, d.activeLayerId)),
          disabled: !doc,
        },
        {
          label: "Delete layer",
          onSelect: () => commit((d) => deleteLayer(d, d.activeLayerId)),
          disabled: !canLayerOps,
        },
        { separator: true, label: "" },
        {
          label: "Merge down",
          shortcut: "Ctrl+E",
          onSelect: () => commit((d) => mergeLayerDown(d, d.activeLayerId)),
          disabled: !canLayerOps,
        },
        {
          label: "Flatten image",
          shortcut: "Ctrl+Shift+E",
          onSelect: () => commit((d) => flattenDoc(d)),
          disabled: !doc,
        },
      ],
    },
    {
      id: "select",
      label: "Select",
      items: [
        {
          label: "All",
          shortcut: "Ctrl+A",
          onSelect: () =>
            commit(
              (d) => setSelection(d, selectAll(d.width, d.height)),
              "select",
            ),
          disabled: !doc,
        },
        {
          label: "Deselect",
          shortcut: "Ctrl+D",
          onSelect: () => selectAction("deselect"),
          disabled: !hasSelection,
        },
        {
          label: "Inverse",
          shortcut: "Ctrl+Shift+I",
          onSelect: () => selectAction("invert"),
          disabled: !hasSelection,
        },
        { separator: true, label: "" },
        {
          label: "Feather 4px",
          onSelect: () => selectAction("feather"),
          disabled: !hasSelection,
        },
        {
          label: "Grow 2px",
          onSelect: () => selectAction("grow"),
          disabled: !hasSelection,
        },
        {
          label: "Shrink 2px",
          onSelect: () => selectAction("shrink"),
          disabled: !hasSelection,
        },
        {
          label: "Stroke edge",
          onSelect: () => selectAction("stroke"),
          disabled: !hasSelection,
        },
        { separator: true, label: "" },
        {
          label: "Load red as selection",
          onSelect: () => loadChannel("r"),
          disabled: !doc,
        },
        {
          label: "Load green as selection",
          onSelect: () => loadChannel("g"),
          disabled: !doc,
        },
        {
          label: "Load blue as selection",
          onSelect: () => loadChannel("b"),
          disabled: !doc,
        },
        {
          label: "Load alpha as selection",
          onSelect: () => loadChannel("a"),
          disabled: !doc,
        },
      ],
    },
    {
      id: "filter",
      label: "Filter",
      items: [
        {
          label: "Adjustments…",
          onSelect: () => setDockTab("adjust"),
          disabled: !doc,
        },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        {
          label: "Fit on screen",
          shortcut: "Ctrl+0",
          onSelect: () => doc && viewport.fit(doc.width, doc.height),
          disabled: !doc,
        },
        {
          label: "Actual size (100%)",
          shortcut: "Ctrl+1",
          onSelect: () => viewport.zoomTo(1),
          disabled: !doc,
        },
        {
          label: "Zoom in",
          onSelect: () => viewport.zoomTo(viewport.view.scale * 1.25),
          disabled: !doc,
        },
        {
          label: "Zoom out",
          onSelect: () => viewport.zoomTo(viewport.view.scale * 0.8),
          disabled: !doc,
        },
        { separator: true, label: "" },
        {
          label: "Show grid",
          checked: grid.show,
          onSelect: () => setGrid((g) => ({ ...g, show: !g.show })),
        },
        {
          label: "Snap to grid",
          checked: grid.snap,
          onSelect: () => setGrid((g) => ({ ...g, snap: !g.snap })),
        },
        {
          label: `Grid size: ${grid.size}px`,
          onSelect: () =>
            setGrid((g) => ({ ...g, size: g.size >= 64 ? 8 : g.size * 2 })),
        },
        { separator: true, label: "" },
        {
          label: "Add vertical guide",
          onSelect: () =>
            doc &&
            setGuides((gs) => ({
              ...gs,
              x: [...gs.x, Math.round(doc.width / 2)],
            })),
          disabled: !doc,
        },
        {
          label: "Add horizontal guide",
          onSelect: () =>
            doc &&
            setGuides((gs) => ({
              ...gs,
              y: [...gs.y, Math.round(doc.height / 2)],
            })),
          disabled: !doc,
        },
        {
          label: "Clear guides",
          onSelect: () => setGuides({ x: [], y: [] }),
          disabled: !doc || (guides.x.length === 0 && guides.y.length === 0),
        },
      ],
    },
  ];

  const header = (
    <ToolSubbar className="image-editor-subbar">
      <EditorMenubar
        menus={menus}
        label="Image editor menu"
        className="image-editor-menubar"
      />
      <div className="image-editor-titlebar">
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
          <ToolSaveStateChip
            status={persistence.status}
            lastSavedAt={persistence.lastSavedAt}
            restoringLabel="Restoring…"
          />
        )}
      </div>

      <ToolSubbarActions>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setExportOpen(true)}
          disabled={!doc}
        >
          Export
        </button>
      </ToolSubbarActions>
    </ToolSubbar>
  );

  const statusTarget = usePortalTarget("app-statusbar-slot");

  const statusBar = doc ? (
    <div className="image-editor-statusbar">
      <span className="ie-status-zoom" role="status">
        {zoomPct}%
      </span>
      <span className="ie-status-dims">
        {doc.width} × {doc.height} px
      </span>
      <span className="ie-status-tool">{getTool(tool)?.label ?? ""}</span>
    </div>
  ) : null;

  return (
    <div className="tool-page image-editor-page">
      {header}
      {statusTarget && statusBar
        ? createPortal(statusBar, statusTarget)
        : null}

      {doc ? (
        <div className="image-editor-layout">
          <ImageEditorToolbar
            tool={tool}
            onToolChange={selectTool}
            fgColor={color}
            bgColor={bgColor}
            activeSwatch={activeSwatch}
            onSelectSwatch={setActiveSwatch}
            onSwapColors={swapColors}
            onResetColors={resetColors}
          />

          <ImageEditorCanvas
            doc={doc}
            viewport={viewport}
            tool={tool}
            brush={brush}
            customTips={customTips}
            shape={shape}
            text={text}
            gradient={gradient}
            color={color}
            bgColor={bgColor}
            tolerance={tolerance}
            grid={grid}
            guides={guides}
            channelView={channelView}
            cropRect={cropRect}
            cropAspect={cropAspect}
            onCropRect={setCropRect}
            onCropApply={applyCrop}
            onGuidesChange={setGuides}
            onCommitDoc={commit}
            onPickColor={setColor}
            onDropFiles={placeImageFiles}
          >
            <div
              className="image-editor-canvas-tools"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="image-editor-zoombtn"
                onClick={() => viewport.zoomTo(viewport.view.scale * 0.8)}
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="image-editor-zoombtn-readout">{zoomPct}%</span>
              <button
                type="button"
                className="image-editor-zoombtn"
                onClick={() => viewport.zoomTo(viewport.view.scale * 1.25)}
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="image-editor-zoombtn is-text"
                onClick={() => viewport.fit(doc.width, doc.height)}
                title="Fit on screen"
              >
                Fit
              </button>
              <button
                type="button"
                className="image-editor-zoombtn is-text"
                onClick={() => viewport.zoomTo(1)}
                title="Actual size"
              >
                100%
              </button>
            </div>
            <ImageEditorMinimap doc={doc} viewport={viewport} />
          </ImageEditorCanvas>

          <div className="image-editor-dock">
            <EditorTabs
              tabs={DOCK_TABS}
              active={dockTab}
              onChange={(id) => setDockTab(id as typeof dockTab)}
              idBase="ie-dock"
              label="Editor panels"
            />
            <div className="image-editor-dock-body">
              {dockTab === "layers" ? (
                <div
                  {...tabPanelProps("ie-dock", "layers")}
                  className="image-editor-dock-panel"
                >
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
                </div>
              ) : null}
              {dockTab === "channels" ? (
                <div
                  {...tabPanelProps("ie-dock", "channels")}
                  className="image-editor-dock-panel"
                >
                  <ImageEditorChannels
                    doc={doc}
                    channelView={channelView}
                    onChannelViewChange={setChannelView}
                    onLoadChannel={loadChannel}
                  />
                </div>
              ) : null}
              {dockTab === "properties" ? (
                <div
                  {...tabPanelProps("ie-dock", "properties")}
                  className="image-editor-dock-panel"
                >
                  <ImageEditorProperties
                    tool={tool}
                    fgColor={color}
                    bgColor={bgColor}
                    activeSwatch={activeSwatch}
                    recentColors={recentColors}
                    cropRect={cropRect}
                    cropAspect={cropAspect}
                    onCropRect={setCropRect}
                    onCropAspect={setCropAspect}
                    onCropApply={applyCrop}
                    onCropSeed={seedCrop}
                    onColorChange={setActiveColor}
                    onSelectSwatch={setActiveSwatch}
                    onSwapColors={swapColors}
                    onResetColors={resetColors}
                    brush={brush}
                    onBrushChange={(patch) =>
                      setBrush((current) => ({ ...current, ...patch }))
                    }
                    tip={brush.tip}
                    customTips={customTips}
                    onTipChange={(id) =>
                      setBrush((current) => ({ ...current, tip: id }))
                    }
                    onImportTip={() => tipInputRef.current?.click()}
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
                </div>
              ) : null}
              {dockTab === "adjust" ? (
                <div
                  {...tabPanelProps("ie-dock", "adjust")}
                  className="image-editor-dock-panel"
                >
                  <ImageEditorFilters
                    embedded
                    open
                    sourceBitmap={activeLayerOf(doc)?.bitmap ?? null}
                    onClose={() => undefined}
                    onApply={(adj) => {
                      commit((current) => {
                        const layer = activeLayerOf(current);
                        if (!layer) {
                          return current;
                        }
                        const adjusted = applyAdjustments(layer.bitmap, adj);
                        const result = current.selection
                          ? applySelectionClip(
                              layer.bitmap,
                              adjusted,
                              current.selection,
                            )
                          : adjusted;
                        return commitLayerBitmap(
                          current,
                          current.activeLayerId,
                          result,
                        );
                      });
                    }}
                  />
                </div>
              ) : null}
              {dockTab === "history" ? (
                <div
                  {...tabPanelProps("ie-dock", "history")}
                  className="image-editor-dock-panel"
                >
                  <ImageEditorHistory
                    depth={history.depth}
                    position={history.position}
                    onJump={history.jump}
                  />
                </div>
              ) : null}
            </div>
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

      <input
        ref={tipInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importTipFile(file);
          }
          event.target.value = "";
        }}
      />

      <ImageEditorNewDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreate={createSizedDoc}
      />

      <ImageEditorImageSizeDialog
        open={imageSizeOpen}
        width={doc?.width ?? 1280}
        height={doc?.height ?? 800}
        ppi={doc?.ppi ?? 300}
        onClose={() => setImageSizeOpen(false)}
        onApply={applyImageSize}
      />

      <ImageEditorCanvasSizeDialog
        open={canvasSizeOpen}
        width={doc?.width ?? 1280}
        height={doc?.height ?? 800}
        onClose={() => setCanvasSizeOpen(false)}
        onApply={applyCanvasSize}
      />

      <ImageEditorExportDialog
        open={exportOpen}
        width={doc?.width ?? 1280}
        height={doc?.height ?? 800}
        fileBase={slugifyFilename(name)}
        onClose={() => setExportOpen(false)}
        onExport={runExport}
      />
    </div>
  );
}
