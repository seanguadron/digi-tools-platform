#!/usr/bin/env node
/**
 * check-security.mjs — the deterministic half of the Security gate, scoped to
 * this app's REAL surface: a client-side toolbox with no auth, no accounts,
 * and no cloud — plus ONE development-only write endpoint (the Card Art
 * Studio, src/app/api/card-art). What can actually go wrong here is script
 * injection through rendered prompt content, secrets accidentally committed,
 * env files leaking into git, and that endpoint reaching production. Exit
 * 0 = pass, 1 = fail (blocks the build via `prebuild`, the pre-commit hook,
 * and CI).
 *
 * Checks (STANDARDS §2.4 + hygiene):
 *   S1  no script-injection primitives — eval / new Function /
 *       dangerouslySetInnerHTML outside the allowlist (empty today).
 *   S2  no secret-looking strings committed under src/.
 *   S3  .gitignore covers .env*.
 *   S4  every route handler carries the production guard.
 *
 * The browser trust boundary (imported session JSON, localStorage reads —
 * STANDARDS §2.3) is a JUDGMENT rule: the Security gate agent audits it;
 * a grep cannot decide "validated enough".
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
const srcFiles = existsSync(join(ROOT, "src"))
  ? walk(join(ROOT, "src")).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))
  : [];

// ── S1 script-injection primitives ──────────────────────────────────────────
{
  // Repo-relative paths, each with its reason recorded in STANDARDS §2.4.
  const ALLOWLIST = new Set([
    // The no-flash theme bootstrap: a module-level CONSTANT script that reads
    // localStorage against a strict two-value allowlist. No dynamic input.
    // Injected via useServerInsertedHTML (outside the hydrated React tree).
    "src/components/theme-script.tsx",
  ]);
  const bad = /\beval\s*\(|new Function\s*\(|dangerouslySetInnerHTML/;
  for (const p of srcFiles) {
    if (ALLOWLIST.has(rel(p))) continue;
    const text = readFileSync(p, "utf8");
    if (bad.test(text)) {
      const line = text.split(/\r?\n/).findIndex((l) => bad.test(l)) + 1;
      fail("S1", `${rel(p)}:${line} script-injection primitive — STANDARDS §2.4`);
    }
  }
}

// ── S2 secret-looking strings ────────────────────────────────────────────────
{
  const bad =
    /-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}|(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/i;
  for (const p of srcFiles) {
    const text = readFileSync(p, "utf8");
    if (bad.test(text)) {
      const line = text.split(/\r?\n/).findIndex((l) => bad.test(l)) + 1;
      fail("S2", `${rel(p)}:${line} secret-looking string committed`);
    }
  }
}

// ── S3 env hygiene ───────────────────────────────────────────────────────────
{
  const gi = join(ROOT, ".gitignore");
  const text = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  if (!/^\.env\*/m.test(text) && !text.includes(".env*")) {
    fail("S3", ".gitignore must cover .env*");
  }
}

// ── S4 route handlers are development-only ───────────────────────────────────
{
  // This app ships no server surface to users. The Card Art Studio's endpoint
  // is an authoring convenience that must never answer in a production build,
  // so the guard is enforced here rather than left to reviewer memory: every
  // exported handler in a route file has to bail on NODE_ENV === production.
  const GUARD = /process\.env\.NODE_ENV\s*===\s*["']production["']/;
  const HANDLER = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
  const routeFiles = srcFiles.filter((p) => /\/app\/.*\/route\.(ts|js|mjs)$/.test(rel(p)));
  for (const p of routeFiles) {
    const text = readFileSync(p, "utf8");
    if (!HANDLER.test(text)) continue;
    if (!GUARD.test(text)) {
      fail(
        "S4",
        `${rel(p)} route handler is missing the production guard ` +
          `(process.env.NODE_ENV === "production")`,
      );
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error("✗ Security — deterministic checks FAILED:\n");
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log("✓ Security — deterministic checks passed.");
