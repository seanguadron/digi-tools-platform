"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  formatSaveStatusLabel,
  isSaveStateUnavailable,
  type SaveStatus,
} from "@/lib/save-status";

// The shell handshake (docs/ARCHITECTURE.md §2): a render-time, SSR-guarded
// portal into #app-subbar-slot. The root must be `.prompt-subbar` with no
// wrapper element — the slot is `display: contents` and the shell hides its
// default text via `.context-bar:has(.prompt-subbar)`. No effect/mounted
// gate: deferring the portal blanks the bar for a frame.
export function ToolSubbar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const target =
    typeof document === "undefined"
      ? null
      : document.getElementById("app-subbar-slot");

  if (!target) {
    return null;
  }

  return createPortal(
    <div
      className={className ? `prompt-subbar ${className}` : "prompt-subbar"}
      data-component="Header:Tool"
    >
      {children}
    </div>,
    target,
  );
}

export function ToolSubbarTitle({
  kicker,
  heading,
  children,
}: {
  kicker: string;
  heading: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="prompt-flow-title">
      <span className="tool-kicker">{kicker}</span>
      <h1>{heading}</h1>
      {children}
    </div>
  );
}

export function ToolSaveStateChip({
  status,
  lastSavedAt,
  restoringLabel,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
  restoringLabel?: string;
}) {
  return (
    <span
      className={
        isSaveStateUnavailable(status)
          ? "builder-save-state is-unavailable"
          : "builder-save-state"
      }
      role="status"
    >
      {formatSaveStatusLabel(
        status,
        lastSavedAt,
        restoringLabel ? { restoring: restoringLabel } : undefined,
      )}
    </span>
  );
}

export function ToolSubbarActions({ children }: { children: ReactNode }) {
  return <div className="prompt-flow-header-actions">{children}</div>;
}
