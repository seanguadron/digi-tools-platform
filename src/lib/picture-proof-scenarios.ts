import proofScenariosData from "@/data/picture-deck/proof-scenarios.json";
import type {
  PictureProofScenario,
  PictureProofScenariosCatalog,
} from "@/lib/picture-types";

const proofScenariosCatalog =
  proofScenariosData as PictureProofScenariosCatalog;

export const PICTURE_PROOF_SCENARIOS: PictureProofScenario[] =
  proofScenariosCatalog.scenarios;
export const PICTURE_PROOF_BASE_DRAFT = proofScenariosCatalog.baseDraft;

export type { PictureProofScenario } from "@/lib/picture-types";
