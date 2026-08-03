"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CardIllustrationFrame } from "@/components/prompt-builder-ui";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { isCustomArchetype } from "@/lib/prompt-custom-archetypes";
import { getFloatingPanelPosition } from "@/lib/floating-panel-position";
import { readStoredStringArray, writeStored } from "@/lib/prompt-storage";
import type { PromptArchetype } from "@/lib/prompt-archetypes";
import type { PromptRole } from "@/lib/prompt-types";

const FAVORITES_KEY = "digitools.prompt-builder.favorites-v1";

export function PromptArchetypeToolbar({
  archetypes,
  customArchetypes,
  roles,
  activeId,
  onApply,
  onSaveCustom,
  onDeleteCustom,
}: {
  archetypes: readonly PromptArchetype[];
  customArchetypes: readonly PromptArchetype[];
  roles: readonly PromptRole[];
  activeId: string | null;
  onApply: (archetype: PromptArchetype) => void;
  onSaveCustom: (name: string) => void;
  onDeleteCustom: (id: string) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState("");
  const portalTarget = usePortalTarget();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFavorites(readStoredStringArray(FAVORITES_KEY));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const allArchetypes = [...customArchetypes, ...archetypes];
  const orderedArchetypes = [
    ...allArchetypes.filter((archetype) => favorites.includes(archetype.id)),
    ...allArchetypes.filter((archetype) => !favorites.includes(archetype.id)),
  ];

  const previewArchetype = allArchetypes.find(
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
    ? Object.values(previewArchetype.equipped ?? {}).reduce(
        (total, cardIds) => total + (cardIds?.length ?? 0),
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

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id];
      writeStored(FAVORITES_KEY, next);
      return next;
    });
  }

  function confirmSavePreset() {
    onSaveCustom(presetName);
    setPresetName("");
    setSaving(false);
  }

  return (
    <aside className="archetype-toolbar" aria-labelledby="archetype-title">
      <div className="archetype-toolbar-heading">
        <span>Auto C.R.A.F.T.</span>
        <strong id="archetype-title">Archetypes</strong>
        <small>Presets fill the deck. You still write Context and Target.</small>
        {saving ? (
          <div className="archetype-save-form">
            <input
              type="text"
              value={presetName}
              placeholder="Preset name"
              aria-label="Preset name"
              onChange={(event) => setPresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmSavePreset();
                }
                if (event.key === "Escape") {
                  setSaving(false);
                  setPresetName("");
                }
              }}
            />
            <button type="button" onClick={confirmSavePreset}>
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setSaving(false);
                setPresetName("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="archetype-save-button"
            type="button"
            onClick={() => setSaving(true)}
          >
            Save current as preset
          </button>
        )}
      </div>
      <div className="archetype-toolbar-list">
        {orderedArchetypes.map((archetype) => {
          const active = activeId === archetype.id;
          const favorite = favorites.includes(archetype.id);
          const custom = isCustomArchetype(archetype);

          return (
            <div className="archetype-item" key={archetype.id}>
              <button
                className={
                  active ? "archetype-button is-active" : "archetype-button"
                }
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
              >
                <span className="archetype-glyph" aria-hidden="true">
                  {archetype.code}
                </span>
                <strong>{archetype.name}</strong>
                <small>{archetype.description}</small>
              </button>
              <button
                className={
                  favorite ? "archetype-star is-active" : "archetype-star"
                }
                type="button"
                onClick={() => toggleFavorite(archetype.id)}
                aria-pressed={favorite}
                aria-label={
                  favorite ? `Unpin ${archetype.name}` : `Pin ${archetype.name}`
                }
              >
                {favorite ? "★" : "☆"}
              </button>
              {custom ? (
                <button
                  className="archetype-delete"
                  type="button"
                  onClick={() => onDeleteCustom(archetype.id)}
                  aria-label={`Delete ${archetype.name} preset`}
                >
                  x
                </button>
              ) : null}
            </div>
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
