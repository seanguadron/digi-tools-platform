"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BLOCK_TYPES, getBlockDefinition } from "@/lib/architect/blocks";
import type { ArchitectNode, BlockType } from "@/lib/architect/types";

type PaletteItem =
  | { kind: "node"; id: string; label: string; sub: string }
  | { kind: "add"; type: BlockType; label: string; sub: string };

export function ArchitectCommandPalette({
  nodes,
  onClose,
  onSelectNode,
  onAddBlock,
}: {
  nodes: ArchitectNode[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const portalTarget = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const nodeItems: PaletteItem[] = nodes
      .map((node) => ({
        kind: "node" as const,
        id: node.id,
        label: node.name.trim() || "Untitled component",
        sub: getBlockDefinition(node.type).label,
      }))
      .filter(
        (item) =>
          !q ||
          item.label.toLowerCase().includes(q) ||
          item.sub.toLowerCase().includes(q),
      );
    const addItems: PaletteItem[] = BLOCK_TYPES.filter(
      (block) => !q || block.label.toLowerCase().includes(q),
    ).map((block) => ({
      kind: "add" as const,
      type: block.id,
      label: `Add ${block.label}`,
      sub: block.glyph,
    }));
    return [...nodeItems, ...addItems];
  }, [nodes, query]);

  if (!portalTarget) {
    return null;
  }

  const clampedActive = Math.min(active, Math.max(0, items.length - 1));

  function choose(item: PaletteItem) {
    if (item.kind === "node") {
      onSelectNode(item.id);
    } else {
      onAddBlock(item.type);
    }
    onClose();
  }

  return createPortal(
    <>
      <button
        className="architect-modal-backdrop"
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
      />
      <div
        className="architect-command-palette"
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          className="architect-command-input"
          type="text"
          value={query}
          placeholder="Jump to a component, or add a block…"
          aria-label="Search components"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(value + 1, items.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const item = items[clampedActive];
              if (item) {
                choose(item);
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <ul className="architect-command-list">
          {items.length === 0 ? (
            <li className="architect-command-empty">No matches</li>
          ) : (
            items.map((item, index) => (
              <li key={item.kind === "node" ? `node-${item.id}` : `add-${item.type}`}>
                <button
                  type="button"
                  className={index === clampedActive ? "is-active" : ""}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  <span className="architect-command-label">{item.label}</span>
                  <span className="architect-command-sub">{item.sub}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="architect-command-hint" aria-hidden="true">
          ↑↓ to move · ↵ to choose · esc to close
        </div>
      </div>
    </>,
    portalTarget,
  );
}
