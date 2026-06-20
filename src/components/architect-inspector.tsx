"use client";

import { useState } from "react";
import { BLOCK_TYPES } from "@/lib/architect/blocks";
import { STANDARD_DATA_TYPES } from "@/lib/architect/data-types";
import type { ReadinessIssue } from "@/lib/architect/readiness";
import type {
  ArchitectEdge,
  ArchitectGroup,
  ArchitectNode,
  BlockType,
  DataField,
} from "@/lib/architect/types";

// Hover/focus copy for each field's little "i" hint.
const FIELD_HINTS = {
  name: "What this component is called in code — usually its class or module name (e.g. SessionManager).",
  type: "The kind of building block this is: manager, worker, service, data object, adapter, and so on. It shapes how the component behaves and connects.",
  goal: "Why this component exists — the outcome it is responsible for. This frames everything below it.",
  description:
    "How it generally works in practice — the gist of what it does, not every function.",
  responsibilities:
    "The specific duties this component owns, as a few plain bullets. More concrete than the goal.",
  data: "The data this component owns — its fields and their types, like properties on a class.",
  dataNotes:
    "Describe the data in prose when you don't want to list every field — its shape, source, or meaning.",
  notes:
    "Anything useful that doesn't fit the structured fields: design reasoning, edge cases, relationships, concerns, or future ideas.",
  openQuestions:
    "Unknowns the build should resolve first — one per line. These export as a checklist the agent must clear before guessing.",
  group:
    "Optional grouping. Components in the same subsystem are boxed together on the canvas and get their own section in the build brief.",
} as const;

