"use client";

import { useRef } from "react";
import type { PointerEvent } from "react";
import { getCardTilt } from "@/lib/card-motion";

const MOTION_QUERY =
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

function resetCards(container: HTMLElement) {
  container
    .querySelectorAll<HTMLElement>("[data-motion-card]")
    .forEach((card) => {
      card.style.removeProperty("--card-tilt-x");
      card.style.removeProperty("--card-tilt-y");
    });
}

export function useCardDeckMotion() {
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLElement | null>(null);

  function updateCards() {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container
      .querySelectorAll<HTMLElement>("[data-motion-card]")
      .forEach((card) => {
        const tilt = getCardTilt(
          pointerRef.current.x,
          pointerRef.current.y,
          card.getBoundingClientRect(),
        );

        if (!tilt) {
          card.style.removeProperty("--card-tilt-x");
          card.style.removeProperty("--card-tilt-y");
          return;
        }

        card.style.setProperty("--card-tilt-x", `${tilt.rotateX.toFixed(2)}deg`);
        card.style.setProperty("--card-tilt-y", `${tilt.rotateY.toFixed(2)}deg`);
      });

    frameRef.current = null;
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!window.matchMedia(MOTION_QUERY).matches) {
      return;
    }

    containerRef.current = event.currentTarget;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(updateCards);
    }
  }

  function onPointerLeave(event: PointerEvent<HTMLElement>) {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    resetCards(event.currentTarget);
    containerRef.current = null;
  }

  return { onPointerMove, onPointerLeave };
}
