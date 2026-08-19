"use client";

import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

const DOCK_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

type DockCorner = (typeof DOCK_CORNERS)[number];

const DOCK_CORNER_KEY = "digitools.flow-dock-corner-v1";

/** True only for a corner this component actually renders. localStorage is
 *  user-editable, so a restored value must pass this before it is trusted. */
function isDockCorner(value: unknown): value is DockCorner {
  return (
    typeof value === "string" &&
    (DOCK_CORNERS as readonly string[]).includes(value)
  );
}

// The deck's corner nav: a small floating card owning Back/Next (plus an
// optional extra control block - the CRAFT deck stacks its world switcher
// there). It is a little window, not fixed furniture (owner, 2026-08-19):
// grab the handle and push it toward any corner of the workspace and it
// slides there, and the chosen corner persists per browser.
export function FlowNavDock({
  onBack,
  onNext,
  nextLabel,
  children,
}: {
  // Omitted on the first panel - the Back button renders disabled.
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  children?: ReactNode;
}) {
  const [corner, setCorner] = useState<DockCorner>("bottom-right");
  const dockRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // Deferred restore, same pattern as the saved art pack: the default corner
  // paints first, the stored one applies after mount.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(DOCK_CORNER_KEY);
        if (isDockCorner(stored)) {
          setCorner(stored);
        }
      } catch {
        // Storage unavailable - the default corner is fine.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function placeCorner(next: DockCorner) {
    setCorner(next);
    try {
      window.localStorage.setItem(DOCK_CORNER_KEY, next);
    } catch {
      // Storage unavailable - the move still applies for this page.
    }
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dock = dockRef.current;
    if (!dock || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    dock.style.transition = "none";
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dock = dockRef.current;
    const drag = dragRef.current;
    if (!dock || !drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) {
      return;
    }
    drag.moved = true;
    dock.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dock = dockRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    if (!dock || !drag) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) {
      dock.style.transition = "";
      dock.style.transform = "";
      return;
    }

    // Snap to whichever quadrant of the workspace the dock's center ended in.
    const before = dock.getBoundingClientRect();
    const bounds = (
      dock.offsetParent instanceof HTMLElement ? dock.offsetParent : null
    )?.getBoundingClientRect();
    let next = corner;
    if (bounds) {
      const vertical =
        before.top + before.height / 2 < bounds.top + bounds.height / 2
          ? "top"
          : "bottom";
      const horizontal =
        before.left + before.width / 2 < bounds.left + bounds.width / 2
          ? "left"
          : "right";
      next = `${vertical}-${horizontal}` as DockCorner;
    }

    // FLIP the settle: move the anchor synchronously, keep the dock visually
    // where the pointer left it, then let the transform transition to zero.
    dock.style.transform = "";
    dock.dataset.corner = next;
    const after = dock.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    placeCorner(next);
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      dock.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        dock.style.transition = "";
        dock.style.transform = "";
      });
    } else {
      dock.style.transition = "";
    }
  }

  function moveByKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const [vertical, horizontal] = corner.split("-");
    const next =
      event.key === "ArrowUp"
        ? `top-${horizontal}`
        : event.key === "ArrowDown"
          ? `bottom-${horizontal}`
          : event.key === "ArrowLeft"
            ? `${vertical}-left`
            : event.key === "ArrowRight"
              ? `${vertical}-right`
              : null;
    if (!next || next === corner) {
      return;
    }
    event.preventDefault();
    placeCorner(next as DockCorner);
  }

  return (
    <div
      className="flow-nav-dock"
      data-component="Dock:FlowNav"
      data-corner={corner}
      ref={dockRef}
    >
      <div
        className="flow-nav-dock-handle"
        role="button"
        tabIndex={0}
        aria-label={`Move navigation dock. In the ${corner.replace("-", " ")} corner; arrow keys move it.`}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={moveByKeys}
      >
        <span aria-hidden="true" />
      </div>
      {children}
      <div className="flow-nav-dock-row">
        <button
          className="button button-secondary"
          type="button"
          onClick={onBack}
          disabled={!onBack}
        >
          Back
        </button>
        <button className="button button-primary" type="button" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
