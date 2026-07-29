// Export the document as SVG (the live scene graph, serialized verbatim) and as
// a rasterized PNG. Because the editor IS native SVG, the export is a
// faithful, lossless copy — no canvas round-trip on the way out.
//
// Only numeric geometry and color strings (from the native <input type="color">
// pickers, always #rrggbb) reach the output — there is no user-authored text in
// the markup, so nothing needs HTML/attribute escaping in v1.

import { pathToD } from "@/lib/vector-editor/bezier";
import { objectBounds } from "@/lib/vector-editor/geometry";
import {
  fontCss,
  TEXT_ASCENT,
  TEXT_LINE_HEIGHT,
  textLines,
} from "@/lib/vector-editor/text";
import type { VectorDocument, VectorObject } from "@/lib/vector-editor/types";

function num(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

// Colors are the only strings in the output. They come from native color
// pickers (always #rrggbb) in normal use, but a tampered localStorage could
// carry anything, so escape them before they land in an attribute — otherwise
// a crafted color could break out and inject markup into the exported SVG.
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paintAttrs(object: VectorObject): string {
  const parts: string[] = [];
  if (object.fill) {
    parts.push(`fill="${escapeAttr(object.fill.color)}"`);
    if (object.fill.opacity !== 1) {
      parts.push(`fill-opacity="${num(object.fill.opacity)}"`);
    }
  } else {
    parts.push(`fill="none"`);
  }
  if (object.stroke) {
    parts.push(`stroke="${escapeAttr(object.stroke.color)}"`);
    parts.push(`stroke-width="${num(object.stroke.width)}"`);
    if (object.stroke.opacity !== 1) {
      parts.push(`stroke-opacity="${num(object.stroke.opacity)}"`);
    }
  }
  if (object.opacity !== 1) parts.push(`opacity="${num(object.opacity)}"`);
  return parts.join(" ");
}

function objectToSvg(object: VectorObject): string {
  const box = objectBounds(object);
  const transform =
    object.rotation !== 0
      ? ` transform="rotate(${num(object.rotation)} ${num(box.cx)} ${num(box.cy)})"`
      : "";
  const paint = paintAttrs(object);

  switch (object.kind) {
    case "rect": {
      const radius = object.radius ? ` rx="${num(object.radius)}"` : "";
      return `<rect x="${num(object.x)}" y="${num(object.y)}" width="${num(object.width)}" height="${num(object.height)}"${radius} ${paint}${transform}/>`;
    }
    case "ellipse":
      return `<ellipse cx="${num(object.cx)}" cy="${num(object.cy)}" rx="${num(object.rx)}" ry="${num(object.ry)}" ${paint}${transform}/>`;
    case "line":
      return `<line x1="${num(object.x1)}" y1="${num(object.y1)}" x2="${num(object.x2)}" y2="${num(object.y2)}" ${paint}${transform}/>`;
    case "polygon":
      return `<polygon points="${object.points.map((p) => `${num(p.x)},${num(p.y)}`).join(" ")}" ${paint}${transform}/>`;
    // pathToD emits only M/L/C/Z commands over rounded numbers — no
    // user-authored text can reach the d attribute.
    case "path":
      return `<path d="${pathToD(object.anchors, object.closed)}" ${paint}${transform}/>`;
    // Text CONTENT is user-authored, so every line is escaped; the font
    // family is a validated catalog name resolved to its stack here, and
    // the baseline math matches ShapeElement exactly.
    case "text": {
      const baseline = object.y + object.fontSize * TEXT_ASCENT;
      const spans = textLines(object.text)
        .map(
          (line, index) =>
            `<tspan x="${num(object.x)}" y="${num(baseline + index * object.fontSize * TEXT_LINE_HEIGHT)}">${escapeAttr(line)}</tspan>`,
        )
        .join("");
      const style = ` font-family="${escapeAttr(fontCss(object.fontFamily))}" font-size="${num(object.fontSize)}"${object.bold ? ' font-weight="700"' : ""}${object.italic ? ' font-style="italic"' : ""}`;
      return `<text ${paint}${style}${transform}>${spans}</text>`;
    }
  }
}

export function serializeSvg(doc: VectorDocument): string {
  const background = doc.background
    ? `\n  <rect x="0" y="0" width="${doc.width}" height="${doc.height}" fill="${escapeAttr(doc.background)}"/>`
    : "";
  const body = doc.objects
    .filter((object) => !object.hidden)
    .map((object) => `\n  ${objectToSvg(object)}`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">${background}${body}\n</svg>\n`;
}

export async function rasterizePng(
  doc: VectorDocument,
  scale = 2,
): Promise<Blob> {
  const svg = serializeSvg(doc);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not rasterize the artboard"));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(doc.width * scale));
  canvas.height = Math.max(1, Math.round(doc.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed"));
    }, "image/png");
  });
}
