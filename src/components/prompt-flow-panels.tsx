"use client";

import type { RefObject } from "react";
import { PromptCardWorkbench } from "@/components/prompt-card-workbench";
import { PromptRoleWorkbench } from "@/components/prompt-role-workbench";
import {
  CraftCard,
  CraftDictationField,
  FieldHeading,
  FlowActions,
  type CraftDictationApi,
} from "@/components/prompt-builder-ui";
import { FORMAT_OPTIONS } from "@/lib/prompt-builder-options";
import {
  CRAFT_PARTS,
  isFieldComplete,
} from "@/lib/prompt-builder-state";
import type {
  CardSystemState,
  PromptDraft,
  PromptDraftTextField,
} from "@/lib/prompt-builder-state";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import { FLOW_PANEL_INDEX } from "@/lib/prompt-navigation";
import { craftCardEngine } from "@/lib/prompt-card-system";
import type { CardSection, TrackId } from "@/lib/prompt-card-system";
import type { PromptRole } from "@/lib/prompt-types";

export function CraftFlowPanels({
  activePanel,
  registerPanelHeading,
  flowViewportRef,
  draft,
  formatCode,
  cardSystem,
  selectedRoles,
  roles,
  attentionTargetId,
  roleWorkbenchVersion,
  activeRoleCategory,
  roleSelectionMessage,
  dictation,
  navigateToPanel,
  navigateToCraftStep,
  onSelectOutputType,
  onUpdateDraft,
  onSetUseDefault,
  onChangeTrack,
  onToggleCard,
  onDropCard,
  onRemoveCard,
  onClearCards,
  onApplyRecommended,
  onSetRoleCategory,
  onToggleRole,
  onDropRole,
  onClearRoles,
  onReviewOutput,
  onReset,
}: {
  activePanel: number;
  registerPanelHeading: (
    panelIndex: number,
    node: HTMLHeadingElement | null,
  ) => void;
  flowViewportRef: RefObject<HTMLDivElement | null>;
  draft: PromptDraft;
  formatCode: string;
  cardSystem: CardSystemState;
  selectedRoles: PromptRole[];
  roles: PromptRole[];
  attentionTargetId: string | null;
  roleWorkbenchVersion: number;
  activeRoleCategory: string;
  roleSelectionMessage: string;
  dictation: CraftDictationApi;
  navigateToPanel: (panelIndex: number, focusTargetId?: string) => void;
  navigateToCraftStep: (stepIndex: number) => void;
  onSelectOutputType: (value: string) => void;
  onUpdateDraft: (field: PromptDraftTextField, value: string) => void;
  onSetUseDefault: (
    field: "contextUseDefault" | "targetUseDefault",
    value: boolean,
  ) => void;
  onChangeTrack: (trackId: TrackId, value: number) => void;
  onToggleCard: (section: CardSection, lineageId: string) => void;
  onDropCard: (
    section: CardSection,
    slotIndex: number,
    lineageId: string,
  ) => void;
  onRemoveCard: (section: CardSection, slotIndex: number) => void;
  onClearCards: (section: CardSection) => void;
  onApplyRecommended: () => void;
  onSetRoleCategory: (category: string) => void;
  onToggleRole: (role: PromptRole) => void;
  onDropRole: (slotIndex: number, roleId: string) => void;
  onClearRoles: () => void;
  onReviewOutput: () => void;
  onReset: () => void;
}) {
  // Both output-type radio rows share the same options + selection, so one
  // active index feeds two roving groups (guide panel + format panel).
  const activeFormatIndex = FORMAT_OPTIONS.findIndex(
    (option) => option.value === draft.format,
  );
  const selectFormatAt = (index: number) => {
    const option = FORMAT_OPTIONS[index];
    if (option) onSelectOutputType(option.value);
  };
  const guideFormatGroup = useRovingRadioGroup(
    FORMAT_OPTIONS.length,
    activeFormatIndex,
    selectFormatAt,
  );
  const formatTabsGroup = useRovingRadioGroup(
    FORMAT_OPTIONS.length,
    activeFormatIndex,
    selectFormatAt,
  );

  return (
    <div className="flow-viewport" ref={flowViewportRef}>
      <div
        className="flow-track"
        style={{
          transform: `translate3d(-${activePanel * 100}%, 0, 0)`,
        }}
      >
        <section
          className="flow-panel flow-intro-panel"
          aria-hidden={activePanel !== FLOW_PANEL_INDEX.guide}
          inert={activePanel !== FLOW_PANEL_INDEX.guide}
        >
          <div className="craft-method" aria-labelledby="craft-method-title">
            <div className="craft-method-copy">
              <h2
                id="craft-method-title"
                tabIndex={-1}
                ref={(node) => {
                  registerPanelHeading(FLOW_PANEL_INDEX.guide, node);
                }}
              >
                Build with C.R.A.F.T.
              </h2>
              <p>
                Set the context, role, actions, format, and audience. Your
                prompt updates as you go.
              </p>
            </div>
            <section
              className="output-type-setup"
              aria-labelledby="output-type-setup-title"
            >
              <div className="workbench-section-heading">
                <div>
                  <strong id="output-type-setup-title">Output type</strong>
                </div>
                <small>{formatCode}</small>
              </div>
              <div className="output-type-card-row" role="radiogroup">
                {FORMAT_OPTIONS.map((option, index) => {
                  const selected = draft.format === option.value;
                  return (
                    <button
                      className={
                        selected
                          ? "output-type-card is-selected"
                          : "output-type-card"
                      }
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSelectOutputType(option.value)}
                      key={option.code}
                      {...guideFormatGroup.itemProps(index)}
                    >
                      <span>{option.code}</span>
                      <strong>{option.name}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="craft-definition" role="list">
              {CRAFT_PARTS.map(({ letter, label, summary }, index) => (
                <button
                  className="craft-definition-card"
                  type="button"
                  role="listitem"
                  onClick={() => navigateToCraftStep(index)}
                  key={letter}
                >
                  <span className="craft-definition-letter">{letter}</span>
                  <strong>{label}</strong>
                  <small>{summary}</small>
                </button>
              ))}
            </div>
            <FlowActions
              onNext={() => navigateToPanel(FLOW_PANEL_INDEX.context)}
              nextLabel="Start"
            />
          </div>
        </section>

        <section
          className="flow-panel"
          aria-hidden={activePanel !== FLOW_PANEL_INDEX.context}
          inert={activePanel !== FLOW_PANEL_INDEX.context}
        >
          <div className="flow-panel-heading">
            <span aria-hidden="true">C</span>
            <h2
              tabIndex={-1}
              ref={(node) => {
                registerPanelHeading(FLOW_PANEL_INDEX.context, node);
              }}
            >
              Context
            </h2>
          </div>

          <div className="flow-panel-card">
            <CraftCard letter="C" complete={isFieldComplete(draft, "context")}>
              <div className="field craft-field">
                <FieldHeading
                  field="context"
                  label="Context modifiers"
                  controlId="context-card-workbench"
                  labelControl={false}
                />
                <div id="context-card-workbench">
                  <PromptCardWorkbench
                    engine={craftCardEngine}
                    section="context"
                    vocabularyKey={formatCode}
                    values={cardSystem.tracks}
                    equippedIds={cardSystem.equipped.context}
                    suggestedId={cardSystem.suggested.context}
                    onTrackChange={onChangeTrack}
                    onToggleCard={(lineageId) =>
                      onToggleCard("context", lineageId)
                    }
                    onDropCard={(slotIndex, lineageId) =>
                      onDropCard("context", slotIndex, lineageId)
                    }
                    onRemoveCard={(slotIndex) =>
                      onRemoveCard("context", slotIndex)
                    }
                    onClearCards={() => onClearCards("context")}
                  />
                </div>
                <div className="workbench-text-row">
                  <label
                    className="workbench-text-label"
                    htmlFor="prompt-context"
                  >
                    Optional custom context
                  </label>
                  <label className="workbench-default-check">
                    <input
                      type="checkbox"
                      checked={draft.contextUseDefault}
                      onChange={(event) =>
                        onSetUseDefault(
                          "contextUseDefault",
                          event.target.checked,
                        )
                      }
                    />
                    Use default context
                  </label>
                </div>
                <CraftDictationField
                  id="prompt-context"
                  field="context"
                  label="Context"
                  value={draft.context}
                  placeholder="Describe the raw situation: goal, facts, source material, constraints, exclusions, uncertainty."
                  rows={4}
                  attention={attentionTargetId === "prompt-context"}
                  onChange={(value) => onUpdateDraft("context", value)}
                  dictation={dictation}
                />
              </div>
            </CraftCard>
          </div>
          <FlowActions
            onBack={() => navigateToPanel(FLOW_PANEL_INDEX.guide)}
            onNext={() => navigateToPanel(FLOW_PANEL_INDEX.role)}
          />
        </section>

        <section
          className="flow-panel"
          aria-hidden={activePanel !== FLOW_PANEL_INDEX.role}
          inert={activePanel !== FLOW_PANEL_INDEX.role}
        >
          <div className="flow-panel-heading">
            <span aria-hidden="true">R</span>
            <h2
              tabIndex={-1}
              ref={(node) => {
                registerPanelHeading(FLOW_PANEL_INDEX.role, node);
              }}
            >
              Roles
            </h2>
          </div>

          <div className="flow-panel-card">
            <CraftCard letter="R" complete={selectedRoles.length > 0}>
              <div className="field craft-field role-loadout">
                <FieldHeading
                  field="role"
                  label="Role"
                  controlId="role-loadout-target"
                  labelControl={false}
                />

                <div
                  id="role-loadout-target"
                  tabIndex={-1}
                  data-attention={
                    attentionTargetId === "role-loadout-target"
                      ? "true"
                      : undefined
                  }
                >
                  <PromptRoleWorkbench
                    key={roleWorkbenchVersion}
                    roles={roles}
                    selectedRoleIds={draft.roleIds}
                    activeCategory={activeRoleCategory}
                    selectionMessage={roleSelectionMessage}
                    onCategoryChange={onSetRoleCategory}
                    onToggleRole={onToggleRole}
                    onDropRole={onDropRole}
                    onClearRoles={onClearRoles}
                  />
                </div>
              </div>
            </CraftCard>
          </div>
          <FlowActions
            onBack={() => navigateToPanel(FLOW_PANEL_INDEX.context)}
            onNext={() => navigateToPanel(FLOW_PANEL_INDEX.action)}
          />
        </section>

        <section
          className="flow-panel"
          aria-hidden={activePanel !== FLOW_PANEL_INDEX.action}
          inert={activePanel !== FLOW_PANEL_INDEX.action}
        >
          <div className="flow-panel-heading">
            <span aria-hidden="true">A</span>
            <h2
              tabIndex={-1}
              ref={(node) => {
                registerPanelHeading(FLOW_PANEL_INDEX.action, node);
              }}
            >
              Actions
            </h2>
          </div>

          <div className="flow-panel-card">
            <CraftCard
              letter="A"
              complete={
                isFieldComplete(draft, "action") ||
                cardSystem.equipped.action.some(Boolean)
              }
            >
              <div className="field craft-field">
                <FieldHeading
                  field="action"
                  label="Action"
                  controlId="prompt-action"
                />
                <PromptCardWorkbench
                  engine={craftCardEngine}
                  section="action"
                  vocabularyKey={formatCode}
                  values={cardSystem.tracks}
                  equippedIds={cardSystem.equipped.action}
                  suggestedId={cardSystem.suggested.action}
                  onTrackChange={onChangeTrack}
                  onToggleCard={(lineageId) => onToggleCard("action", lineageId)}
                  onDropCard={(slotIndex, lineageId) =>
                    onDropCard("action", slotIndex, lineageId)
                  }
                  onRemoveCard={(slotIndex) => onRemoveCard("action", slotIndex)}
                  onClearCards={() => onClearCards("action")}
                />
                <label className="workbench-text-label" htmlFor="prompt-action">
                  Optional custom steps
                </label>
                <CraftDictationField
                  id="prompt-action"
                  field="action"
                  label="Action"
                  value={draft.action}
                  placeholder="Add any steps the cards do not cover."
                  rows={7}
                  required
                  attention={attentionTargetId === "prompt-action"}
                  onChange={(value) => onUpdateDraft("action", value)}
                  dictation={dictation}
                />
              </div>
            </CraftCard>
          </div>
          <FlowActions
            onBack={() => navigateToPanel(FLOW_PANEL_INDEX.role)}
            onNext={() => navigateToPanel(FLOW_PANEL_INDEX.format)}
          />
        </section>

        <section
          className="flow-panel"
          aria-hidden={activePanel !== FLOW_PANEL_INDEX.format}
          inert={activePanel !== FLOW_PANEL_INDEX.format}
        >
          <div className="flow-panel-heading">
            <span aria-hidden="true">F</span>
            <h2
              tabIndex={-1}
              ref={(node) => {
                registerPanelHeading(FLOW_PANEL_INDEX.format, node);
              }}
            >
              Format
            </h2>
          </div>

          <div className="flow-panel-card">
            <CraftCard letter="F" complete={isFieldComplete(draft, "format")}>
              <div className="field craft-field">
                <FieldHeading
                  field="format"
                  label="Format"
                  controlId="prompt-format-options"
                  labelControl={false}
                />
                <PromptCardWorkbench
                  engine={craftCardEngine}
                  section="format"
                  vocabularyKey={formatCode}
                  values={cardSystem.tracks}
                  equippedIds={cardSystem.equipped.format}
                  suggestedId={cardSystem.suggested.format}
                  onTrackChange={onChangeTrack}
                  onToggleCard={(lineageId) => onToggleCard("format", lineageId)}
                  onDropCard={(slotIndex, lineageId) =>
                    onDropCard("format", slotIndex, lineageId)
                  }
                  onRemoveCard={(slotIndex) => onRemoveCard("format", slotIndex)}
                  onClearCards={() => onClearCards("format")}
                />

                <section
                  className="format-filter-section"
                  aria-labelledby="output-type-filter-label"
                >
                  <div className="workbench-section-heading">
                    <strong id="output-type-filter-label">Output type</strong>
                    <small>{formatCode}</small>
                  </div>
                  <div
                    className="format-filter-tabs"
                    id="prompt-format-options"
                    role="radiogroup"
                    data-attention={
                      attentionTargetId === "prompt-format-options"
                        ? "true"
                        : undefined
                    }
                  >
                    {FORMAT_OPTIONS.map((option, index) => {
                      const selected = draft.format === option.value;

                      return (
                        <button
                          className={
                            selected
                              ? "format-filter-tab is-active"
                              : "format-filter-tab"
                          }
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onSelectOutputType(option.value)}
                          key={option.value}
                          {...formatTabsGroup.itemProps(index)}
                        >
                          <span>{option.code}</span>
                          <strong>{option.name}</strong>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {cardSystem.overrides.length > 0 ? (
                  <div className="recommended-setup-notice">
                    <span>
                      {cardSystem.overrides.length} track{" "}
                      {cardSystem.overrides.length === 1
                        ? "override"
                        : "overrides"}
                    </span>
                    <button type="button" onClick={onApplyRecommended}>
                      Use recommended
                    </button>
                  </div>
                ) : null}

                <div className="field">
                  <label htmlFor="prompt-format-notes">
                    Optional format notes
                  </label>
                  <CraftDictationField
                    id="prompt-format-notes"
                    field="formatNotes"
                    label="Format requirements"
                    value={draft.formatNotes}
                    placeholder="Length, sections, citations, or other requirements."
                    rows={4}
                    onChange={(value) => onUpdateDraft("formatNotes", value)}
                    dictation={dictation}
                  />
                </div>
              </div>
            </CraftCard>
          </div>
          <FlowActions
            onBack={() => navigateToPanel(FLOW_PANEL_INDEX.action)}
            onNext={() => navigateToPanel(FLOW_PANEL_INDEX.target)}
          />
        </section>

        <section
          className="flow-panel"
          aria-hidden={activePanel !== FLOW_PANEL_INDEX.target}
          inert={activePanel !== FLOW_PANEL_INDEX.target}
        >
          <div className="flow-panel-heading">
            <span aria-hidden="true">T</span>
            <h2
              tabIndex={-1}
              ref={(node) => {
                registerPanelHeading(FLOW_PANEL_INDEX.target, node);
              }}
            >
              Target audience
            </h2>
          </div>

          <div className="flow-panel-card">
            <CraftCard
              letter="T"
              complete={isFieldComplete(draft, "targetAudience")}
            >
              <div className="field craft-field">
                <FieldHeading
                  field="targetAudience"
                  label="Audience modifiers"
                  controlId="target-card-workbench"
                  labelControl={false}
                />
                <div id="target-card-workbench">
                  <PromptCardWorkbench
                    engine={craftCardEngine}
                    section="target"
                    vocabularyKey={formatCode}
                    values={cardSystem.tracks}
                    equippedIds={cardSystem.equipped.target}
                    suggestedId={cardSystem.suggested.target}
                    onTrackChange={onChangeTrack}
                    onToggleCard={(lineageId) =>
                      onToggleCard("target", lineageId)
                    }
                    onDropCard={(slotIndex, lineageId) =>
                      onDropCard("target", slotIndex, lineageId)
                    }
                    onRemoveCard={(slotIndex) =>
                      onRemoveCard("target", slotIndex)
                    }
                    onClearCards={() => onClearCards("target")}
                  />
                </div>
                <div className="workbench-text-row">
                  <label
                    className="workbench-text-label"
                    htmlFor="prompt-target-audience"
                  >
                    Optional custom audience
                  </label>
                  <label className="workbench-default-check">
                    <input
                      type="checkbox"
                      checked={draft.targetUseDefault}
                      onChange={(event) =>
                        onSetUseDefault(
                          "targetUseDefault",
                          event.target.checked,
                        )
                      }
                    />
                    Use default audience
                  </label>
                </div>
                <CraftDictationField
                  id="prompt-target-audience"
                  field="targetAudience"
                  label="Target audience"
                  value={draft.targetAudience}
                  placeholder="Describe the real reader: role, knowledge level, goal, constraints, and what they need to do next."
                  rows={4}
                  attention={attentionTargetId === "prompt-target-audience"}
                  onChange={(value) => onUpdateDraft("targetAudience", value)}
                  dictation={dictation}
                />
              </div>
            </CraftCard>
          </div>
          <FlowActions
            onBack={() => navigateToPanel(FLOW_PANEL_INDEX.format)}
            onNext={onReviewOutput}
            nextLabel="Review output"
            onSecondary={onReset}
            secondaryLabel="Clear all"
          />
        </section>
      </div>
    </div>
  );
}
