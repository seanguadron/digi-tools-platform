#!/usr/bin/env node
/**
 * gate-sweep.mjs — the Learning loop's automated heartbeat. Runs the deterministic
 * gates across the whole repo, records the result to `.ai/notes/gate-status.json`
 * and appends a line
 * to `.ai/notes/gate-sweeps.log`. Schedule it (`npm run gate:sweep`, e.g. via
 * `/schedule`) so the gates stay honest across tasks, not just at commit time.
 *
 * The judgment gates (the Integration + Security AGENTS) still run by hand on
 * substantial changes; this is the always-on, deterministic complement.
 */

import { spawnSync } from "node:child_process";
import {
  writeFileSync,
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const run = (script) =>
  spawnSync(process.execPath, [join("scripts", script)], { cwd: ROOT, encoding: "utf8" });

const standards = run("check-standards.mjs");
const security = run("check-security.mjs");
const date = new Date().toISOString().slice(0, 10);

// ── Gates-owed detector ───────────────────────────────────────────────────────
// Deterministically maps the current change surface to the JUDGMENT gates that
// are owed a run: which files changed (uncommitted, plus commits since each
// gate's newest ledger report in .ai/notes/gate-reports/) vs each gate's
// trigger globs. A fresh report clears the flag. Zero tokens; git only.
const git = (...args) =>
  spawnSync("git", args, { cwd: ROOT, encoding: "utf8" }).stdout ?? "";

const TRIGGERS = {
  // Adjust these globs as the project grows surfaces; they map "what changed"
  // to "which judgment gate is owed a run".
  integration: [/^src\//, /^scripts\//],
  design: [/^src\/app\//, /^src\/components\//],
  security: [
    // The browser trust boundary + what renders prompt content.
    /^src\/lib\/prompt-storage/,
    /^src\/lib\/prompt-session/,
    /^src\/lib\/browser-download/,
    /^src\/data\//,
    /^next\.config\.ts$/,
  ],
};

/** Newest ledger-report CUTOFF per gate: the report file's mtime (the moment
 *  the report was saved), plus its frontmatter date for the display label.
 *  Mtime, not the frontmatter date: hand-typed dates can lag the wall clock
 *  (a session crossing midnight once mis-dated a whole evening's reports),
 *  and file times are exact. */
function latestReportCutoffs() {
  const cutoffs = { integration: null, security: null, design: null };
  let files = [];
  try {
    files = readdirSync(join(ROOT, ".ai/notes/gate-reports")).filter((f) => f.endsWith(".md"));
  } catch {
    return cutoffs;
  }
  for (const f of files) {
    try {
      const p = join(ROOT, ".ai/notes/gate-reports", f);
      const raw = readFileSync(p, "utf8");
      const gate = raw.match(/^gate:\s*(\w+)/m)?.[1];
      if (!gate || !(gate in cutoffs)) continue;
      const timeMs = statSync(p).mtimeMs;
      const label = raw.match(/^date:\s*([\d-]+)/m)?.[1] ?? "undated";
      if (!cutoffs[gate] || timeMs > cutoffs[gate].timeMs) {
        cutoffs[gate] = { timeMs, label };
      }
    } catch {
      /* skip unreadable */
    }
  }
  return cutoffs;
}

/** Recent commits as { timeMs, files[] } blocks, parsed IN-PROCESS from one
 *  git log call — git's own --since parsing proved too lenient to trust
 *  (T-suffixed timestamps can degrade to date-only). Capped at 300 commits;
 *  anything older than that is far past any live gate cutoff. */
function recentCommits() {
  const raw = git("log", "-n", "300", "--pretty=format:@@%cI", "--name-only");
  const blocks = [];
  let cur = null;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.startsWith("@@")) {
      cur = { timeMs: Date.parse(t.slice(2)), files: [] };
      blocks.push(cur);
    } else if (t && cur) {
      cur.files.push(t);
    }
  }
  return blocks.filter((b) => Number.isFinite(b.timeMs));
}

function computeOwed() {
  const owed = [];
  try {
    const uncommitted = git("status", "--porcelain")
      .split("\n")
      .map((l) => l.slice(3).trim())
      .filter(Boolean);
    const cutoffs = latestReportCutoffs();
    const commits = recentCommits();
    // The commit that lands a gate report (or the sessions entry) is the
    // delivery that run blessed / recorded — it never re-flags its own gate.
    const isWrapCommit = (c, marker) => c.files.some((f) => f.startsWith(marker));

    for (const [gate, globs] of Object.entries(TRIGGERS)) {
      const dirty = uncommitted.filter((f) => globs.some((g) => g.test(f)));
      const cutoff = cutoffs[gate];
      const committed = cutoff
        ? commits
            .filter(
              (c) =>
                c.timeMs > cutoff.timeMs &&
                !isWrapCommit(c, ".ai/notes/gate-reports/")
            )
            .flatMap((c) => c.files)
            .filter((f) => globs.some((g) => g.test(f)))
        : [];
      const reasons = [];
      if (dirty.length) reasons.push(`${dirty.length} uncommitted file(s) touch its surface`);
      if (committed.length)
        reasons.push(
          `${new Set(committed).size} file(s) committed since its last report (${cutoff.label})`
        );
      if (reasons.length) owed.push({ gate, reason: reasons.join("; ") });
    }

    // Sessions: owed when commits landed after the log file was last written
    // (its mtime = the newest entry), excluding the commit that records it.
    const sessionsPath = join(ROOT, ".ai/notes/SESSIONS.md");
    const log = readFileSync(sessionsPath, "utf8");
    const lastEntry = log.match(/^## (\d{4}-\d{2}-\d{2})/m)?.[1] ?? "undated";
    const sessionsCutoff = statSync(sessionsPath).mtimeMs;
    const after = commits.filter(
      (c) =>
        c.timeMs > sessionsCutoff && !isWrapCommit(c, ".ai/notes/SESSIONS.md")
    ).length;
    if (after > 0)
      owed.push({
        gate: "sessions",
        reason: `${after} commit(s) since the last entry (${lastEntry})`,
      });
  } catch {
    /* git or fs unavailable — owed stays best-effort */
  }
  return owed;
}

const owed = computeOwed();

const status = {
  lastSweep: date,
  standards: standards.status === 0 ? "pass" : "fail",
  security: security.status === 0 ? "pass" : "fail",
  owed,
  notes: "Written by scripts/gate-sweep.mjs (npm run gate:sweep) — deterministic standards + security gates + the gates-owed detector.",
};

mkdirSync(join(ROOT, ".ai/notes"), { recursive: true });
writeFileSync(join(ROOT, ".ai/notes/gate-status.json"), JSON.stringify(status, null, 2) + "\n");
appendFileSync(
  join(ROOT, ".ai/notes/gate-sweeps.log"),
  `${date}  standards=${status.standards}  security=${status.security}\n`
);

const out = [standards.stdout, standards.stderr, security.stdout, security.stderr]
  .filter(Boolean)
  .join("\n")
  .trim();
if (out) console.log(out);
console.log(
  `\nGate sweep ${date}: standards=${status.standards}, security=${status.security} ` +
    `→ .ai/notes/gate-status.json`
);
if (owed.length) {
  console.log("Judgment gates owed:");
  for (const o of owed) console.log(`  • ${o.gate} — ${o.reason}`);
} else {
  console.log("No judgment gates owed.");
}
process.exit(standards.status === 0 && security.status === 0 ? 0 : 1);
