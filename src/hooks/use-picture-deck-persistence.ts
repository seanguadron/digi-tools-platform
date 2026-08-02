"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLocalDraft } from "@/hooks/use-local-draft";
import {
  createPictureCardSystem,
  restorePictureCardSystem,
  restorePictureDraft,
} from "@/lib/picture-deck-state";
import type {
  PictureCardSystemState,
  PictureDraft,
} from "@/lib/picture-types";

const DRAFT_STORAGE_KEY = "digitools.picture-deck.draft-v1";
const CARD_STORAGE_KEY = "digitools.picture-deck.cards-v1";
const SAVED_AT_STORAGE_KEY = "digitools.picture-deck.saved-at-v1";

type DeckSnapshot = {
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
};

// Thin adapter over the shared useLocalDraft lifecycle, mirroring the CRAFT
// deck's persistence: restore validation stays here (restorePictureDraft /
// restorePictureCardSystem shape-check the stored JSON); corrupt data clears
// the keys and degrades to defaults.
export function usePictureDeckPersistence({
  draft,
  cardSystem,
  setDraft,
  setCardSystem,
}: {
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
  setDraft: Dispatch<SetStateAction<PictureDraft>>;
  setCardSystem: Dispatch<SetStateAction<PictureCardSystemState>>;
}) {
  const restore = useCallback(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        setDraft(restorePictureDraft(savedDraft));
      }

      const savedCardSystem = localStorage.getItem(CARD_STORAGE_KEY);
      setCardSystem(
        savedCardSystem
          ? restorePictureCardSystem(savedCardSystem)
          : createPictureCardSystem(),
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
  }, [setCardSystem, setDraft]);

  const save = useCallback((snapshot: DeckSnapshot, savedAt: Date) => {
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
