// .opencode/plugins/atlas-root-ff.ts
// Standing-step enforcement for AGENTS.md section 14.
//
// `D:/ATLAS` is the shared repo root and the opencode *project*: its
// `.opencode/agents/`, `AGENTS.md` and `docs/plans/live-state.md` are read from
// the checkout and bind every session launched from it. It is never edited, so
// it always fast-forwards cleanly -- but nothing keeps it current, and a stale
// root silently binds sessions to old agent definitions and stale directives
// (observed 2026-09-25: 84 commits behind, so a planner's spawned executors ran
// the previous model while the global config said otherwise).
//
// This plugin runs the standing step automatically whenever the opencode project
// is `D:/ATLAS`: fetch --prune, refuse on a dirty tree, refuse off `main`, then
// `merge --ff-only origin/main`. It never resets, stashes, absorbs, rebases or
// force-pushes; anything it cannot fast-forward is reported and skipped, never
// repaired.
//
// Hard boundaries: every hook body is guarded, so a plugin failure can never
// throw into the OpenCode host or corrupt the repository; it reads no prompts,
// responses, credentials, tokens or diffs.
/* @ts-nocheck */
import { execFileSync } from "node:child_process";

const ROOT = "D:\\ATLAS";
const BRANCH = "main";
const UPSTREAM = "origin/main";
const FETCH_TIMEOUT_MS = 30000;
const GIT_TIMEOUT_MS = 20000;
const MIN_INTERVAL_MS = 10 * 60 * 1000;

let lastRunAt = 0;
let lastResult = null;

function isRoot(directory) {
  if (typeof directory !== "string" || directory.length === 0) return false;
  return directory.replace(/[\\/]+$/, "").toLowerCase() === ROOT.toLowerCase();
}

function git(args, timeout = GIT_TIMEOUT_MS) {
  return execFileSync("git", ["-C", ROOT, ...args], {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Run the standing step once. Never throws; returns a small result object. */
function fastForward() {
  try {
    const startedAt = Date.now();
    git(["fetch", "origin", "--prune"], FETCH_TIMEOUT_MS);

    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch !== BRANCH) {
      return { ok: false, skipped: "not-on-main", branch };
    }

    const dirty = git(["status", "--porcelain"]);
    if (dirty) {
      const detail = dirty.split(/\r?\n/).slice(0, 5).join("; ");
      return { ok: false, skipped: "dirty", detail };
    }

    const before = git(["rev-parse", "HEAD"]);
    try {
      git(["merge", "--ff-only", UPSTREAM]);
    } catch (error) {
      const detail = String(error && error.stderr ? error.stderr : error && error.message ? error.message : error).slice(0, 200);
      return { ok: false, skipped: "not-fast-forward", before, detail };
    }
    const after = git(["rev-parse", "HEAD"]);
    return { ok: true, before, after, moved: before !== after, ms: Date.now() - startedAt };
  } catch (error) {
    const detail = String(error && error.message ? error.message : error).slice(0, 200);
    return { ok: false, skipped: "error", detail };
  }
}

function runIfDue(force) {
  const now = Date.now();
  if (!force && lastResult && now - lastRunAt < MIN_INTERVAL_MS) return lastResult;
  lastRunAt = now;
  lastResult = fastForward();
  return lastResult;
}

export const AtlasRootFastForwardPlugin = async ({ directory, client }) => {
  const root = isRoot(directory);

  async function report(result, trigger) {
    try {
      if (!client || !client.app || typeof client.app.log !== "function") return;
      const ok = !!(result && result.ok);
      const message = ok
        ? `D:/ATLAS root ${result.moved ? "fast-forwarded" : "already current"} (${String(result.after).slice(0, 12)}) [${trigger}]`
        : `D:/ATLAS root standing step SKIPPED: ${result && result.skipped}${result && result.detail ? " - " + result.detail : ""}. Resolve it before relying on this root (AGENTS.md 14). [${trigger}]`;
      await client.app.log({
        body: {
          service: "atlas-root-ff",
          level: ok ? "info" : "warn",
          message,
          extra: result || {},
        },
      });
    } catch {
      /* logging is best-effort and must never block startup */
    }
  }

  if (root) await report(runIfDue(true), "startup");

  return {
    event: async ({ event }) => {
      try {
        if (!root) return;
        if (!event || event.type !== "session.created") return;
        await report(runIfDue(false), "session.created");
      } catch {
        /* a plugin failure must never propagate into the host */
      }
    },
  };
};

export default AtlasRootFastForwardPlugin;
