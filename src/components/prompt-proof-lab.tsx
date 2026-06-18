"use client";

import { PROOF_SCENARIOS } from "@/lib/prompt-proof-scenarios";
import type { ProofScenario } from "@/lib/prompt-proof-scenarios";

export function PromptProofLab({
  open,
  activeProofId,
  onClose,
  onLoad,
}: {
  open: boolean;
  activeProofId: string | null;
  onClose: () => void;
  onLoad: (scenario: ProofScenario) => void;
}) {
  return (
    <>
      {open ? (
        <button
          className="proof-lab-backdrop"
          type="button"
          onClick={onClose}
          aria-label="Close Proof Lab"
        />
      ) : null}

      <aside
        className={open ? "proof-lab is-open" : "proof-lab"}
        id="prompt-proof-lab"
        aria-labelledby="proof-lab-title"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="proof-lab-header">
          <div>
            <span>Design verification</span>
            <h2 id="proof-lab-title">Proof Lab</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Proof Lab">
            Close
          </button>
        </header>
        <p className="proof-lab-intro">
          Loading a proof replaces the current draft with a controlled test
          configuration. Each case includes the interaction that should be
          verified.
        </p>
        <div className="proof-scenario-list">
          {PROOF_SCENARIOS.map((scenario, index) => (
            <button
              className={
                scenario.id === activeProofId
                  ? "proof-scenario-row is-active"
                  : "proof-scenario-row"
              }
              type="button"
              onClick={() => onLoad(scenario)}
              aria-pressed={scenario.id === activeProofId}
              key={scenario.id}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{scenario.name}</strong>
                <small>{scenario.proves}</small>
              </span>
              <span aria-hidden="true">Load</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

export function ProofScenarioStatus({
  scenario,
  onDismiss,
}: {
  scenario: ProofScenario | undefined;
  onDismiss: () => void;
}) {
  if (!scenario) {
    return null;
  }

  return (
    <details className="proof-scenario-status">
      <summary>
        <span>Proof active</span>
        <strong>{scenario.name}</strong>
      </summary>
      <div>
        <p>{scenario.proves}</p>
        <ol>
          {scenario.checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ol>
        <button type="button" onClick={onDismiss}>
          Dismiss checklist
        </button>
      </div>
    </details>
  );
}
