#!/usr/bin/env node
// ops/workflow/custody.mjs
// Exclusive browser-profile custody lease CLI (WF-C03, B3).
//
// Narrow operations only: acquire, renew, transfer-request, transfer-ack,
// release, recover, login, status. Every mutation runs under an exclusive lock
// that reuses the state-transition lock's publish/reclaim/claim-mutex semantics
// and is revision-CAS guarded; a rejected operation mutates nothing.
//
// This CLI never navigates, logs in, copies a token, or controls a browser. It
// records and validates custody, login authorization/budget, and cleanup
// ownership as local state. It reads the committed register for stream identity
// through the production verify path and never writes it.
//
// Exit codes: 0 ok, 1 custody/state failure, 2 usage error.
import process from "node:process";
import { parseArgs } from "./lib/args.mjs";
import { verifyStateDocument, buildReport } from "./lib/verify.mjs";
import { gitCommonDir } from "./lib/git.mjs";
import { acquireLock, releaseLock } from "./lib/lock.mjs";
import { observabilityPaths, nowIso } from "./lib/observability.mjs";
import {
  CustodyError,
  acquire,
  renew,
  transferRequest,
  transferAck,
  release,
  recover,
  recordLogin,
  readLeaseResult,
  listLeases,
  summarizeLease,
  recoveryInstructions,
  unreadableRecovery,
  DEFAULT_ORIGIN,
  DEFAULT_PROFILE,
  DEFAULT_TTL_MS,
} from "./lib/custody.mjs";

const OPS = ["acquire", "renew", "transfer-request", "transfer-ack", "release", "recover", "login", "status"];

function emit(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function fail(code, message, path = "$", extra = {}) {
  return {
    status: "fail",
    summary: { operation: extra.operation || null },
    nextActions: [],
    artifacts: [],
    errors: [{ code, message, path }],
  };
}

const parsed = parseArgs(process.argv.slice(2), {
  required: ["op", "state"],
  optional: [
    "profile",
    "origin",
    "session",
    "role",
    "stream",
    "lease",
    "expected-revision",
    "login-budget",
    "expected-audit-delta",
    "cleanup-owner",
    "to-session",
    "to-role",
    "operator",
    "reason",
    "now",
    "ttl-min",
  ],
  boolean: ["json", "login-authorized", "override-origin", "cleanup-complete", "confirm"],
});
if (!parsed.ok) {
  emit(fail(parsed.code, parsed.message));
  process.exit(2);
}
const op = parsed.values.op;
if (!OPS.includes(op)) {
  emit(fail("USAGE_UNKNOWN_OP", `unknown custody op "${op}"; expected one of ${OPS.join(", ")}`));
  process.exit(2);
}

const result = verifyStateDocument(parsed.values.state);
if (!result.ok) {
  emit(buildReport(result));
  process.exit(1);
}
if (parsed.values.stream !== undefined && !result.doc.streams.some((s) => s.id === parsed.values.stream)) {
  emit(fail("CUSTODY_UNKNOWN_STREAM", `stream ${parsed.values.stream} is not defined in the committed register`, "$.stream", { operation: op }));
  process.exit(1);
}

const commonDir = gitCommonDir(result.repoRoot);
if (!commonDir) {
  emit(fail("OBSERVABILITY_DIR_UNAVAILABLE", "no Git common directory could be resolved", "$", { operation: op }));
  process.exit(1);
}
const paths = observabilityPaths(commonDir);

const ISO_ARG_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const profile = parsed.values.profile || DEFAULT_PROFILE;

// Custody timestamps and TTLs are load-bearing (they decide ACTIVE vs
// STALE_UNCONFIRMED), so malformed values fail closed as usage errors instead of
// silently defaulting to the wall clock or the default TTL.
if (parsed.values.now !== undefined && !ISO_ARG_RE.test(parsed.values.now)) {
  emit(fail("USAGE_INVALID_NOW", `--now must be an ISO-8601 timestamp, got "${parsed.values.now}"`));
  process.exit(2);
}
const now = nowIso(parsed.values.now);

let ttlMs = DEFAULT_TTL_MS;
if (parsed.values["ttl-min"] !== undefined) {
  const ttlMinutes = Number(parsed.values["ttl-min"]);
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    emit(fail("USAGE_INVALID_TTL", `--ttl-min must be a positive number of minutes, got "${parsed.values["ttl-min"]}"`));
    process.exit(2);
  }
  ttlMs = ttlMinutes * 60 * 1000;
}
const expectedRevision = parsed.values["expected-revision"] !== undefined ? Number(parsed.values["expected-revision"]) : undefined;
const leaseId = parsed.values.lease;
const sessionId = parsed.values.session;