function InfoHint({ label, text }: { label: string; text: string }) {
  return (
    <span className="architect-info-hint">
      <button
        type="button"
        className="architect-info-dot"
        aria-label={`About ${label}: ${text}`}
      >
        i
      </button>
      <span className="architect-info-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function FieldTypeCell({
  value,
  refValue,
  dataNodes,
  onTypeChange,
  onLinkRef,
}: {
  value: string;
  refValue?: string;
  dataNodes: Array<{ id: string; name: string }>;
  onTypeChange: (value: string) => void;
  onLinkRef: (refId: string) => void;
}) {
  const [manualCustom, setManualCustom] = useState(false);
  const linked =
    refValue && dataNodes.some((node) => node.id === refValue)
      ? refValue
      : null;
  const isCustom =
    !linked &&
    (manualCustom || (value !== "" && !STANDARD_DATA_TYPES.includes(value)));
  const selectValue = linked
    ? `ref:${linked}`
    : isCustom
      ? "__custom__"
      : value;

  return (
    <div className="architect-field-type-cell">
      <select
        value={selectValue}
        aria-label="Field type"
        onChange={(event) => {
          const next = event.target.value;
          if (next.startsWith("ref:")) {
            setManualCustom(false);
            onLinkRef(next.slice(4));
          } else if (next === "__custom__") {
            setManualCustom(true);
            onTypeChange("");
          } else {
            setManualCustom(false);
            onTypeChange(next);
          }
        }}
      >
        <option value="">type…</option>
        {STANDARD_DATA_TYPES.map((dataType) => (
          <option value={dataType} key={dataType}>
            {dataType}
          </option>
        ))}
        {dataNodes.length > 0 ? (
          <optgroup label="Link to data">
            {dataNodes.map((node) => (
              <option value={`ref:${node.id}`} key={node.id}>
                ↳ {node.name.trim() || "Unnamed"}
              </option>
            ))}
          </optgroup>
        ) : null}
        <option value="__custom__">Custom…</option>
      </select>
      {isCustom ? (
        <input
          type="text"
          value={value}
          placeholder="custom type"
          aria-label="Custom field type"
          onChange={(event) => onTypeChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}

export function ArchitectInspector({
  systemName,
  systemGoal,
  nodes,
  selectedNode,
  selectedEdge,
  onSystemNameChange,
  onSystemGoalChange,
  onUpdateNode,
  onDeleteNode,
  onAddResponsibility,
  onUpdateResponsibility,
  onRemoveResponsibility,
  onAddField,
  onUpdateField,
  onDeleteField,
  onUpdateEdge,
  onDeleteEdge,
  readiness,
  onFocusNode,
  onLinkFieldRef,
  groups,
  onAssignGroup,
  onCreateGroup,
}: {
  systemName: string;
  systemGoal: string;
  nodes: ArchitectNode[];
  selectedNode: ArchitectNode | null;
  selectedEdge: ArchitectEdge | null;
  onSystemNameChange: (value: string) => void;
  onSystemGoalChange: (value: string) => void;
  onUpdateNode: (id: string, patch: Partial<ArchitectNode>) => void;
  onDeleteNode: (id: string) => void;
  onAddResponsibility: (nodeId: string) => void;
  onUpdateResponsibility: (nodeId: string, index: number, value: string) => void;
  onRemoveResponsibility: (nodeId: string, index: number) => void;
  onAddField: (nodeId: string) => void;
  onUpdateField: (
    nodeId: string,
    fieldId: string,
    patch: Partial<DataField>,
  ) => void;
  onDeleteField: (nodeId: string, fieldId: string) => void;
  onUpdateEdge: (id: string, patch: Partial<ArchitectEdge>) => void;
  onDeleteEdge: (id: string) => void;
  readiness: ReadinessIssue[];
  onFocusNode: (id: string) => void;
  onLinkFieldRef: (nodeId: string, fieldId: string, refId: string) => void;
  groups: ArchitectGroup[];
  onAssignGroup: (nodeId: string, groupId: string | undefined) => void;
  onCreateGroup: (nodeId: string, name: string) => void;
}) {
  if (selectedNode) {
    const dataNodes = nodes
      .filter((node) => node.type === "data" && node.id !== selectedNode.id)
      .map((node) => ({ id: node.id, name: node.name }));

    return (
      <aside className="architect-inspector" aria-label="Component inspector">
        <div className="architect-inspector-heading">
          <span>Component</span>
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-name">Name</label>
            <InfoHint label="Name" text={FIELD_HINTS.name} />
          </div>
          <input
            id="architect-node-name"
            type="text"
            value={selectedNode.name}
            placeholder="e.g. SessionManager"
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { name: event.target.value })
            }
          />
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-type">Type</label>
            <InfoHint label="Type" text={FIELD_HINTS.type} />
          </div>
          <select
            id="architect-node-type"
            value={selectedNode.type}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, {
                type: event.target.value as BlockType,
              })
            }
          >
            {BLOCK_TYPES.map((block) => (
              <option value={block.id} key={block.id}>
                {block.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-goal">Goal</label>
            <InfoHint label="Goal" text={FIELD_HINTS.goal} />
          </div>
          <textarea
            id="architect-node-goal"
            rows={2}
            value={selectedNode.goal}
            placeholder="Why this component exists — the outcome it owns. This frames everything below."
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { goal: event.target.value })
            }
          />
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-desc">What it does</label>
            <InfoHint label="What it does" text={FIELD_HINTS.description} />
          </div>
          <textarea
            id="architect-node-desc"
            rows={4}
            value={selectedNode.description}
            placeholder="How it generally works in practice — the gist, not every function."
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { description: event.target.value })
            }
          />
        </div>

        <div className="field">
          <div className="architect-field-label-row">
            <span className="architect-field-label-group">
              <span className="architect-field-label">Responsibilities</span>
              <InfoHint
                label="Responsibilities"
                text={FIELD_HINTS.responsibilities}
              />
            </span>
            <button
              type="button"
              className="architect-add-link"
              onClick={() => onAddResponsibility(selectedNode.id)}
            >
              + Add
            </button>
          </div>
          {selectedNode.responsibilities.length === 0 ? (
            <p className="architect-inspector-empty">
              High-level things this component is responsible for — a few plain
              bullets, not function signatures.
            </p>
          ) : (
            <div className="architect-resp-list">
              {selectedNode.responsibilities.map((item, index) => (
                <div className="architect-resp-row" key={index}>
                  <input
                    type="text"
                    value={item}
                    placeholder="e.g. Reserve stock on order"
                    aria-label={`Responsibility ${index + 1}`}
                    onChange={(event) =>
                      onUpdateResponsibility(
                        selectedNode.id,
                        index,
                        event.target.value,
                      )
                    }
                  />
                  <button
                    type="button"
                    className="architect-icon-button"
                    aria-label="Remove responsibility"
                    onClick={() =>
                      onRemoveResponsibility(selectedNode.id, index)
                    }
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <div className="architect-field-label-row">
            <span className="architect-field-label-group">
              <span className="architect-field-label">Data</span>
              <InfoHint label="Data" text={FIELD_HINTS.data} />
            </span>
            <button
              type="button"
              className="architect-add-link"
              onClick={() => onAddField(selectedNode.id)}
            >
              + Add field
            </button>
          </div>
          {selectedNode.fields.length === 0 ? (
            <p className="architect-inspector-empty">
              The data this component owns — its fields and their types (like
              properties on a class).
            </p>
          ) : (
            <div className="architect-field-table">
              <div className="architect-field-row architect-field-row--head">
                <span>Field</span>
                <span>Type</span>
                <span>Description</span>
                <span aria-hidden="true" />
              </div>
              {selectedNode.fields.map((fieldItem) => (
                <div className="architect-field-row" key={fieldItem.id}>
                  <input
                    type="text"
                    value={fieldItem.name}
                    placeholder="name"
                    aria-label="Field name"
                    onChange={(event) =>
                      onUpdateField(selectedNode.id, fieldItem.id, {
                        name: event.target.value,
                      })
                    }
                  />
                  <FieldTypeCell
                    value={fieldItem.type}
                    refValue={fieldItem.ref}
                    dataNodes={dataNodes}
                    onTypeChange={(value) =>
                      onUpdateField(selectedNode.id, fieldItem.id, {
                        type: value,
                        ref: undefined,
                      })
                    }
                    onLinkRef={(refId) =>
                      onLinkFieldRef(selectedNode.id, fieldItem.id, refId)
                    }
                  />
                  <input
                    type="text"
                    value={fieldItem.description}
                    placeholder="description"
                    aria-label="Field description"
                    onChange={(event) =>
                      onUpdateField(selectedNode.id, fieldItem.id, {
                        description: event.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    className="architect-icon-button"
                    aria-label="Delete field"
                    onClick={() => onDeleteField(selectedNode.id, fieldItem.id)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="architect-data-notes-block">
            <div className="architect-label">
              <label htmlFor="architect-node-data-notes">Data notes</label>
              <InfoHint label="Data notes" text={FIELD_HINTS.dataNotes} />
            </div>
            <textarea
              id="architect-node-data-notes"
              rows={2}
              value={selectedNode.dataNotes}
              placeholder="Describe the data instead of (or alongside) listing fields above."
              onChange={(event) =>
                onUpdateNode(selectedNode.id, {
                  dataNotes: event.target.value,
                })
              }
            />
          </div>
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-notes">Open notes</label>
            <InfoHint label="Open notes" text={FIELD_HINTS.notes} />
          </div>
          <textarea
            id="architect-node-notes"
            rows={4}
            value={selectedNode.notes}
            placeholder="Design reasoning, edge cases, relationships, concerns, or future ideas — anything that doesn't fit the fields above."
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { notes: event.target.value })
            }
          />
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-questions">Open questions</label>
            <InfoHint
              label="Open questions"
              text={FIELD_HINTS.openQuestions}
            />
          </div>
          <textarea
            id="architect-node-questions"
            rows={2}
            value={selectedNode.openQuestions}
            placeholder="One question per line — e.g. Which provider? What is the retry policy?"
            onChange={(event) =>
              onUpdateNode(selectedNode.id, {
                openQuestions: event.target.value,
              })
            }
          />
        </div>

        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-node-group">Subsystem</label>
            <InfoHint label="Subsystem" text={FIELD_HINTS.group} />
          </div>
          <select
            id="architect-node-group"
            value={selectedNode.groupId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "__new__") {
                const name = window.prompt("Name the subsystem");
                if (name && name.trim()) {
                  onCreateGroup(selectedNode.id, name.trim());
                }
              } else {
                onAssignGroup(selectedNode.id, value || undefined);
              }
            }}
          >
            <option value="">No subsystem</option>
            {groups.map((group) => (
              <option value={group.id} key={group.id}>
                {group.name.trim() || "Unnamed"}
              </option>
            ))}
            <option value="__new__">+ New subsystem…</option>
          </select>
        </div>

        <button
          className="button button-secondary architect-delete-button"
          type="button"
          onClick={() => onDeleteNode(selectedNode.id)}
        >
          Delete component
        </button>
      </aside>
    );
  }

  if (selectedEdge) {
    const sourceName =
      nodes.find((node) => node.id === selectedEdge.source)?.name.trim() ||
      "Unnamed";
    const targetName =
      nodes.find((node) => node.id === selectedEdge.target)?.name.trim() ||
      "Unnamed";

    return (
      <aside className="architect-inspector" aria-label="Connection inspector">
        <div className="architect-inspector-heading">
          <span>Connection</span>
        </div>
        <p className="architect-edge-endpoints">
          <strong>{sourceName}</strong> → <strong>{targetName}</strong>
        </p>
        <div className="field">
          <label htmlFor="architect-edge-kind">Relationship</label>
          <select
            id="architect-edge-kind"
            value={selectedEdge.kind}
            onChange={(event) =>
              onUpdateEdge(selectedEdge.id, {
                kind: event.target.value as ArchitectEdge["kind"],
              })
            }
          >
            <option value="uses">uses / depends on</option>
            <option value="owns">owns</option>
            <option value="extends">implements / extends</option>
            <option value="emits">emits / handled by</option>
          </select>
        </div>
        <div className="field">
          <div className="architect-label">
            <label htmlFor="architect-edge-label">What this link means</label>
            <InfoHint
              label="Relationship label"
              text="Describe the connection in the source → target direction (e.g. 'reads & writes block trees'). Links are one-way — if the target also depends on the source, draw a second link back and label that one too."
            />
          </div>
          <input
            id="architect-edge-label"
            type="text"
            value={selectedEdge.label ?? ""}
            placeholder="e.g. reads & writes block trees"
            onChange={(event) =>
              onUpdateEdge(selectedEdge.id, { label: event.target.value })
            }
          />
        </div>
        <button
          className="button button-secondary architect-delete-button"
          type="button"
          onClick={() => onDeleteEdge(selectedEdge.id)}
        >
          Delete connection
        </button>
      </aside>
    );
  }

  return (
    <aside className="architect-inspector" aria-label="System inspector">
      <div className="architect-inspector-heading">
        <span>System</span>
      </div>
      <div className="field">
        <label htmlFor="architect-system-name">System name</label>
        <input
          id="architect-system-name"
          type="text"
          value={systemName}
          placeholder="e.g. Inventory Service"
          onChange={(event) => onSystemNameChange(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="architect-system-goal">Goal</label>
        <textarea
          id="architect-system-goal"
          rows={5}
          value={systemGoal}
          placeholder="What is this system for? What should it accomplish?"
          onChange={(event) => onSystemGoalChange(event.target.value)}
        />
      </div>
      {nodes.length > 0 ? (
        <div className="architect-readiness">
          <div className="architect-readiness-head">
            <strong>Readiness</strong>
            {readiness.length > 0 ? (
              <span className="architect-readiness-count">
                {readiness.length}
              </span>
            ) : (
              <span className="architect-readiness-ok">ready</span>
            )}
          </div>
          {readiness.length === 0 ? (
            <p className="architect-inspector-empty">
              No gaps — the brief is ready to build from.
            </p>
          ) : (
            <ul className="architect-readiness-list">
              {readiness.map((issue) => {
                const focus = issue.nodeId;
                return (
                  <li
                    key={issue.id}
                    className={`architect-readiness-item is-${issue.severity}`}
                  >
                    {focus ? (
                      <button type="button" onClick={() => onFocusNode(focus)}>
                        {issue.message}
                      </button>
                    ) : (
                      <span>{issue.message}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <p className="architect-inspector-empty">
        Select a component or connection on the canvas to edit it here. Add a
        component from the palette on the left.
      </p>
    </aside>
  );
}
