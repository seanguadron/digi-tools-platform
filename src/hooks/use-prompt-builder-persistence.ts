"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLocalDraft } from "@/hooks/use-local-draft";
import {
  createCardSystem,
  EMPTY_DRAFT,
  restoreCardSystem,
  restoreDraft,
} from "@/lib/prompt-builder-state";
import type {
  CardSystemState,
  PromptDraft,
} from "@/lib/prompt-builder-state";
import type { PromptRole } from "@/lib/prompt-types";

const DRAFT_STORAGE_KEY = "digitools.prompt-builder.craft-v1";
const CARD_STORAGE_KEY = "digitools.prompt-builder.cards-v1";
const SAVED_AT_STORAGE_KEY = "digitools.prompt-builder.saved-at-v1";

type BuilderSnapshot = {
  draft: PromptDraft;
  cardSystem: CardSystemState;
};

// Thin adapter over the shared useLocalDraft lifecycle. Restore validation
// stays here (restoreDraft/restoreCardSystem shape-check the stored JSON);
// corrupt data clears the keys and degrades to defaults.
export function usePromptBuilderPersistence({
  roles,
  draft,
  cardSystem,
  setDraft,
  setCardSystem,
  setActiveRoleCategory,
}: {
  roles: PromptRole[];
  draft: PromptDraft;
  cardSystem: CardSystemState;
  setDraft: Dispatch<SetStateAction<PromptDraft>>;
  setCardSystem: Dispatch<SetStateAction<CardSystemState>>;
  setActiveRoleCategory: Dispatch<SetStateAction<string>>;
}) {
  const restore = useCallback(() => {
    try {
      let restoredFormat = EMPTY_DRAFT.format;
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);

      if (savedDraft) {
        const restoredDraft = restoreDraft(savedDraft, roles);
        restoredFormat = restoredDraft.format;
        setDraft(restoredDraft);
        const leadRole = roles.find(
          (role) => role.id === restoredDraft.roleIds[0],
        );
        if (leadRole) {
          setActiveRoleCategory(leadRole.category);
        }
      }

      const savedCardSystem = localStorage.getItem(CARD_STORAGE_KEY);
      setCardSystem(
        savedCardSystem
          ? restoreCardSystem(savedCardSystem, restoredFormat)
          : createCardSystem(restoredFormat),
      );
      const savedAt = localStorage.getItem(SAVED_AT_STORAGE_KEY);
      return {
        status: "saved" as const,
        savedAt: savedAt ? new Date(savedAt) : null,
      };
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(CARD_STORAGE_KEY);
      localStorage.removeItem(SAVED_AT_STORAGE_KEY);
      return { status: "unavailable" as const };
    }
  }, [roles, setActiveRoleCategory, setCardSystem, setDraft]);

  const save = useCallback((snapshot: BuilderSnapshot, savedAt: Date) => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot.draft));
    localStorage.setItem(
      CARD_STORAGE_KEY,
      JSON.stringify(snapshot.cardSystem),
    );
    localStorage.setItem(SAVED_AT_STORAGE_KEY, savedAt.toISOString());
    return "saved" as const;
  }, []);

  const value = useMemo(() => ({ draft, cardSystem }), [cardSystem, draft]);

  return useLocalDraft({ value, restore, save });
}
