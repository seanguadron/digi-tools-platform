"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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
  const restoredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<
    "restoring" | "saved" | "unavailable"
  >(
    "restoring",
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
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
        if (savedAt) {
          setLastSavedAt(new Date(savedAt));
        }
        setStatus("saved");
      } catch {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        localStorage.removeItem(CARD_STORAGE_KEY);
        localStorage.removeItem(SAVED_AT_STORAGE_KEY);
        setStatus("unavailable");
      } finally {
        restoredRef.current = true;
        setReady(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [roles, setActiveRoleCategory, setCardSystem, setDraft]);

  useEffect(() => {
    if (!restoredRef.current) {
      return;
    }

    let statusTimer: number | null = null;
    try {
      const savedAt = new Date();
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cardSystem));
      localStorage.setItem(SAVED_AT_STORAGE_KEY, savedAt.toISOString());
      statusTimer = window.setTimeout(() => {
        setLastSavedAt(savedAt);
        setStatus("saved");
      }, 0);
    } catch {
      // The builder still works when browser storage is unavailable.
      statusTimer = window.setTimeout(() => setStatus("unavailable"), 0);
    }

    return () => {
      if (statusTimer !== null) {
        window.clearTimeout(statusTimer);
      }
    };
  }, [cardSystem, draft]);

  return { ready, status, lastSavedAt };
}
