#!/usr/bin/env node
/**
 * log-skill.mjs — append one skill-usage entry to `.ai/notes/skill-log.jsonl`
 * (the ledger behind the orchestration map's per-skill "last fired / times
 * used" display and the coverage section's never-fired list).
 *
 * Usage: npm run skill:log -- <skill> "<surface / what it drove>"
 * The skill name must match a folder in either skill home
 * (.claude/skills/ or .agents/skills/ — STANDARDS §3.4).
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const [skill, ...rest] = process.argv.slice(2);
const surface = rest.join(" ").trim();

if (!skill || !surface) {
  console.error('Usage: npm run skill:log -- <skill> "<surface>"');
  process.exit(1);
}
const inClaude = existsSync(join(ROOT, ".claude/skills", skill, "SKILL.md"));
const inCodex = existsSync(join(ROOT, ".agents/skills", skill, "SKILL.md"));
if (!inClaude && !inCodex) {
  console.error(
    `No such skill "${skill}" in .claude/skills/ or .agents/skills/.`
  );
  process.exit(1);
}

mkdirSync(join(ROOT, ".ai/notes"), { recursive: true });
const entry = { at: new Date().toISOString(), skill, surface };
appendFileSync(join(ROOT, ".ai/notes/skill-log.jsonl"), JSON.stringify(entry) + "\n");
console.log(`Logged: ${skill} — ${surface}`);
