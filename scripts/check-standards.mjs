#!/usr/bin/env node
/**
 * check-standards.mjs — the deterministic half of the Integration gate.
 * Enforces the machine-checkable rules in docs/STANDARDS.md; the judgment
 * rules stay with the gate agent. Exit 0 = pass, 1 = fail (blocks the build
 * via `prebuild`, the pre-commit hook, and CI).
 *
 * Checks:
 *   §2.2  generated docs never drift — docs/PROMPT_ROLES.md must byte-match
 *         the generator's output (reuses generateRoleDocs({check:true})).
 *   §3.3  gov:node graph truth — markers parse, ids are unique, and every
 *         reads= edge names a file that exists.
 *   conv  kebab-case filenames in src/components.
 *
 * (Script-injection and secrets checks live in check-security.mjs.)
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const failures = [];
const fail = (rule, msg) => failures.push(`  [${rule}] ${msg}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");

// ── §2.2 PROMPT_ROLES.md drift ───────────────────────────────────────────────
try {
  const { generateRoleDocs } = await import("./generate-prompt-role-docs.mjs");
  await generateRoleDocs({ check: true });
} catch (err) {
  fail("§2.2", (err && err.message) || "PROMPT_ROLES drift check failed");
}

// ── §3.3 gov:node graph truth ────────────────────────────────────────────────
{
  const govFiles = ["CLAUDE.md", "AGENTS.md"]
    .map((f) => join(ROOT, f))
    .concat(
      existsSync(join(ROOT, "docs"))
        ? walk(join(ROOT, "docs")).filter((p) => p.endsWith(".md"))
        : []
    )
    .filter((p) => existsSync(p));
  const ids = new Map();
  for (const p of govFiles) {
    const text = readFileSync(p, "utf8");
    const m = text.match(/<!--\s*gov:node\s+([^>]*?)-->/);
    if (!m) continue;
    const attrs = Object.fromEntries(
      [...m[1].matchAll(/(\w+)=("[^"]*"|\S+)/g)].map(([, k, v]) => [
        k,
        v.replace(/^"|"$/g, ""),
      ])
    );
    if (!attrs.id) {
      fail("§3.3", `${rel(p)} gov:node marker missing id=`);
      continue;
    }
    if (ids.has(attrs.id)) {
      fail("§3.3", `duplicate gov:node id "${attrs.id}" (${rel(p)} and ${ids.get(attrs.id)})`);
    }
    ids.set(attrs.id, rel(p));
    for (const target of (attrs.reads ?? "").split(",").filter(Boolean)) {
      if (!existsSync(join(ROOT, target.trim()))) {
        fail("§3.3", `${rel(p)} reads=${target.trim()} — file does not exist`);
      }
    }
  }
}

// ── Convention: kebab-case filenames in src/components ─────────────────────
{
  const dir = join(ROOT, "src", "components");
  if (existsSync(dir)) {
    for (const p of walk(dir)) {
      const name = p.split(/[\\/]/).pop() ?? "";
      if (!/^[a-z0-9]+(-[a-z0-9]+)*\.(ts|tsx|css)$/.test(name)) {
        fail("conv", `${rel(p)} — component filenames are kebab-case`);
      }
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error("✗ Standards — deterministic checks FAILED:\n");
  for (const f of failures) console.error(f);
  console.error("\nSee docs/STANDARDS.md for the rules.");
  process.exit(1);
}
console.log("✓ Standards — deterministic checks passed.");
