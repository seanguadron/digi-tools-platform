"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Viewport } from "@/lib/image-editor/raster";
import type { Point } from "@/lib/image-editor/types";

const MIN_SCALE = 0.02;
const MAX_SCALE = 32;

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

// Owns the pan/zoom transform and measures the stage via ResizeObserver. Screen
// <-> document coordinate conversion uses the transform + the live stage rect.
export function useCanvasViewport() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<Viewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Center `docWidth`×`docHeight` in the stage at a scale that fits with padding.
  const fit = useCallback(
    (docWidth: number, docHeight: number, padding = 48) => {
      const el = stageRef.current;
      const width = el?.clientWidth ?? size.width;
      const height = el?.clientHeight ?? size.height;
      // Bail on a missing or degenerate (collapsed) container — fitting into a
      // sub-pixel box yields a meaningless transform. Leaves the identity view.
      if (width < 2 || height < 2 || !docWidth || !docHeight) {
        return;
      }
      const scale = clampScale(
        Math.min(
          (width - padding) / docWidth,
          (height - padding) / docHeight,
          1,
        ),
      );
      setView({
        scale,
        offsetX: (width - docWidth * scale) / 2,
        offsetY: (height - docHeight * scale) / 2,
      });
    },
    [size.width, size.height],
  );

  // Set an absolute zoom keeping the document center fixed in the stage.
  const zoomTo = useCallback((nextScale: number) => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const width = el.clientWidth;
    const height = el.clientHeight;
    setView((current) => {
      const scale = clampScale(nextScale);
      const cx = width / 2;
      const cy = height / 2;
      const docX = (cx - current.offsetX) / current.scale;
      const docY = (cy - current.offsetY) / current.scale;
      return {
        scale,
        offsetX: cx - docX * scale,
        offsetY: cy - docY * scale,
      };
    });
  }, []);

  // Zoom by a factor keeping the point under the cursor fixed (wheel zoom).
  const zoomAt = useCallback((factor: number, screenX: number, screenY: number) => {
    const el = stageRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const px = screenX - rect.left;
    const py = screenY - rect.top;
    setView((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return {
        scale,
        offsetX: px - (px - current.offsetX) * ratio,
        offsetY: py - (py - current.offsetY) * ratio,
      };
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setView((current) => ({
      ...current,
      offsetX: current.offsetX + dx,
      offsetY: current.offsetY + dy,
    }));
  }, []);

  // Convert a client (mouse) coordinate to document space using the live rect.
  const screenToDoc = useCallback((clientX: number, clientY: number): Point => {
    const el = stageRef.current;
    const rect = el?.getBoundingClientRect();
    const v = viewRef.current;
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (clientX - left - v.offsetX) / v.scale,
      y: (clientY - top - v.offsetY) / v.scale,
    };
  }, []);

  return {
    stageRef,
    size,
    view,
    setView,
    fit,
    zoomTo,
    zoomAt,
    panBy,
    screenToDoc,
  };
}
