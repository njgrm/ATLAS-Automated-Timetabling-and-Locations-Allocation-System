#!/usr/bin/env node
// ops/workflow/status.mjs
// Truthful liveness view for local workflow observability state (WF-C03, B2).
//
// Reconciles plugin heartbeats with real Git worktree state and the committed
// machine register. READ-ONLY with respect to the register: it never writes the
// state document, the generated register, or a receipt.
//
//   node ops/workflow/status.mjs --state docs/plans/atlas-delivery-cycles.json [--json]
//     [--common-dir <path>] [--now <iso>] [--active-window-ms <n>]
//     [--profile <path>] [--notify-kind <kind>] [--notify-message <text>]
//
// Exit codes: 0 ok, 1 state/observability failure, 2 usage error.
import process from "node:process";
import path from "node:path";
import fs from "node:fs";
import { parseArgs } from "./lib/args.mjs";
import { verifyStateDocument, buildReport } from "./lib/verify.mjs";
import { gitCommonDir } from "./lib/git.mjs";
import { sha256Hex } from "./lib/util.mjs";
import {
  observabilityPaths,
  listHeartbeats,
  readNotifications,
  pushNotification,
  nowIso,
} from "./lib/observability.mjs";
import { listLeases, readLeaseResult, summarizeLease, recoveryInstructions, unreadableRecovery, DEFAULT_PROFILE } from "./lib/custody.mjs";
import { buildSessionView, registerSnapshot, reconcileRegister, summarizeClassifications, formatHuman, DEFAULT_ACTIVE_WINDOW_MS } from "./lib/liveness.mjs";

