"use client";

// Small, SSR-safe wrappers around localStorage used by the save/reuse features
// (named library, custom presets, favorites). All failures are non-fatal so the
// builder keeps working when storage is unavailable.

export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// For list-shaped keys (favorites, id lists): localStorage is user-editable,
// so the parsed value must be filtered to a real string array — a tampered
// value like `null` or `{}` degrades to the sound subset instead of putting
// non-array state into a component.
export function readStoredStringArray(key: string): string[] {
  const entries = readStored<unknown>(key, []);
  return Array.isArray(entries)
    ? entries.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function writeStored(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked; the in-memory state still works.
  }
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
