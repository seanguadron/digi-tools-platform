"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createDoc } from "@/lib/image-editor/document";
import { deserializeDoc, serializeDoc } from "@/lib/image-editor/project-io";
import type { ImageDoc } from "@/lib/image-editor/types";

const DOC_KEY = "digitools.image-editor.doc-v1";
const NAME_KEY = "digitools.image-editor.name-v1";
const SAVED_AT_KEY = "digitools.image-editor.saved-at-v1";
// Serialized-size ceiling for the best-effort localStorage autosave. Bigger docs
// stay in-session only; the durable path is Save Project (a downloaded .json).
const BUDGET = 4_000_000;
const DEBOUNCE = 1200;

export type PersistStatus = "restoring" | "saved" | "large" | "unavailable";

// Owns the initial document (restored autosave, or a fresh blank) and a
// debounced, quota-guarded localStorage autosave. Mirrors the Architect's
// restoredRef gate so the empty initial state never clobbers saved work.
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
  const restoredRef = useRef(false);
  const [status, setStatus] = useState<PersistStatus>("restoring");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let restored: Awaited<ReturnType<typeof deserializeDoc>> = null;
      try {
        const raw = window.localStorage.getItem(DOC_KEY);
        if (raw) {
          restored = await deserializeDoc(JSON.parse(raw));
        }
      } catch {
        restored = null;
      }
      if (cancelled) {
        return;
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
        if (savedAt) {
          setLastSavedAt(new Date(savedAt));
        }
      } else {
        setDoc((current) => current ?? createDoc());
      }
      setStatus("saved");
      restoredRef.current = true;
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [setDoc, setName]);

  useEffect(() => {
    if (!restoredRef.current || !doc) {
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const json = JSON.stringify(serializeDoc(doc, name));
        if (json.length > BUDGET) {
          setStatus("large");
          return;
        }
        const savedAt = new Date();
        window.localStorage.setItem(DOC_KEY, json);
        window.localStorage.setItem(NAME_KEY, name);
        window.localStorage.setItem(SAVED_AT_KEY, savedAt.toISOString());
        setLastSavedAt(savedAt);
        setStatus("saved");
      } catch {
        setStatus("unavailable");
      }
    }, DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [doc, name]);

  return { status, lastSavedAt };
}
