"use client";

import { useEffect, useRef, useState } from "react";
import { parseColor, rgbToHex } from "@/lib/image-editor/raster";

interface Hsv {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}

function hsvToRgb({ h, s, v }: Hsv): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) {
    h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

function hsvToHex(hsv: Hsv): string {
  const { r, g, b } = hsvToRgb(hsv);
  return rgbToHex(r, g, b);
}

const SWATCHES = [
  "#000000",
  "#ffffff",
  "#e5484d",
  "#f76b15",
  "#ffb224",
  "#46a758",
  "#12a594",
  "#0091ff",
  "#3e63dd",
  "#8e4ec6",
  "#e93d82",
  "#8b8b8b",
];

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  recentColors?: string[];
}

export function ImageEditorColorPicker({
  color,
  onChange,
  recentColors,
}: ColorPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => {
    const rgb = parseColor(color) ?? { r: 0, g: 0, b: 0 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const svRef = useRef<HTMLCanvasElement | null>(null);

  // Resync when the color prop changes from an EXTERNAL source (e.g. the
  // eyedropper), but not from our own emits (which already match). React's
  // "adjust state during render" pattern, guarded so an achromatic color
  // (where hue is undefined) doesn't snap the hue back to 0.
  const [prevColor, setPrevColor] = useState(color);
  if (color !== prevColor) {
    setPrevColor(color);
    if (color.toLowerCase() !== hsvToHex(hsv)) {
      const rgb = parseColor(color);
      if (rgb) {
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
      }
    }
  }

  // Paint the saturation/value square for the current hue.
  useEffect(() => {
    const canvas = svRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const { width, height } = canvas;
    const base = hsvToRgb({ h: hsv.h, s: 1, v: 1 });
    ctx.fillStyle = `rgb(${base.r}, ${base.g}, ${base.b})`;
    ctx.fillRect(0, 0, width, height);
    const white = ctx.createLinearGradient(0, 0, width, 0);
    white.addColorStop(0, "rgba(255,255,255,1)");
    white.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, width, height);
    const black = ctx.createLinearGradient(0, 0, 0, height);
    black.addColorStop(0, "rgba(0,0,0,0)");
    black.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, width, height);
  }, [hsv.h]);

  function emit(next: Hsv) {
    setHsv(next);
    onChange(hsvToHex(next));
  }

  function pickSv(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = svRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const s = clamp01((event.clientX - rect.left) / rect.width);
    const v = 1 - clamp01((event.clientY - rect.top) / rect.height);
    emit({ ...hsv, s, v });
  }

  const hex = hsvToHex(hsv);

  return (
    <div className="image-editor-picker" role="group" aria-label="Color picker">
      <canvas
        ref={svRef}
        width={200}
        height={140}
        className="image-editor-picker-sv"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickSv(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            pickSv(event);
          }
        }}
      />
      <label className="image-editor-picker-hue">
        <span className="image-editor-field-caption">Hue</span>
        <input
          type="range"
          min={0}
          max={360}
          value={Math.round(hsv.h)}
          onChange={(event) => emit({ ...hsv, h: Number(event.target.value) })}
        />
      </label>
      <div className="image-editor-picker-readout">
        <span
          className="image-editor-picker-chip"
          style={{ background: hex }}
          aria-hidden="true"
        />
        <input
          className="image-editor-picker-hex"
          type="text"
          value={hex}
          spellCheck={false}
          aria-label="Hex color"
          onChange={(event) => {
            const rgb = parseColor(event.target.value);
            if (rgb) {
              emit(rgbToHsv(rgb.r, rgb.g, rgb.b));
            }
          }}
        />
      </div>
      <div className="image-editor-picker-swatches">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="image-editor-swatch"
            style={{ background: swatch }}
            aria-label={`Use ${swatch}`}
            onClick={() => {
              const rgb = parseColor(swatch);
              if (rgb) {
                emit(rgbToHsv(rgb.r, rgb.g, rgb.b));
              }
            }}
          />
        ))}
      </div>

      {recentColors && recentColors.length > 0 ? (
        <div className="image-editor-picker-recent">
          <span className="image-editor-field-caption">Recent</span>
          <div className="image-editor-picker-swatches">
            {recentColors.map((swatch, index) => (
              <button
                key={`${swatch}-${index}`}
                type="button"
                className="image-editor-swatch"
                style={{ background: swatch }}
                aria-label={`Use ${swatch}`}
                onClick={() => {
                  const rgb = parseColor(swatch);
                  if (rgb) {
                    emit(rgbToHsv(rgb.r, rgb.g, rgb.b));
                  }
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
