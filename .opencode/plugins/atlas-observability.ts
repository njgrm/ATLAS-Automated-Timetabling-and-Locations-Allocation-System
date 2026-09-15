// .opencode/plugins/atlas-observability.ts
// WF-C03 OpenCode observability plugin (B1/B4/B5 producer).
//
// Auto-discovered by the installed OpenCode 1.18.21 from `.opencode/plugins/`
// (see `opencode debug config`, which resolves this file into the `plugin`
// array). It keeps compact, atomic, bounded session heartbeats under the
// repository Git common directory and records permission/compaction transitions.
//
// Hard boundaries:
//   - it NEVER stores prompts, responses, credentials, tokens, environment
//     contents, browser storage, command output, or source diffs;
//   - it NEVER navigates, logs in, copies a token, or controls a browser;
//   - it NEVER spawns an agent, sends a message, edits product state, approves
//     anything, retries a mutation, or schedules a heartbeat;
//   - every hook body is guarded: a plugin failure must never throw into the
//     OpenCode host, corrupt the repository, or mark a cycle complete.
//
// This module has no import-time side effects, so it is safe to import for
// load verification.
/* @ts-nocheck */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gitCommonDir, runGit } from "../../ops/workflow/lib/git.mjs";
import {
  observabilityPaths,
  recordEvent,
  recordToolAction,
  SUBSCRIBED_EVENTS,
} from "../../ops/workflow/lib/observability.mjs";

const ROLES = ["planner", "executor", "qa", "auditor"];
const STREAM_RE = /^[A-Z0-9][A-Z0-9._-]{1,63}$/;
const FACTS_TTL_MS = 5000;

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function resolveRole(event) {
  const env = safe(() => process.env.ATLAS_WORKFLOW_ROLE, null);
  if (ROLES.includes(env)) return env;
  const agent = safe(() => {
    const info = event && event.properties ? event.properties.info : null;
    return info && typeof info.agent === "string" ? info.agent : null;
  }, null);
  if (agent) {
    const normalized = agent.replace(/^atlas-/, "");
    if (ROLES.includes(normalized)) return normalized;
  }
  return null;
}

function gitFacts(directory) {
  const worktree = safe(() => {
    const res = runGit(["rev-parse", "--show-toplevel"], directory);
    return res.ok ? res.stdout.trim() || null : null;
  }, null);
  const branchRes = safe(() => runGit(["rev-parse", "--abbrev-ref", "HEAD"], directory), null);
  const branch = branchRes && branchRes.ok ? branchRes.stdout.trim() || null : null;
  const headRes = safe(() => runGit(["rev-parse", "HEAD"], directory), null);
  const rawHead = headRes && headRes.ok ? headRes.stdout.trim() : null;
  const head = rawHead && /^[0-9a-f]{40}$/.test(rawHead) ? rawHead : null;
  return { worktree, branch, head };
}

/** Read the committed register read-only to map a branch to its stream id. */
function streamForBranch(worktree, branch) {
  if (!worktree || !branch) return null;
  const stateFile = path.join(worktree, "docs", "plans", "atlas-delivery-cycles.json");
  return safe(() => {
    const doc = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const match = (doc.streams || []).find((s) => s.git && s.git.branch === branch);
    return match && STREAM_RE.test(match.id) ? { stream: match.id, nextAction: typeof match.nextAction === "string" ? match.nextAction : null } : null;
  }, null);
}

export const AtlasObservabilityPlugin = async (input) => {
  let context = null;
  let facts = null;
  let factsAt = 0;
  let streamInfo = null;

  function directory() {
    return (
      safe(() => input && input.directory, null) ||
      safe(() => input && input.worktree, null) ||
      safe(() => input && input.project && input.project.worktree, null) ||
      safe(() => process.cwd(), null)
    );
  }

  function ensureContext() {
    if (context) return context;
    const dir = directory();
    if (!dir) return null;
    const commonDir = safe(() => gitCommonDir(dir), null) || safe(() => (input && input.worktree ? gitCommonDir(input.worktree) : null), null);
    if (!commonDir) return null;
    context = { dir, paths: observabilityPaths(commonDir) };
    return context;
  }

  function currentFacts(dir) {
    const at = Date.now();
    if (facts && at - factsAt < FACTS_TTL_MS) return facts;
    facts = gitFacts(dir);
    factsAt = at;
    if (!streamInfo || !streamInfo.stream) {
      const fromRegister = streamForBranch(facts.worktree, facts.branch);
      if (fromRegister) streamInfo = fromRegister;
    }
    return facts;
  }

  function sessionContext(event) {
    const ctx = ensureContext();
    if (!ctx) return null;
    const current = currentFacts(ctx.dir);
    const envStream = safe(() => process.env.ATLAS_WORKFLOW_STREAM, null);
    const envStreamOk = typeof envStream === "string" && STREAM_RE.test(envStream);
    return {
      role: resolveRole(event),
      stream: envStreamOk ? envStream : streamInfo ? streamInfo.stream : null,
      nextAction: streamInfo ? streamInfo.nextAction : null,
      worktree: current.worktree,
      branch: current.branch,
      head: current.head,
      processId: process.pid,
      host: safe(() => os.hostname(), null),
    };
  }

  return {
    event: async ({ event }) => {
      try {
        const type = event && event.type;
        if (!SUBSCRIBED_EVENTS.includes(type)) return;
        const ctx = ensureContext();
        if (!ctx) return;
        recordEvent(ctx.paths, event, sessionContext(event));
      } catch {
        /* a plugin failure must never propagate into the host */
      }
    },
    "tool.execute.before": async (hookInput) => {
      try {
        const ctx = ensureContext();
        if (!ctx) return;
        const sessionId = safe(() => (hookInput && (hookInput.sessionID || hookInput.sessionId)) || null, null);
        const tool = safe(() => (hookInput && hookInput.tool) || null, null);
        if (!sessionId || !tool) return;
        recordToolAction(ctx.paths, sessionId, tool, { now: new Date().toISOString() });
      } catch {
        /* a plugin failure must never block or fail a tool */
      }
    },
  };
};

export default AtlasObservabilityPlugin;
