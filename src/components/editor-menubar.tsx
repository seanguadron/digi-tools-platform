"use client";

import { useRef, useState } from "react";

// A classic application menu bar (File / Edit / Image / …), keyboard
// navigable. All commands are supplied by the caller — this component owns
// only open/close + focus, never the actions themselves.

export interface MenuItem {
  label: string;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  separator?: boolean; // renders a divider; label/onSelect ignored
  checked?: boolean; // shows a leading check mark (toggle items)
}

export interface MenuDef {
  id: string;
  label: string;
  items: MenuItem[];
}

interface EditorMenubarProps {
  menus: MenuDef[];
  /** Accessible name for the menubar. */
  label: string;
  className?: string;
}

export function EditorMenubar({ menus, label, className }: EditorMenubarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const topRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openIndex = menus.findIndex((menu) => menu.id === openId);

  function focusFirstItem() {
    requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not([disabled])')
        ?.focus();
    });
  }

  function openAt(index: number, focusItem: boolean) {
    const menu = menus[(index + menus.length) % menus.length];
    setOpenId(menu.id);
    if (focusItem) {
      focusFirstItem();
    }
  }

  function close(focusTop: boolean) {
    const index = openIndex;
    setOpenId(null);
    if (focusTop && index >= 0) {
      topRefs.current[index]?.focus();
    }
  }

  function moveItemFocus(current: HTMLElement, delta: number) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role^="menuitem"]:not([disabled])',
      ) ?? [],
    );
    if (items.length === 0) {
      return;
    }
    const pos = items.indexOf(current as HTMLButtonElement);
    const next = (pos + delta + items.length) % items.length;
    items[next]?.focus();
  }

  function edgeItem(which: "first" | "last") {
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not([disabled])',
    );
    if (!items || items.length === 0) {
      return;
    }
    (which === "first" ? items[0] : items[items.length - 1]).focus();
  }

  return (
    <div
      className={className ? `editor-menubar ${className}` : "editor-menubar"}
      role="menubar"
      aria-label={label}
    >
      {openId ? (
        <button
          type="button"
          className="editor-menubar-backdrop"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => close(false)}
        />
      ) : null}

      {menus.map((menu, index) => {
        const isOpen = menu.id === openId;
        return (
          <div className="editor-menubar-item" key={menu.id}>
            <button
              type="button"
              ref={(el) => {
                topRefs.current[index] = el;
              }}
              className={isOpen ? "editor-menu-top is-open" : "editor-menu-top"}
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : menu.id)}
              onPointerEnter={() => {
                if (openId && !isOpen) {
                  setOpenId(menu.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  openAt(index, true);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  openAt(index + 1, isOpen);
                  if (!isOpen) {
                    topRefs.current[(index + 1) % menus.length]?.focus();
                  }
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  openAt(index - 1, isOpen);
                  if (!isOpen) {
                    topRefs.current[
                      (index - 1 + menus.length) % menus.length
                    ]?.focus();
                  }
                } else if (event.key === "Escape" && isOpen) {
                  event.preventDefault();
                  close(true);
                }
              }}
            >
              {menu.label}
            </button>

            {isOpen ? (
              <div
                className="editor-menu-dropdown"
                role="menu"
                aria-label={menu.label}
                ref={menuRef}
              >
                {menu.items.map((item, itemIndex) => {
                  if (item.separator) {
                    return (
                      <div
                        key={`sep-${itemIndex}`}
                        className="editor-menu-separator"
                        role="separator"
                      />
                    );
                  }
                  const checkable = item.checked !== undefined;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      role={checkable ? "menuitemcheckbox" : "menuitem"}
                      className="editor-menu-option"
                      disabled={item.disabled}
                      aria-checked={checkable ? item.checked : undefined}
                      onClick={() => {
                        item.onSelect?.();
                        close(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          moveItemFocus(event.currentTarget, 1);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          moveItemFocus(event.currentTarget, -1);
                        } else if (event.key === "Home") {
                          event.preventDefault();
                          edgeItem("first");
                        } else if (event.key === "End") {
                          event.preventDefault();
                          edgeItem("last");
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          close(true);
                        } else if (event.key === "ArrowRight") {
                          event.preventDefault();
                          openAt(index + 1, true);
                        } else if (event.key === "ArrowLeft") {
                          event.preventDefault();
                          openAt(index - 1, true);
                        }
                      }}
                    >
                      <span className="editor-menu-check" aria-hidden="true">
                        {item.checked ? "✓" : ""}
                      </span>
                      <span className="editor-menu-label">{item.label}</span>
                      {item.shortcut ? (
                        <span className="editor-menu-shortcut">
                          {item.shortcut}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
