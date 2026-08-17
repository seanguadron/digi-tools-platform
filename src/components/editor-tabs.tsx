"use client";

import type { ReactNode } from "react";

// A small, accessible tab strip for editor docks (Layers / Channels / Properties
// / Adjust / History). Renders only the tablist; the parent renders the active
// panel and spreads `tabPanelProps(idBase, active)` onto it so the ARIA wiring
// (role, id, aria-labelledby) stays in sync. The roving-tabindex + arrow/Home/End
// keyboard model mirrors the role-category tablist in prompt-role-workbench.tsx.

export interface EditorTabDef {
  id: string;
  /** ReactNode so a tab can carry a status line under its name. */
  label: ReactNode;
  /** Extra class for a per-tab variant, e.g. a world that does not exist yet. */
  className?: string;
}

interface EditorTabsProps {
  tabs: EditorTabDef[];
  active: string;
  onChange: (id: string) => void;
  /** Prefix for the generated tab/panel element ids (must be unique per dock). */
  idBase: string;
  /** Accessible name for the tablist. */
  label: string;
  /** Container class, when a caller wants its own strip styling. */
  className?: string;
}

export function EditorTabs({
  tabs,
  active,
  onChange,
  idBase,
  label,
  className = "editor-tabs",
}: EditorTabsProps) {
  return (
    <div className={className} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idBase}-tab-${tab.id}`}
            aria-controls={`${idBase}-panel-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={[
              tab.className ?? "editor-tab",
              isActive ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                return;
              }
              event.preventDefault();
              const lastIndex = tabs.length - 1;
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? lastIndex
                    : event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : (index - 1 + tabs.length) % tabs.length;
              onChange(tabs[nextIndex].id);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [nextIndex]?.focus();
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Props to spread onto the active panel container so it is correctly associated
// with its tab. Keep `hidden` handling to the parent (it renders only the active
// panel), but this guarantees the id/label wiring matches EditorTabs.
export function tabPanelProps(idBase: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${idBase}-panel-${id}`,
    "aria-labelledby": `${idBase}-tab-${id}`,
    tabIndex: 0,
  };
}
