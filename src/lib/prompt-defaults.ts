// Default lines injected into the assembled prompt when Context or Target
// audience is left on "Use default". Kept free of path aliases and JSON
// imports so the scripts/*.test.mjs runner can load it directly.

export const CONTEXT_DEFAULT_TEXT =
  "The working context is provided outside this file. Treat the request that accompanies this prompt as the task context. If no context accompanies it, ask what the user is working on before proceeding.";

const AUDIENCE_DEFAULT_LEAD =
  "If the accompanying request names an audience, write for them.";

export function buildAudienceDefaultLine(
  audienceDefault?: string | null,
): string {
  // Runtime-guarded, not just typed: the assumption can arrive from a stored
  // custom preset, so a lying caller must fall back, not throw.
  const assumption =
    typeof audienceDefault === "string" ? audienceDefault.trim() : "";

  if (assumption) {
    return `${AUDIENCE_DEFAULT_LEAD} Otherwise assume: ${assumption}`;
  }

  return `${AUDIENCE_DEFAULT_LEAD} Otherwise infer the most likely audience, state your assumption in one line, and proceed.`;
}
