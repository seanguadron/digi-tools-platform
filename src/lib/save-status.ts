// Shared autosave-status vocabulary for the tool sub-bar chips
// (docs/ARCHITECTURE.md §3). The union is the superset across tools:
// "large" is only reachable where a size budget exists (image editor).
export type SaveStatus = "restoring" | "saved" | "large" | "unavailable";

export function isSaveStateUnavailable(status: SaveStatus): boolean {
  return status === "unavailable" || status === "large";
}

export function formatSaveStatusLabel(
  status: SaveStatus,
  lastSavedAt: Date | null,
  labels?: { restoring?: string },
): string {
  if (status === "restoring") {
    return labels?.restoring ?? "Restoring...";
  }
  if (status === "unavailable") {
    return "Local save unavailable";
  }
  if (status === "large") {
    return "Too large to autosave — use Save";
  }
  return lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Saved locally";
}
