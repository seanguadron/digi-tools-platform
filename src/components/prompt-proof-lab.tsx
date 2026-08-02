"use client";

// The structural slice of a proof scenario this drawer renders; each deck
// passes its own catalog's scenarios.
export type ProofLabScenario = {
  id: string;
  name: string;
  proves: string;
  checks: readonly string[];
};

export function PromptProofLab<Sc extends ProofLabScenario>({
  open,
  activeProofId,
  scenarios,
  id = "prompt-proof-lab",
  onClose,
  onLoad,
}: {
  open: boolean;
  activeProofId: string | null;
  scenarios: readonly Sc[];
  id?: string;
  onClose: () => void;
  onLoad: (scenario: Sc) => void;
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
        id={id}
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
          {scenarios.map((scenario, index) => (
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

export function ProofScenarioStatus<Sc extends ProofLabScenario>({
  scenario,
  onDismiss,
}: {
  scenario: Sc | undefined;
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
