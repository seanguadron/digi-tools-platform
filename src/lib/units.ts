// Physical-unit conversion shared by the image and vector editors. Pixels are
// the master unit everywhere in the documents; inches/centimeters/millimeters
// are a VIEW through the document's PPI (pixels per inch). Deliberately
// import-free so the node test runner can load it directly.

export type PhysicalUnit = "in" | "cm" | "mm";
export type DocUnit = "px" | PhysicalUnit;

export const DOC_UNITS: DocUnit[] = ["px", "in", "cm", "mm"];

export const DEFAULT_DOC_PPI = 300;
export const MIN_DOC_PPI = 1;
export const MAX_DOC_PPI = 1200;

const UNITS_PER_INCH: Record<PhysicalUnit, number> = {
  in: 1,
  cm: 2.54,
  mm: 25.4,
};

export function isDocUnit(value: unknown): value is DocUnit {
  return value === "px" || value === "in" || value === "cm" || value === "mm";
}

export function clampPpi(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DOC_PPI;
  return Math.min(MAX_DOC_PPI, Math.max(MIN_DOC_PPI, Math.round(value)));
}

// A size expressed in `unit` becomes pixels at the given PPI.
export function toPx(value: number, unit: DocUnit, ppi: number): number {
  if (unit === "px") return value;
  return (value / UNITS_PER_INCH[unit]) * ppi;
}

// A pixel size expressed in `unit` at the given PPI.
export function fromPx(px: number, unit: DocUnit, ppi: number): number {
  if (unit === "px") return px;
  return (px / ppi) * UNITS_PER_INCH[unit];
}

// Round for display: whole pixels, sensible decimals for physical units.
export function roundForUnit(value: number, unit: DocUnit): number {
  if (unit === "px") return Math.round(value);
  return Math.round(value * 100) / 100;
}

export function formatSize(px: number, unit: DocUnit, ppi: number): string {
  const value = roundForUnit(fromPx(px, unit, ppi), unit);
  return `${value} ${unit}`;
}