function emit(report, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatHuman(report)}\n`);
  }
}

function usageReport(parsed) {
  return {
    status: "fail",
    summary: { streams: { total: 0, byState: {} }, errors: 1, statePath: null, stateSha256: null },
    nextActions: [],
    artifacts: [],
    errors: [{ code: parsed.code, message: parsed.message, path: "$" }],
  };
}

const parsed = parseArgs(process.argv.slice(2), {
  required: ["state"],
  optional: ["common-dir", "now", "active-window-ms", "profile", "notify-kind", "notify-message"],
  boolean: ["json"],
});
if (!parsed.ok) {
  emit(usageReport(parsed), true);
  process.exit(2);
}

const ISO_ARG_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const asJson = parsed.values.json === true;
const statePath = parsed.values.state;

// `--now` and `--active-window-ms` drive liveness classification, so a malformed
// value must fail closed (exit 2) rather than silently falling back to the wall
// clock and reporting a misleading ACTIVE/IDLE verdict.
if (parsed.values.now !== undefined && !ISO_ARG_RE.test(parsed.values.now)) {
  emit(usageReport({ code: "USAGE_INVALID_NOW", message: `--now must be an ISO-8601 timestamp, got "${parsed.values.now}"` }), true);
  process.exit(2);
}
const now = nowIso(parsed.values.now);
// Classification compares instants, so the epoch form (not the ISO string) is
// what the liveness engine must receive.
const nowEpoch = Date.parse(now);

let activeWindowMs = DEFAULT_ACTIVE_WINDOW_MS;
if (parsed.values["active-window-ms"] !== undefined) {
  activeWindowMs = Number(parsed.values["active-window-ms"]);
  if (!Number.isInteger(activeWindowMs) || activeWindowMs <= 0) {
    emit(
      usageReport({
        code: "USAGE_INVALID_ACTIVE_WINDOW",
        message: `--active-window-ms must be a positive integer, got "${parsed.values["active-window-ms"]}"`,
      }),
      true,
    );
    process.exit(2);
  }
}

const result = verifyStateDocument(statePath);
if (!result.ok) {
  emit(buildReport(result), asJson);
  process.exit(1);
}

const commonDir = parsed.values["common-dir"] || gitCommonDir(result.repoRoot);
if (!commonDir) {
  emit(
    {
      status: "fail",
      summary: { registerRevision: result.doc.registry.revision, coordinationMode: result.doc.coordination.mode, sessions: { total: 0, byClassification: summarizeClassifications([]), views: [] }, reconcile: { warnings: [] }, custody: null, observedAt: now },
      nextActions: [],
      artifacts: [],
      errors: [{ code: "OBSERVABILITY_DIR_UNAVAILABLE", message: "no Git common directory could be resolved; local heartbeats cannot be read", path: "$" }],
    },
    asJson,
  );
  process.exit(1);
}

const paths = observabilityPaths(commonDir);
const heartbeats = listHeartbeats(paths);
const leaseEntries = listLeases(paths);
const leases = leaseEntries.leases;
const unreadableLeases = leaseEntries.unreadable.map((entry) => ({ ...entry, recovery: unreadableRecovery(entry.path) }));
const leaseBySession = new Map(leases.map((lease) => [lease.leaseId, summarizeLease(lease, nowEpoch)]));
const register = registerSnapshot(result.doc);

const views = heartbeats.map((record) => {
  const custodySummary = record.leaseId ? leaseBySession.get(record.leaseId) || null : null;
  return buildSessionView({ record, now: nowEpoch, activeWindowMs, custody: custodySummary, register });
});

const reconcile = reconcileRegister({ register, heartbeats });
const profile = parsed.values.profile || DEFAULT_PROFILE;
const profileRead = readLeaseResult(paths, profile);
// An existing-but-unreadable record is uncertain custody. It is reported with
// its path and reason, never folded into "no lease exists".
const custodyUnreadable =
  profileRead.kind === "UNREADABLE" ? { path: profileRead.path, reason: profileRead.reason, recovery: unreadableRecovery(profileRead.path) } : null;
const custody = profileRead.lease ? summarizeLease(profileRead.lease, nowEpoch) : null;

const nextActions = [];
if (result.doc.coordination.globalNextAction) {
  nextActions.push({ scope: "global", action: result.doc.coordination.globalNextAction });
}
for (const view of views) {
  if (view.classification !== "ACTIVE") nextActions.push({ scope: view.sessionId, action: view.recovery });
}
for (const entry of unreadableLeases) {
  nextActions.push({ scope: "custody", action: entry.recovery });
}
for (const stream of result.doc.streams) {
  if (stream.nextAction) nextActions.push({ scope: stream.id, action: stream.nextAction });
}
nextActions.sort((a, b) => (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : a.action < b.action ? -1 : a.action > b.action ? 1 : 0));

const artifacts = [];
for (const record of heartbeats) {
  const filePath = paths.sessionFile(record.sessionId);
  let sha = null;
  try {
    sha = sha256Hex(fs.readFileSync(filePath));
  } catch {
    sha = null;
  }
  artifacts.push({ kind: "heartbeat", path: path.relative(process.cwd(), filePath).split(path.sep).join("/"), sha256: sha });
}
for (const view of views) {
  if (view.worktree) artifacts.push({ kind: "worktree", path: view.worktree, head: view.observedHead, processId: view.processId });
}
for (const entry of unreadableLeases) {
  artifacts.push({ kind: "custody-unreadable", path: entry.path, reason: entry.reason });
}
artifacts.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

const errors = [];
if (parsed.values["notify-kind"] !== undefined) {
  try {
    const pushed = pushNotification(paths, {
      kind: parsed.values["notify-kind"],
      message: parsed.values["notify-message"],
      sessionId: views.length > 0 ? views[0].sessionId : null,
      stream: views.length > 0 ? views[0].stream : null,
      now,
    });
    if (!pushed.ok) errors.push({ code: pushed.reason, message: "local notification was not recorded", path: "$.notifications" });
  } catch (err) {
    errors.push({ code: err.code || "NOTIFICATION_FAILED", message: err.message, path: "$.notifications" });
  }
}
const notifications = readNotifications(paths);

const report = {
  status: errors.length === 0 ? "ok" : "fail",
  summary: {
    registerRevision: result.doc.registry.revision,
    coordinationMode: result.doc.coordination.mode,
    globalNextAction: result.doc.coordination.globalNextAction,
    sessions: { total: views.length, byClassification: summarizeClassifications(views), views },
    reconcile,
    custody: custody ? { ...custody, recovery: recoveryInstructions(custody) } : null,
    custodyUnreadable,
    unreadableLeases,
    notifications: notifications.entries,
    observedAt: now,
    statePath,
    stateSha256: result.stateSha256,
  },
  nextActions,
  artifacts,
  errors,
};

emit(report, asJson);
process.exit(errors.length === 0 ? 0 : 1);
