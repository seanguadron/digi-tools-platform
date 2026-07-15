"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { createDoc } from "@/lib/image-editor/document";
import { deserializeDoc, serializeDoc } from "@/lib/image-editor/project-io";
import type { ImageDoc } from "@/lib/image-editor/types";
import type { SaveStatus } from "@/lib/save-status";

const DOC_KEY = "digitools.image-editor.doc-v1";
const NAME_KEY = "digitools.image-editor.name-v1";
const SAVED_AT_KEY = "digitools.image-editor.saved-at-v1";
// Serialized-size ceiling for the best-effort localStorage autosave. Bigger docs
// stay in-session only; the durable path is Save Project (a downloaded .json).
const BUDGET = 4_000_000;
const DEBOUNCE = 1200;

export type PersistStatus = SaveStatus;

type PersistedDoc = {
  doc: ImageDoc | null;
  name: string;
};

// Owns the initial document (restored autosave, or a fresh blank) and a
// debounced, quota-guarded localStorage autosave. Thin adapter over the
// shared useLocalDraft lifecycle; deserializeDoc remains the validated
// restore path, and a failed restore seeds a fresh document.
export function useImageEditorPersistence({
  doc,
  setDoc,
  name,
  setName,
}: {
  doc: ImageDoc | null;
  setDoc: Dispatch<SetStateAction<ImageDoc | null>>;
  name: string;
  setName: (name: string) => void;
}) {
  const restore = useCallback(
    async (ctx: { isCancelled: () => boolean }) => {
      let restored: Awaited<ReturnType<typeof deserializeDoc>> = null;
      try {
        const raw = window.localStorage.getItem(DOC_KEY);
        if (raw) {
          restored = await deserializeDoc(JSON.parse(raw));
        }
      } catch {
        restored = null;
      }
      if (ctx.isCancelled()) {
        return null;
      }
      if (restored) {
        setDoc(restored.doc);
        let storedName: string | null = null;
        let savedAt: string | null = null;
        try {
          storedName = window.localStorage.getItem(NAME_KEY);
          savedAt = window.localStorage.getItem(SAVED_AT_KEY);
        } catch {
          storedName = null;
        }
        setName(storedName || restored.name);
        return {
          status: "saved" as const,
          savedAt: savedAt ? new Date(savedAt) : null,
        };
      }
      setDoc((current) => current ?? createDoc());
      return { status: "saved" as const };
    },
    [setDoc, setName],
  );

  const save = useCallback((value: PersistedDoc, savedAt: Date) => {
    if (!value.doc) {
      // Unreachable: canSave gates null docs out before save is called.
      return "saved" as const;
    }
    const json = JSON.stringify(serializeDoc(value.doc, value.name));
    if (json.length > BUDGET) {
      return "large" as const;
    }
    window.localStorage.setItem(DOC_KEY, json);
    window.localStorage.setItem(NAME_KEY, value.name);
    window.localStorage.setItem(SAVED_AT_KEY, savedAt.toISOString());
    return "saved" as const;
  }, []);

  const canSave = useCallback((value: PersistedDoc) => value.doc !== null, []);
  const value = useMemo(() => ({ doc, name }), [doc, name]);

  const { status, lastSavedAt } = useLocalDraft({
    value,
    restore,
    save,
    canSave,
    debounceMs: DEBOUNCE,
  });

  return { status, lastSavedAt };
}
