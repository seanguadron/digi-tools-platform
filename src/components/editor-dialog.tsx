"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// The shared modal dialog for editor tools: portal + backdrop + Escape, and
// the two things the older per-tool dialogs never had — a focus trap (Tab
// cycles inside) and focus restore to the opener on close. New dialogs use
// this; the image editor's three older dialogs migrate as they're touched
// (docs/ROADMAP.md continuity thread).

// Tabbable, not merely focusable: every clause excludes tabindex="-1". The
// roving-tabindex groups (useRovingRadioGroup) park -1 on their unchecked
// options, and those are still `button:not([disabled])` — so without this the
// trap's first/last could be an option the browser skips, and Shift+Tab from
// the real first tabbable would fall straight out of the modal.
const FOCUSABLE =
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

export function EditorDialog({
  open,
  label,
  onClose,
  children,
  className,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Callers pass inline arrows, so onClose is a new identity every render.
  // Reading it through a ref keeps the trap effect keyed on `open` alone —
  // otherwise every parent render tears the effect down and its cleanup
  // yanks focus back out of the dialog it just opened. The ref is written
  // in its own effect (never during render).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey, { capture: true });
    // Focus the first field. The portal's children are already committed to
    // the DOM when this effect runs, so focus directly rather than waiting
    // on a frame — rAF never fires in a backgrounded tab, which would leave
    // the dialog open with focus stranded on <body>.
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      restoreRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="editor-dialog-backdrop"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={className ? `editor-dialog ${className}` : "editor-dialog"}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
