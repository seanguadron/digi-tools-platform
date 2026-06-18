"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CardIllustrationFrame } from "@/components/prompt-builder-ui";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import type { PromptArchetype } from "@/lib/prompt-archetypes";
import type { PromptRole } from "@/lib/prompt-types";

const FLOATING_PANEL_WIDTH = 390;
const FLOATING_PANEL_GAP = 12;
const FLOATING_PANEL_MARGIN = 16;
const FLOATING_PANEL_MAX_HEIGHT = 480;

function getFloatingPanelPosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const rightSideLeft = rect.right + FLOATING_PANEL_GAP;
  const leftSideLeft = rect.left - FLOATING_PANEL_WIDTH - FLOATING_PANEL_GAP;
  const fitsRight =
    rightSideLeft + FLOATING_PANEL_WIDTH <=
    window.innerWidth - FLOATING_PANEL_MARGIN;
  const left = fitsRight
    ? rightSideLeft
    : Math.max(FLOATING_PANEL_MARGIN, leftSideLeft);
  const top = Math.min(
    Math.max(FLOATING_PANEL_MARGIN, rect.top),
    Math.max(
      FLOATING_PANEL_MARGIN,
      window.innerHeight - FLOATING_PANEL_MAX_HEIGHT - FLOATING_PANEL_MARGIN,
    ),
  );

  return {
    left,
    top,
  };
}

export function PromptArchetypeToolbar({
  archetypes,
  roles,
  activeId,
  onApply,
}: {
  archetypes: readonly PromptArchetype[];
  roles: readonly PromptRole[];
  activeId: string | null;
  onApply: (archetype: PromptArchetype) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const portalTarget =
    typeof document === "undefined" ? null : document.body;
  const previewArchetype = archetypes.find(
    (archetype) => archetype.id === previewId,
  );
  const previewFormat = previewArchetype
    ? FORMAT_OPTIONS.find((format) => format.code === previewArchetype.formatCode)
    : null;
  const previewRoles = previewArchetype
    ? previewArchetype.roleIds
        .map((roleId) => roles.find((role) => role.id === roleId)?.name)
        .filter((name): name is string => Boolean(name))
    : [];
  const previewCardCount = previewArchetype
    ? Object.values(previewArchetype.equipped).reduce(
        (total, cardIds) => total + cardIds.length,
        0,
      )
    : 0;

  function previewArchetypeCard(archetypeId: string, element: HTMLElement) {
    setPreviewId(archetypeId);
    setPreviewAnchor(getFloatingPanelPosition(element));
  }

  function clearPreview() {
    setPreviewId(null);
    setPreviewAnchor(null);
  }

  return (
    <aside className="archetype-toolbar" aria-labelledby="archetype-title">
      <div className="archetype-toolbar-heading">
        <span>Auto C.R.A.F.T.</span>
        <strong id="archetype-title">Archetypes</strong>
        <small>Presets fill the deck. You still write Context and Target.</small>
      </div>
      <div className="archetype-toolbar-list">
        {archetypes.map((archetype) => {
          const active = activeId === archetype.id;

          return (
            <button
              className={active ? "archetype-button is-active" : "archetype-button"}
              type="button"
              onClick={() => onApply(archetype)}
              onMouseEnter={(event) =>
                previewArchetypeCard(archetype.id, event.currentTarget)
              }
              onMouseLeave={clearPreview}
              onFocus={(event) =>
                previewArchetypeCard(archetype.id, event.currentTarget)
              }
              onBlur={clearPreview}
              aria-pressed={active}
              aria-label={`Apply ${archetype.name} archetype. ${archetype.description}`}
              key={archetype.id}
            >
              <CardIllustrationFrame
                className="archetype-card-art"
                illustration={archetype.illustration}
                fallback={archetype.code.slice(0, 1)}
              />
              <span>{archetype.code}</span>
              <strong>{archetype.name}</strong>
            </button>
          );
        })}
      </div>
      {portalTarget && previewArchetype && previewAnchor
        ? createPortal(
            <aside
              className="floating-card-panel floating-card-panel--archetype"
              style={previewAnchor}
              aria-live="polite"
            >
              <CardIllustrationFrame
                className="floating-card-art"
                illustration={previewArchetype.illustration}
                fallback={previewArchetype.code.slice(0, 1)}
              />
              <div className="floating-card-panel-identity">
                <span>Archetype / {previewArchetype.code}</span>
                <strong>{previewArchetype.name}</strong>
                <p>{previewArchetype.description}</p>
              </div>
              <div className="ability-guidance">
                <span>What this preset changes</span>
                <ul>
                  {previewArchetype.effects.map((effect) => (
                    <li key={effect}>{effect}</li>
                  ))}
                </ul>
              </div>
              <code>
                Output: {previewFormat?.name ?? previewArchetype.formatCode}.
                Roles: {previewRoles.join(", ") || "none"}. Equipped cards:{" "}
                {previewCardCount}.
              </code>
            </aside>,
            portalTarget,
          )
        : null}
    </aside>
  );
}