function respond(operation, lease, extra = {}) {
  const summary = lease ? summarizeLease(lease, now) : null;
  const report = {
    status: "ok",
    summary: { operation, profile, ...extra, lease: summary, recovery: summary ? recoveryInstructions(summary) : null },
    nextActions: summary && summary.state === "ACTIVE" ? [{ scope: summary.leaseId, action: recoveryInstructions(summary) }] : [],
    artifacts: [{ kind: "custody", profile, leaseId: summary ? summary.leaseId : null, path: null }],
    errors: [],
  };
  return report;
}

function withLock(fn) {
  const lock = acquireLock({ lockPath: paths.custodyLockPath, maxInspect: 8, backoffMs: 40 });
  if (!lock.ok) return { ok: false, code: lock.code, message: lock.message };
  try {
    return { ok: true, value: fn() };
  } finally {
    releaseLock(lock);
  }
}

try {
  if (op === "status") {
    const read = readLeaseResult(paths, profile);
    const entries = listLeases(paths);
    const knownLeases = entries.leases.map((l) => summarizeLease(l, now));
    const unreadableLeases = entries.unreadable.map((u) => ({ ...u, recovery: unreadableRecovery(u.path) }));

    // An existing-but-unreadable record is uncertain custody. Reporting it as
    // "no lease" (or exiting 0) would let a caller assume the profile is free.
    if (read.kind === "UNREADABLE") {
      const recovery = unreadableRecovery(read.path);
      emit({
        status: "fail",
        summary: {
          operation: op,
          profile,
          origin: parsed.values.origin || DEFAULT_ORIGIN,
          lease: null,
          unreadable: { path: read.path, reason: read.reason, recovery },
          unreadableLeases,
          leases: knownLeases,
        },
        nextActions: [{ scope: "custody", action: recovery }],
        artifacts: [{ kind: "custody", profile, leaseId: null, path: read.path }],
        errors: [{ code: "CUSTODY_UNREADABLE", message: read.reason, path: read.path }],
      });
      process.exit(1);
    }

    const summary = read.lease ? summarizeLease(read.lease, now) : null;
    emit({
      status: "ok",
      summary: {
        operation: op,
        profile,
        origin: parsed.values.origin || DEFAULT_ORIGIN,
        lease: summary,
        recovery: summary ? recoveryInstructions(summary) : "no custody lease exists for this profile",
        unreadableLeases,
        leases: knownLeases,
      },
      nextActions: summary ? [{ scope: summary.leaseId, action: recoveryInstructions(summary) }] : [],
      artifacts: [],
      errors: [],
    });
    process.exit(0);
  }

  const outcome = withLock(() => {
    switch (op) {
      case "acquire":
        return acquire({
          paths,
          profile,
          origin: parsed.values.origin || DEFAULT_ORIGIN,
          allowOriginOverride: parsed.values["override-origin"] === true,
          sessionId,
          role: parsed.values.role,
          stream: parsed.values.stream ?? null,
          loginAuthorized: parsed.values["login-authorized"] === true,
          loginBudget: parsed.values["login-budget"] !== undefined ? Number(parsed.values["login-budget"]) : undefined,
          expectedAuditDelta: parsed.values["expected-audit-delta"] ?? null,
          cleanupOwner: parsed.values["cleanup-owner"],
          ttlMs,
          leaseId,
          now,
        });
      case "renew":
        return renew({ paths, profile, leaseId, sessionId, expectedRevision, ttlMs, now });
      case "transfer-request":
        return transferRequest({ paths, profile, leaseId, sessionId, expectedRevision, toSessionId: parsed.values["to-session"], toRole: parsed.values["to-role"], now });
      case "transfer-ack":
        return transferAck({ paths, profile, leaseId, sessionId, expectedRevision, ttlMs, now });
      case "release":
        return release({ paths, profile, leaseId, sessionId, expectedRevision, cleanupComplete: parsed.values["cleanup-complete"] === true, now });
      case "recover":
        return recover({ paths, profile, leaseId, expectedRevision, operator: parsed.values.operator, reason: parsed.values.reason, confirm: parsed.values.confirm === true, now });
      case "login":
        return recordLogin({ paths, profile, leaseId, sessionId, expectedRevision, now });
      default:
        throw new CustodyError("USAGE_UNKNOWN_OP", `unhandled custody op ${op}`);
    }
  });

  if (!outcome.ok) {
    emit(fail(outcome.code, outcome.message, "$", { operation: op }));
    process.exit(1);
  }
  emit(respond(op, outcome.value.lease, { previousState: outcome.value.previousState }));
  process.exit(0);
} catch (err) {
  const code = err instanceof CustodyError ? err.code : "CUSTODY_INTERNAL_ERROR";
  emit({ ...fail(code, err.message, "$.custody", { operation: op }), detail: err.detail || null });
  process.exit(1);
}
