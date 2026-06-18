import {
  restoreCardSystem,
  restoreDraft,
} from "@/lib/prompt-builder-state";
import type {
  CardSystemState,
  PromptDraft,
} from "@/lib/prompt-builder-state";
import type { PromptRole } from "@/lib/prompt-types";

type PromptSession = {
  version: 1;
  exportedAt: string;
  draft: PromptDraft;
  cardSystem: CardSystemState;
};

export function serializePromptSession(
  draft: PromptDraft,
  cardSystem: CardSystemState,
) {
  const session: PromptSession = {
    version: 1,
    exportedAt: new Date().toISOString(),
    draft,
    cardSystem,
  };

  return `${JSON.stringify(session, null, 2)}\n`;
}

export function restorePromptSession(value: string, roles: PromptRole[]) {
  const parsed = JSON.parse(value) as Partial<PromptSession>;
  if (!parsed.draft || !parsed.cardSystem) {
    throw new Error("Missing session data.");
  }

  const draft = restoreDraft(JSON.stringify(parsed.draft), roles);
  const cardSystem = restoreCardSystem(
    JSON.stringify(parsed.cardSystem),
    draft.format,
  );

  return { draft, cardSystem };
}
