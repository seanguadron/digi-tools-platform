import proofData from "@/data/prompt-builder/proof-scenarios.json";
import type {
  ProofScenario,
  ProofScenariosCatalog,
} from "@/lib/prompt-types";

export type { ProofScenario } from "@/lib/prompt-types";

const proofCatalog = proofData as ProofScenariosCatalog;

export const PROOF_SCENARIOS = proofCatalog.scenarios.map((scenario) => ({
  ...scenario,
  draft: {
    ...proofCatalog.baseDraft,
    ...scenario.draft,
  },
})) satisfies ProofScenario[];
