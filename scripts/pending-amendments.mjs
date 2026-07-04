#!/usr/bin/env node
/**
 * pending-amendments.mjs — the Learning loop's consent queue. Surfaces every item
 * the Sessions agent flagged as "(proposed amendment — needs the owner's consent)" in
 * `.ai/notes/SESSIONS.md`, so consent-gated rules don't get buried in the log.
 *
 * Resolve an item by either amending `docs/STANDARDS.md` (with the owner's consent) or
 * editing the log line to note it landed. A resolved line is annotated in place
 * with "→ landed …" (or "adopted"); those lines are excluded here so the queue
 * only shows what is genuinely awaiting consent. Informational — always exits 0.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let log = "";
try {
  log = readFileSync(join(ROOT, ".ai/notes/SESSIONS.md"), "utf8");
} catch {
  console.log("No .ai/notes/SESSIONS.md found.");
  process.exit(0);
}

const lines = log
  .split("\n")
  .map((l) => l.trim())
  // Match the actual flag form "(proposed [gate] amendment", not the section
  // headers ("Proposed amendments (need the owner's consent).") that group them.
  .filter((l) => /\(proposed (gate )?amendment/i.test(l))
  // A flag annotated as landed/adopted is resolved — keep it out of the queue.
  .filter((l) => !/landed|adopted/i.test(l));

if (!lines.length) {
  console.log("✓ No pending amendments flagged in SESSIONS.md.");
  process.exit(0);
}

console.log(`Pending amendments flagged in SESSIONS.md (may need the owner's consent):\n`);
for (const l of lines) console.log("  • " + l.replace(/^[-*]\s*/, ""));
console.log(
  `\n${lines.length} flagged. Resolve by amending docs/STANDARDS.md (with consent) ` +
    `or noting in the log that it landed.`
);
