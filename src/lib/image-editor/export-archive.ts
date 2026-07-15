// Layered export: every layer as its own raw PNG plus a flattened PNG and JSON +
// Markdown manifests, delivered as one store-only .zip (no dependency) or as
// individual downloads. Layer bitmaps are doc-sized and drawn at (0,0), so there
// is no per-layer offset to record — the manifest carries order + metadata only.

import {
  downloadBlob,
  downloadTextFile,
  slugifyFilename,
} from "@/lib/browser-download";
import { createZip, textZipEntry, type ZipEntry } from "@/lib/zip";
import { composite } from "./raster";
import type { ImageDoc, Layer } from "./types";

interface LayerManifestEntry {
  index: number;
  file: string;
  name: string;
  opacity: number;
  blendMode: string;
  visible: boolean;
  locked: boolean;
  clipped: boolean;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas export failed."));
      }
    }, "image/png");
  });
}

async function canvasToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

function layerFileName(layer: Layer, index: number): string {
  const order = String(index + 1).padStart(2, "0");
  return `layer-${order}-${slugifyFilename(layer.name, "layer")}.png`;
}

// Bottom → top order (layers[0] is the bottom of the stack).
function manifestEntries(doc: ImageDoc): LayerManifestEntry[] {
  return doc.layers.map((layer, index) => ({
    index,
    file: `layers/${layerFileName(layer, index)}`,
    name: layer.name,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    visible: layer.visible,
    locked: layer.locked,
    clipped: layer.clipped,
  }));
}

function manifestJson(
  name: string,
  doc: ImageDoc,
  layers: LayerManifestEntry[],
): string {
  return `${JSON.stringify(
    {
      name,
      width: doc.width,
      height: doc.height,
      layerCount: doc.layers.length,
      order: "bottom-to-top",
      layers,
    },
    null,
    2,
  )}\n`;
}

// Neutralize a value before it lands in a Markdown table cell or heading: a
// layer/doc name is an unbounded imported string, so strip control chars/newlines,
// HTML-escape (&<>) so it can't become live markup in a raw-HTML markdown viewer,
// and escape the table delimiter (|).
function mdCell(value: string): string {
  // Strip control chars (incl. CR/LF) so a name cannot break the table.
  let cleaned = "";
  for (const ch of value) {
    cleaned += ch.charCodeAt(0) < 0x20 ? " " : ch;
  }
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "\\|")
    .trim();
}

function manifestMarkdown(
  name: string,
  doc: ImageDoc,
  layers: LayerManifestEntry[],
): string {
  const rows = layers
    .map((layer) => {
      const cells = [
        String(layer.index + 1),
        mdCell(layer.file),
        mdCell(layer.name),
        `${Math.round(layer.opacity * 100)}%`,
        mdCell(layer.blendMode),
        layer.visible ? "yes" : "no",
        layer.locked ? "yes" : "no",
        layer.clipped ? "yes" : "no",
      ];
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
  return [
    `# ${mdCell(name)} — layers`,
    "",
    `Canvas: ${doc.width} × ${doc.height} px · ${doc.layers.length} layer(s), listed bottom → top.`,
    "",
    "| # | File | Name | Opacity | Blend | Visible | Lock | Clip |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "`flattened.png` is the merged image. Each `layers/…png` holds one layer's raw",
    "pixels (opacity and blend mode are recorded above, not baked into the PNG).",
    "",
  ].join("\n");
}

// Export every layer + a flattened PNG + JSON/MD manifests as one .zip.
export async function exportLayersZip(
  doc: ImageDoc,
  name: string,
): Promise<void> {
  const layers = manifestEntries(doc);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < doc.layers.length; i += 1) {
    entries.push({
      name: layers[i].file,
      data: await canvasToBytes(doc.layers[i].bitmap),
    });
  }
  entries.push({ name: "flattened.png", data: await canvasToBytes(composite(doc)) });
  entries.push(textZipEntry("layers.json", manifestJson(name, doc, layers)));
  entries.push(textZipEntry("layers.md", manifestMarkdown(name, doc, layers)));
  downloadBlob(`${slugifyFilename(name)}-layers.zip`, createZip(entries));
}

// Export the same set as individual file downloads (each triggers a save).
export async function exportLayersSeparately(
  doc: ImageDoc,
  name: string,
): Promise<void> {
  const layers = manifestEntries(doc);
  for (let i = 0; i < doc.layers.length; i += 1) {
    const blob = await canvasToBlob(doc.layers[i].bitmap);
    downloadBlob(layerFileName(doc.layers[i], i), blob);
  }
  downloadBlob(`${slugifyFilename(name)}-flattened.png`, await canvasToBlob(composite(doc)));
  downloadTextFile(
    "layers.json",
    manifestJson(name, doc, layers),
    "application/json;charset=utf-8",
  );
  downloadTextFile(
    "layers.md",
    manifestMarkdown(name, doc, layers),
    "text/markdown;charset=utf-8",
  );
}
