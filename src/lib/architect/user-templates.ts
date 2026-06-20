import { makeId, readStored, writeStored } from "@/lib/prompt-storage";
import type { ArchitectProject } from "@/lib/architect/types";

const KEY = "digitools.architect.user-templates-v1";

export type SavedArchitectTemplate = {
  id: string;
  name: string;
  project: ArchitectProject;
};

export function listUserTemplates(): SavedArchitectTemplate[] {
  const stored = readStored<SavedArchitectTemplate[]>(KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export function saveUserTemplate(
  name: string,
  project: ArchitectProject,
): SavedArchitectTemplate[] {
  const entry: SavedArchitectTemplate = {
    id: makeId(),
    name: name.trim() || "Untitled",
    project: JSON.parse(JSON.stringify(project)) as ArchitectProject,
  };
  const next = [...listUserTemplates(), entry];
  writeStored(KEY, next);
  return next;
}

export function deleteUserTemplate(id: string): SavedArchitectTemplate[] {
  const next = listUserTemplates().filter((entry) => entry.id !== id);
  writeStored(KEY, next);
  return next;
}
