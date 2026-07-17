"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePortalTarget } from "@/hooks/use-portal-target";
import {
  formatSaveStatusLabel,
  isSaveStateUnavailable,
  type SaveStatus,
} from "@/lib/save-status";

// The shell handshake (docs/ARCHITECTURE.md §2): a portal into
// #app-subbar-slot. The root must be `.prompt-subbar` with no wrapper element
// — the slot is `display: contents` and the shell hides its default text via
// `.context-bar:has(.prompt-subbar)`.
//
// The slot is resolved by usePortalTarget, never read from the DOM during
// render — see that hook for why a render-time read cost these routes their
// theme. The portal still lands before paint, so the bar never blanks (the
// concern that originally argued against deferring it).
export function ToolSubbar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const target = usePortalTarget("app-subbar-slot");

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
