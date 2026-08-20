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
    // The dock's box BEFORE this gesture translated it. Measured once: a live
    // rect already carries the transform we are computing, so deriving the
    // origin from it each move is self-referential and the clamp leaks
    // (integration gate, 2026-08-20 - a fling escaped by ~300px).
    baseLeft: number;
    baseTop: number;
    baseRight: number;
    baseBottom: number;
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

  // Publish the corner onto the workspace so the panel can reserve its
  // clearance on the side the dock actually occupies, and so anything else
  // anchored in a corner (the proof-scenario card) can step aside. The dock
  // floats over the panel, so without this a top-parked dock sits on the
  // panel's first heading - and the corner persists, so it would sit there
  // every visit (design gate, 2026-08-19).
  useEffect(() => {
    const workspace = dockRef.current?.offsetParent;
    if (!(workspace instanceof HTMLElement)) {
      return;
    }
    workspace.dataset.dockCorner = corner;
    return () => {
      delete workspace.dataset.dockCorner;
    };
  }, [corner]);

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
    dock.style.transition = "none";
    // Clear any residual transform before measuring, so the base box is the
    // dock's real anchored position rather than wherever a prior gesture left
    // it mid-settle.
    dock.style.transform = "";
    const base = dock.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      baseLeft: base.left,
      baseTop: base.top,
      baseRight: base.right,
      baseBottom: base.bottom,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dock = dockRef.current;
    const drag = dragRef.current;
    if (!dock || !drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const rawX = event.clientX - drag.startX;
    const rawY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(rawX, rawY) < 4) {
      return;
    }
    drag.moved = true;

    // Clamp to the workspace: a drag that can leave the box gives no sense of
    // where the dock may rest, and paints it over the toolbar and the header
    // on its way out (design gate, 2026-08-19). Clamped against the gesture's
    // base box, never against the live rect - see the note on dragRef.
    const bounds =
      dock.offsetParent instanceof HTMLElement
        ? dock.offsetParent.getBoundingClientRect()
        : null;
    let dx = rawX;
    let dy = rawY;
    if (bounds) {
      dx = Math.min(
        Math.max(rawX, bounds.left - drag.baseLeft),
        bounds.right - drag.baseRight,
      );
      dy = Math.min(
        Math.max(rawY, bounds.top - drag.baseTop),
        bounds.bottom - drag.baseBottom,
      );
    }
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
        // The behaviour is drag-and-drop, not press-to-activate: there is no
        // Enter/Space action, so name the role rather than let a screen reader
        // promise a button's contract (WAI-ARIA APG drag-and-drop).
        aria-roledescription="drag handle"
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
