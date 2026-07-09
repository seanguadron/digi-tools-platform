// Client-side file save: Blob -> object URL -> programmatic <a download> click ->
// revoke. The single trusted download path in the app (no server, no navigation).

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  filename: string,
  contents: string,
  type: string,
) {
  downloadBlob(filename, new Blob([contents], { type }));
}

// Make a user-supplied name safe for a download filename: lowercase, ASCII
// alphanumerics + dashes only, no leading/trailing dashes. Falls back to
// `fallback` when nothing survives (empty name, all punctuation, etc.).
export function slugifyFilename(name: string, fallback = "image"): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
  return slug || fallback;
}
