"use client";

import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  CardIllustrationFrame,
  RoleCardFace,
  roleCategoryCode,
} from "@/components/prompt-builder-ui";
import { useCardDeckMotion } from "@/hooks/use-card-deck-motion";
import { attachCardDragPreview } from "@/lib/card-motion";
import { getFloatingPanelPosition } from "@/lib/floating-panel-position";
import type { PromptRole } from "@/lib/prompt-types";

const ROLE_DRAG_TYPE = "application/x-digitools-role";

export function PromptRoleWorkbench({
  roles,
  selectedRoleIds,
  activeCategory,
  selectionMessage,
  onCategoryChange,
  onToggleRole,
  onDropRole,
  onClearRoles,
}: {
  roles: PromptRole[];
  selectedRoleIds: string[];
  activeCategory: string;
  selectionMessage: string;
  onCategoryChange: (category: string) => void;
  onToggleRole: (role: PromptRole) => void;
  onDropRole: (slotIndex: number, roleId: string) => void;
  onClearRoles: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [previewRoleId, setPreviewRoleId] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [draggingSource, setDraggingSource] = useState<string | null>(null);
  const [settlingSlot, setSettlingSlot] = useState({
    index: -1,
    token: 0,
  });
  const dragPreviewCleanupRef = useRef<null | (() => void)>(null);
  const deckMotion = useCardDeckMotion();
  const slotMotion = useCardDeckMotion();
  const portalTarget =
    typeof document === "undefined" ? null : document.body;

  const categories = useMemo(
    () => Array.from(new Set(roles.map((role) => role.category))),
    [roles],
  );
  const selectedRoles = useMemo(
    () =>
      selectedRoleIds
        .map((roleId) => roles.find((role) => role.id === roleId))
        .filter((role): role is PromptRole => Boolean(role)),
    [roles, selectedRoleIds],
  );
  const categoryRoles = useMemo(
    () => roles.filter((role) => role.category === activeCategory),
    [activeCategory, roles],
  );
  const visibleRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return categoryRoles;
    }

    return roles.filter((role) =>
      [
        role.name,
        role.category,
        role.description,
        role.ability.summary,
        ...role.ability.bullets,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [categoryRoles, roles, searchQuery]);
  const previewRole = roles.find((role) => role.id === previewRoleId);
  const previewRoleGoals = previewRole
    ? previewRole.ability.bullets.slice(0, 3)
    : [];

  function previewRoleCard(roleId: string, element: HTMLElement) {
    setPreviewRoleId(roleId);
    setPreviewAnchor(getFloatingPanelPosition(element));
  }

  function clearRolePreview() {
    setPreviewRoleId(null);
    setPreviewAnchor(null);
  }

  function beginRoleDrag(
    event: DragEvent<HTMLElement>,
    roleId: string,
    source: string,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ROLE_DRAG_TYPE, roleId);
    event.dataTransfer.setData("text/plain", roleId);
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = attachCardDragPreview(
      event.currentTarget,
      event.dataTransfer,
      event.clientX,
      event.clientY,
    );
    setDraggingSource(source);
  }

  function endRoleDrag() {
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = null;
    setDraggingSource(null);
    clearRolePreview();
  }

  return (
    <>
      <div className="role-loadout-summary">
        <div className="role-loadout-summary-heading">
          <strong>Loadout</strong>
          <span>{selectedRoles.length}/3</span>
        </div>
        <div
          className="role-loadout-slots"
          onPointerMove={slotMotion.onPointerMove}
          onPointerLeave={slotMotion.onPointerLeave}
        >
          {[0, 1, 2].map((slotIndex) => {
            const role = selectedRoles[slotIndex];
            const slotLabel =
              slotIndex === 0 ? "Lead" : `Support ${slotIndex}`;

            return (
              <div
                className={
                  role
                    ? "role-loadout-slot is-filled"
                    : "role-loadout-slot"
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const roleId =
                    event.dataTransfer.getData(ROLE_DRAG_TYPE) ||
                    event.dataTransfer.getData("text/plain");
                  onDropRole(slotIndex, roleId);
                  clearRolePreview();
                  setSettlingSlot((current) => ({
                    index: slotIndex,
                    token: current.token + 1,
                  }));
                }}
                key={slotLabel}
                role="group"
                aria-label={
                  role
                    ? `${slotLabel}: ${role.name}`
                    : `${slotLabel}: empty`
                }
              >
                <span>{slotLabel}</span>
                {role ? (
                  <div
                    className={[
                      "role-perk-card role-slot-card is-selected",
                      draggingSource === `slot-${slotIndex}`
                        ? "is-dragging"
                        : "",
                      settlingSlot.index === slotIndex ? "is-settling" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    draggable
                    data-motion-card
                    tabIndex={0}
                    onDragStart={(event) =>
                      beginRoleDrag(event, role.id, `slot-${slotIndex}`)
                    }
                    onDragEnd={endRoleDrag}
                    onMouseEnter={(event) =>
                      previewRoleCard(role.id, event.currentTarget)
                    }
                    onMouseLeave={clearRolePreview}
                    onFocus={(event) =>
                      previewRoleCard(role.id, event.currentTarget)
                    }
                    onBlur={clearRolePreview}
                    aria-label={`Move ${role.name} from ${slotLabel.toLowerCase()} slot`}
                    key={`${role.id}-${settlingSlot.index === slotIndex ? settlingSlot.token : 0}`}
                  >
                    <RoleCardFace
                      role={role}
                      index={roles.findIndex(
                        (candidate) => candidate.id === role.id,
                      )}
                      status={slotLabel}
                    />
                  </div>
                ) : (
                  <strong>
                    <span className="role-slot-empty-mark" aria-hidden="true">
                      +
                    </span>
                  </strong>
                )}
                {role ? (
                  <button
                    type="button"
                    onClick={() => onToggleRole(role)}
                    aria-label={`Remove ${role.name} from ${slotLabel.toLowerCase()} slot`}
                  >
                    <span aria-hidden="true">x</span>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          className="loadout-clear-button"
          type="button"
          onClick={onClearRoles}
          disabled={selectedRoles.length === 0}
        >
          Clear
        </button>
        {selectionMessage ? (
          <p className="role-status-message" aria-live="polite">
            {selectionMessage}
          </p>
        ) : null}
      </div>

      <div
        className="role-card-grid"
        id="role-card-panel"
        role={searchQuery ? "region" : "tabpanel"}
        aria-label={searchQuery ? "Role search results" : undefined}
        aria-labelledby={
          searchQuery
            ? undefined
            : `role-category-tab-${Math.max(
                categories.indexOf(activeCategory),
                0,
              )}`
        }
        onPointerMove={deckMotion.onPointerMove}
        onPointerLeave={deckMotion.onPointerLeave}
      >
        {visibleRoles.map((role) => {
          const selectedIndex = selectedRoleIds.indexOf(role.id);
          const selected = selectedIndex >= 0;
          const previewed = previewRoleId === role.id;
          const loadoutLabel =
            selectedIndex === 0
              ? "LEAD"
              : selectedIndex > 0
                ? `SUPPORT ${selectedIndex}`
                : roleCategoryCode(role.category);

          return (
            <button
              className={[
                "role-perk-card",
                selected ? "is-selected" : "",
                previewed ? "is-previewed" : "",
                draggingSource === `deck-${role.id}` ? "is-dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              draggable
              data-motion-card
              onDragStart={(event) =>
                beginRoleDrag(event, role.id, `deck-${role.id}`)
              }
              onDragEnd={endRoleDrag}
              onClick={() => onToggleRole(role)}
              onMouseEnter={(event) =>
                previewRoleCard(role.id, event.currentTarget)
              }
              onMouseLeave={clearRolePreview}
              onFocus={(event) => previewRoleCard(role.id, event.currentTarget)}
              onBlur={clearRolePreview}
              aria-pressed={selected}
              aria-label={
                selected
                  ? `Remove ${role.name} from role loadout. ${role.description}`
                  : `Add ${role.name} to role loadout. ${role.description}`
              }
              key={role.id}
            >
              <RoleCardFace
                role={role}
                index={roles.findIndex(
                  (candidate) => candidate.id === role.id,
                )}
                status={selected ? loadoutLabel : undefined}
              />
            </button>
          );
        })}
        {visibleRoles.length === 0 ? (
          <p className="deck-empty-state">No matching roles.</p>
        ) : null}
      </div>

      <label className="deck-search role-deck-search">
        <span className="sr-only">Search all roles</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            clearRolePreview();
          }}
          placeholder="Find roles"
        />
        <small>{visibleRoles.length} shown</small>
      </label>

      <div
        className="role-category-tabs"
        id="role-category-tabs"
        role="tablist"
        aria-labelledby="role-category-tabs-label"
      >
        {categories.map((category, categoryIndex) => {
          const active = category === activeCategory;

          return (
            <button
              className={
                active
                  ? "role-category-tab is-active"
                  : "role-category-tab"
              }
              type="button"
              role="tab"
              id={`role-category-tab-${categoryIndex}`}
              aria-controls="role-card-panel"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                onCategoryChange(category);
                clearRolePreview();
              }}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                ) {
                  return;
                }

                event.preventDefault();
                const lastIndex = categories.length - 1;
                const nextIndex =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? lastIndex
                      : event.key === "ArrowRight"
                        ? (categoryIndex + 1) % categories.length
                        : (categoryIndex - 1 + categories.length) %
                          categories.length;

                onCategoryChange(categories[nextIndex]);
                clearRolePreview();
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [nextIndex]?.focus();
              }}
              key={category}
            >
              <span>{roleCategoryCode(category)}</span>
              {category.replace(/ roles$/i, "")}
            </button>
          );
        })}
      </div>

      {portalTarget && previewRole && previewAnchor
        ? createPortal(
            <aside
              className="floating-card-panel floating-card-panel--role"
              style={previewAnchor}
              aria-live="polite"
            >
              <CardIllustrationFrame
                className="floating-card-art"
                illustration={previewRole.illustration}
                fallback={previewRole.name.slice(0, 1).toUpperCase()}
              />
              <div className="floating-card-panel-identity">
                <span>{roleCategoryCode(previewRole.category)} / Role</span>
                <strong>{previewRole.name}</strong>
                <p>{previewRole.ability.summary}</p>
              </div>
              <div className="ability-guidance">
                <span>What this role does</span>
                <ul>
                  {previewRoleGoals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>
            </aside>,
            portalTarget,
          )
        : null}
    </>
  );
}
