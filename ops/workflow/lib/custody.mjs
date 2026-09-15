// ops/workflow/lib/custody.mjs
// Exclusive browser-profile custody lease (WF-C03, B3).
//
// The lease is local runtime state under `<git-common-dir>/atlas-observability/`
// and is deliberately NOT part of the committed cycle-state document: the
// committed schema/verifier/renderer contract is frozen for this lane. Custody
// operations READ the committed register (through the production verify path, in
// the CLI) to reconcile stream identity, and never write it.
//
// This module is pure state machinery: it never navigates, logs in, copies a
// token, or controls a browser. It records intent and authorization only.
//
// Invariants:
//   - exactly one ACTIVE controller per profile;
//   - expiry yields STALE_UNCONFIRMED, never an automatically free lease;
//   - only a verified owner release or an explicit operator recovery clears
//     uncertain custody;
//   - every mutation is revision-CAS guarded and returns a typed error with
//     zero mutation on failure.
import fs from "node:fs";
import path from "node:path";
import { sha256Hex, writeFileAtomicSync } from "./util.mjs";

export const CUSTODY_SCHEMA = "atlas.workflow.custody/1";
export const CUSTODY_LOCK_NAME = "custody.lock";
export const DEFAULT_ORIGIN = "https://njgrm.buru-degree.ts.net";
export const DEFAULT_PROFILE = "C:\\Users\\njgro\\.config\\opencode\\playwright-profile";
export const DEFAULT_TTL_MS = 90 * 60 * 1000;
export const CUSTODY_ROLES = ["planner", "executor", "qa", "auditor"];
export const MAX_HISTORY = 32;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const STREAM_RE = /^[A-Z0-9][A-Z0-9._-]{1,63}$/;
const SESSION_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export class CustodyError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail || null;
  }
}

export function isIso(value) {
  return typeof value === "string" && ISO_RE.test(value);
}

// `now` may be a Date, an ISO-8601 string, or an epoch-millisecond number. A
// numeric epoch is the documented default shape (`now = Date.now()`), so it must
// be honoured; silently falling back to the wall clock would make a lease look
// expired (or not) according to nothing the caller asked for.
function nowMs(now) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (typeof now === "string" && ISO_RE.test(now)) return Date.parse(now);
  return Date.now();
}

function nowIso(now) {
  if (now instanceof Date) return now.toISOString();
  if (typeof now === "number" && Number.isFinite(now)) return new Date(now).toISOString();
  if (typeof now === "string" && ISO_RE.test(now)) return now;
  return new Date().toISOString();
}

export function profileKey(profile) {
  const slug = String(profile)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const hash = sha256Hex(String(profile)).slice(0, 12);
  return slug.length > 0 ? `${slug}-${hash}` : `profile-${hash}`;
}

export function custodyFilePath(paths, profile) {
  return paths.custodyFile(profileKey(profile));
}

export function effectiveState(lease, now = Date.now()) {
  if (!lease || typeof lease !== "object") return "UNKNOWN";
  if (lease.state === "RELEASED") return "RELEASED";
  if (isIso(lease.expiresAt) && Date.parse(lease.expiresAt) <= nowMs(now)) return "STALE_UNCONFIRMED";
  return lease.state === "STALE_UNCONFIRMED" ? "STALE_UNCONFIRMED" : "ACTIVE";
}

function assertOrigin(origin, allowOverride) {
  if (typeof origin !== "string" || origin.trim().length === 0) {
    throw new CustodyError("CUSTODY_ORIGIN_REQUIRED", "a browser origin is required");
  }
  if (origin === DEFAULT_ORIGIN) return origin;
  if (allowOverride !== true) {
    throw new CustodyError(
      "CUSTODY_ORIGIN_INVALID",
      `origin ${origin} is not the approved ATLAS origin ${DEFAULT_ORIGIN}; pass the explicit override flag to authorize another origin`,
    );
  }
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new CustodyError("CUSTODY_ORIGIN_INVALID", `origin ${origin} is not a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new CustodyError("CUSTODY_ORIGIN_INVALID", `origin ${origin} must be https`);
  }
  return origin;
}

function requireSession(sessionId, field = "sessionId") {
  if (typeof sessionId !== "string" || !SESSION_RE.test(sessionId)) {
    throw new CustodyError("CUSTODY_SESSION_REQUIRED", `${field} must be a non-empty session identifier`);
  }
  return sessionId;
}

function requireRole(role, field = "role") {
  if (!CUSTODY_ROLES.includes(role)) {
    throw new CustodyError("CUSTODY_ROLE_INVALID", `${field} must be one of ${CUSTODY_ROLES.join(", ")}`);
  }
  return role;
}

function requireStream(stream) {
  if (stream === null || stream === undefined) return null;
  if (typeof stream !== "string" || !STREAM_RE.test(stream)) {
    throw new CustodyError("CUSTODY_STREAM_INVALID", "stream must be an uppercase stream identifier or omitted");
  }
  return stream;
}

export function buildLease(input) {
  if (input === null || typeof input !== "object") {
    throw new CustodyError("CUSTODY_NOT_OBJECT", "lease input must be an object");
  }
  return {
    schema: CUSTODY_SCHEMA,
    leaseId: input.leaseId,
    revision: Number.isInteger(input.revision) && input.revision >= 1 ? input.revision : 1,
    state: ["ACTIVE", "STALE_UNCONFIRMED", "RELEASED"].includes(input.state) ? input.state : "ACTIVE",
    sessionId: input.sessionId,
    role: input.role,
    stream: input.stream ?? null,
    profile: input.profile,
    origin: input.origin,
    loginAuthorized: input.loginAuthorized === true,
    loginBudget: Number.isInteger(input.loginBudget) ? input.loginBudget : 0,
    loginsPerformed: Number.isInteger(input.loginsPerformed) && input.loginsPerformed >= 0 ? input.loginsPerformed : 0,
    expectedAuditDelta: typeof input.expectedAuditDelta === "string" && input.expectedAuditDelta.length > 0 ? input.expectedAuditDelta : null,
    issuedAt: isIso(input.issuedAt) ? input.issuedAt : null,
    renewedAt: isIso(input.renewedAt) ? input.renewedAt : null,
    expiresAt: isIso(input.expiresAt) ? input.expiresAt : null,
    endedAt: isIso(input.endedAt) ? input.endedAt : null,
    cleanupOwner: typeof input.cleanupOwner === "string" && input.cleanupOwner.length > 0 ? input.cleanupOwner : null,
    cleanupStatus: input.cleanupStatus === "COMPLETE" ? "COMPLETE" : "PENDING",
    transfer:
      input.transfer && typeof input.transfer === "object"
        ? {
            toSessionId: input.transfer.toSessionId,
            toRole: input.transfer.toRole,
            requestedAt: isIso(input.transfer.requestedAt) ? input.transfer.requestedAt : null,
            fromAck: input.transfer.fromAck === true,
            toAck: input.transfer.toAck === true,
          }
        : null,
    recoveredBy: typeof input.recoveredBy === "string" ? input.recoveredBy : null,
    recoverReason: typeof input.recoverReason === "string" ? input.recoverReason : null,
    history: Array.isArray(input.history)
      ? input.history.slice(-MAX_HISTORY).map((h) => ({
          at: isIso(h.at) ? h.at : null,
          op: typeof h.op === "string" ? h.op : null,
          state: typeof h.state === "string" ? h.state : null,
          revision: Number.isInteger(h.revision) ? h.revision : null,
          actor: typeof h.actor === "string" ? h.actor : null,
        }))
      : [],
  };
}

export function parseLease(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || parsed.schema !== CUSTODY_SCHEMA || typeof parsed.leaseId !== "string") return null;
  return buildLease(parsed);
}

export function readLease(paths, profile) {
  let raw;
  try {
    raw = fs.readFileSync(custodyFilePath(paths, profile));
  } catch {
    return null;
  }
  return parseLease(raw);
}

/** Read every custody lease under the observability root (status reconciliation). */
export function listLeases(paths) {
  let files;
  try {
    files = fs.readdirSync(paths.custodyDir);
  } catch {
    return [];
  }
  const leases = [];
  for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
    let raw;
    try {
      raw = fs.readFileSync(path.join(paths.custodyDir, file));
    } catch {
      continue;
    }
    const lease = parseLease(raw);
    if (lease) leases.push(lease);
  }
  return leases;
}

export function writeLease(paths, lease) {
  writeFileAtomicSync(custodyFilePath(paths, lease.profile), `${JSON.stringify(buildLease(lease), null, 2)}\n`);
  return buildLease(lease);
}

function loadForMutation(paths, profile, leaseId) {
  const existing = readLease(paths, profile);
  if (!existing) {
    throw new CustodyError("CUSTODY_UNKNOWN_LEASE", `no custody lease exists for profile ${profile}`);
  }
  if (leaseId !== undefined && leaseId !== null && existing.leaseId !== leaseId) {
    throw new CustodyError("CUSTODY_UNKNOWN_LEASE", `lease ${leaseId} does not match the active lease`);
  }
  return existing;
}

function assertCas(existing, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision !== existing.revision) {
    throw new CustodyError(
      "CUSTODY_STALE_REVISION",
      `expected revision ${expectedRevision} does not match lease revision ${existing.revision}`,
      { expectedRevision, actualRevision: existing.revision },
    );
  }
}

function assertOwner(existing, sessionId) {
  if (sessionId !== existing.sessionId) {
    throw new CustodyError("CUSTODY_WRONG_OWNER", "only the current lease owner may perform this operation");
  }
}

export function acquire({
  paths,
  profile = DEFAULT_PROFILE,
  origin = DEFAULT_ORIGIN,
  allowOriginOverride = false,
  sessionId,
  role,
  stream = null,
  loginAuthorized = false,
  loginBudget,
  expectedAuditDelta = null,
  cleanupOwner,
  ttlMs = DEFAULT_TTL_MS,
  leaseId,
  now = Date.now(),
}) {
  if (typeof profile !== "string" || profile.trim().length === 0) {
    throw new CustodyError("CUSTODY_PROFILE_REQUIRED", "a browser profile path is required");
  }
  assertOrigin(origin, allowOriginOverride);
  requireSession(sessionId);
  requireRole(role);
  requireStream(stream);
  if (!Number.isInteger(loginBudget) || loginBudget < 0) {
    throw new CustodyError("CUSTODY_LOGIN_AUTHORIZATION_MISSING", "acquire requires an explicit login budget (use 0 for a zero-login lease)");
  }
  if (loginBudget > 0) {
    if (loginAuthorized !== true) {
      throw new CustodyError("CUSTODY_LOGIN_AUTHORIZATION_MISSING", "a positive login budget requires an explicit login authorization");
    }
    if (typeof expectedAuditDelta !== "string" || expectedAuditDelta.trim().length === 0) {
      throw new CustodyError("CUSTODY_LOGIN_AUTHORIZATION_MISSING", "a positive login budget requires an expected audit delta");
    }
  }
  if (typeof cleanupOwner !== "string" || cleanupOwner.trim().length === 0) {
    throw new CustodyError("CUSTODY_CLEANUP_OWNER_MISSING", "acquire requires a named cleanup owner");
  }
  const existing = readLease(paths, profile);
  const existingState = existing ? effectiveState(existing, now) : null;
  if (existing && existingState !== "RELEASED") {
    throw new CustodyError("CUSTODY_HELD", `profile ${profile} is already held by lease ${existing.leaseId} (${existingState})`, {
      leaseId: existing.leaseId,
      state: existingState,
    });
  }
  const at = nowIso(now);
  const lease = buildLease({
    leaseId: leaseId || `lease-${sha256Hex(`${profile}|${at}|${sessionId}`).slice(0, 12)}`,
    revision: 1,
    state: "ACTIVE",
    sessionId,
    role,
    stream,
    profile,
    origin,
    loginAuthorized: loginAuthorized === true,
    loginBudget,
    loginsPerformed: 0,
    expectedAuditDelta: loginBudget > 0 ? expectedAuditDelta : null,
    issuedAt: at,
    renewedAt: at,
    expiresAt: new Date(nowMs(now) + ttlMs).toISOString(),
    cleanupOwner,
    cleanupStatus: "PENDING",
    history: [{ at, op: "acquire", state: "ACTIVE", revision: 1, actor: sessionId }],
  });
  writeLease(paths, lease);
  return { lease, previousState: existingState };
}

export function renew({ paths, profile = DEFAULT_PROFILE, leaseId, sessionId, expectedRevision, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  const existing = loadForMutation(paths, profile, leaseId);
  assertCas(existing, expectedRevision);
  assertOwner(existing, sessionId);
  const state = effectiveState(existing, now);
  if (state !== "ACTIVE") {
    throw new CustodyError("CUSTODY_NOT_ACTIVE", `lease ${existing.leaseId} is ${state} and cannot be renewed; release or recover it explicitly`, {
      state,
    });
  }
  const at = nowIso(now);
  const next = buildLease({
    ...existing,
    revision: existing.revision + 1,
    renewedAt: at,
    expiresAt: new Date(nowMs(now) + ttlMs).toISOString(),
    history: [...existing.history, { at, op: "renew", state: "ACTIVE", revision: existing.revision + 1, actor: sessionId }],
  });
  writeLease(paths, next);
  return { lease: next, previousState: state };
}

export function transferRequest({ paths, profile = DEFAULT_PROFILE, leaseId, sessionId, expectedRevision, toSessionId, toRole, now = Date.now() }) {
  const existing = loadForMutation(paths, profile, leaseId);
  assertCas(existing, expectedRevision);
  assertOwner(existing, sessionId);
  const state = effectiveState(existing, now);
  if (state !== "ACTIVE") {
    throw new CustodyError("CUSTODY_NOT_ACTIVE", `lease ${existing.leaseId} is ${state} and cannot be transferred`, { state });
  }
  if (existing.transfer) {
    throw new CustodyError("CUSTODY_TRANSFER_IN_PROGRESS", "a transfer is already awaiting acknowledgement");
  }
  requireSession(toSessionId, "toSessionId");
  requireRole(toRole, "toRole");
  const at = nowIso(now);
  const next = buildLease({
    ...existing,
    revision: existing.revision + 1,
    transfer: { toSessionId, toRole, requestedAt: at, fromAck: true, toAck: false },
    history: [...existing.history, { at, op: "transfer-request", state: "ACTIVE", revision: existing.revision + 1, actor: sessionId }],
  });
  writeLease(paths, next);
  return { lease: next, previousState: state };
}

export function transferAck({ paths, profile = DEFAULT_PROFILE, leaseId, sessionId, expectedRevision, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  const existing = loadForMutation(paths, profile, leaseId);
  assertCas(existing, expectedRevision);
  const state = effectiveState(existing, now);
  if (state !== "ACTIVE") {
    throw new CustodyError("CUSTODY_NOT_ACTIVE", `lease ${existing.leaseId} is ${state} and cannot be transferred`, { state });
  }
  if (!existing.transfer) {
    throw new CustodyError("CUSTODY_NO_TRANSFER", "no transfer is awaiting acknowledgement");
  }
  if (existing.transfer.fromAck !== true) {
    throw new CustodyError("CUSTODY_TRANSFER_UNACKNOWLEDGED", "a transfer requires acknowledgement from both owners");
  }
  if (sessionId !== existing.transfer.toSessionId) {
    throw new CustodyError("CUSTODY_WRONG_OWNER", "only the transfer target may acknowledge the transfer");
  }
  const at = nowIso(now);
  const next = buildLease({
    ...existing,
    revision: existing.revision + 1,
    sessionId: existing.transfer.toSessionId,
    role: existing.transfer.toRole,
    transfer: null,
    renewedAt: at,
    expiresAt: new Date(nowMs(now) + ttlMs).toISOString(),
    history: [...existing.history, { at, op: "transfer-ack", state: "ACTIVE", revision: existing.revision + 1, actor: sessionId }],
  });
  writeLease(paths, next);
  return { lease: next, previousState: state };
}

export function release({ paths, profile = DEFAULT_PROFILE, leaseId, sessionId, expectedRevision, cleanupComplete = false, now = Date.now() }) {
  const existing = loadForMutation(paths, profile, leaseId);
  if (existing.state === "RELEASED") {
    throw new CustodyError("CUSTODY_ALREADY_RELEASED", `lease ${existing.leaseId} is already released`);
  }
  assertCas(existing, expectedRevision);
  assertOwner(existing, sessionId);
  if (cleanupComplete !== true || !existing.cleanupOwner) {
    throw new CustodyError("CUSTODY_CLEANUP_INCOMPLETE", "release requires a verified-complete cleanup acknowledgement");
  }
  const at = nowIso(now);
  const next = buildLease({
    ...existing,
    revision: existing.revision + 1,
    state: "RELEASED",
    endedAt: at,
    cleanupStatus: "COMPLETE",
    transfer: null,
    history: [...existing.history, { at, op: "release", state: "RELEASED", revision: existing.revision + 1, actor: sessionId }],
  });
  writeLease(paths, next);
  return { lease: next, previousState: effectiveState(existing, now) };
}

export function recover({ paths, profile = DEFAULT_PROFILE, leaseId, expectedRevision, operator, reason, confirm = false, now = Date.now() }) {
  if (confirm !== true) {
    throw new CustodyError("CUSTODY_RECOVERY_CONFIRMATION_REQUIRED", "operator recovery requires an explicit confirmation flag");
  }
  if (typeof operator !== "string" || operator.trim().length === 0) {
    throw new CustodyError("CUSTODY_RECOVERY_OPERATOR_REQUIRED", "operator recovery requires an operator identity");
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new CustodyError("CUSTODY_RECOVERY_REASON_REQUIRED", "operator recovery requires a reason");
  }
  const existing = loadForMutation(paths, profile, leaseId);
  if (existing.state === "RELEASED") {
    throw new CustodyError("CUSTODY_ALREADY_RELEASED", `lease ${existing.leaseId} is already released`);
  }
  assertCas(existing, expectedRevision);
  const at = nowIso(now);
  const next = buildLease({
    ...existing,
    revision: existing.revision + 1,
    state: "RELEASED",
    endedAt: at,
    transfer: null,
    recoveredBy: operator,
    recoverReason: reason,
    history: [...existing.history, { at, op: "recover", state: "RELEASED", revision: existing.revision + 1, actor: operator }],
  });
  writeLease(paths, next);
  return { lease: next, previousState: effectiveState(existing, now) };
}

export function recordLogin({ paths, profile = DEFAULT_PROFILE, leaseId, sessionId, expectedRevision, now = Date.now() }) {
  const existing = loadForMutation(paths, profile, leaseId);
  assertCas(existing, expectedRevision);
  assertOwner(existing, sessionId);
  const state = effectiveState(existing, now);
  if (state !== "ACTIVE") {
    throw new CustodyError("CUSTODY_NOT_ACTIVE", `lease ${existing.leaseId} is ${state}; it cannot consume a login`, { state });
  }
  if (existing.loginAuthorized !== true) {
    throw new CustodyError("CUSTODY_LOGIN_AUTHORIZATION_MISSING", "this lease carries no login authorization");
  }
  if (existing.loginsPerformed >= existing.loginBudget) {
    throw new CustodyError("CUSTODY_LOGIN_BUDGET_EXHAUSTED", `lease ${existing.leaseId} has exhausted its ${existing.loginBudget}-login budget`);
  }
  const at = nowIso(now);
  const next = buildLease({
    ...existing,
    revision: existing.revision + 1,
    loginsPerformed: existing.loginsPerformed + 1,
    history: [...existing.history, { at, op: "login", state: "ACTIVE", revision: existing.revision + 1, actor: sessionId }],
  });
  writeLease(paths, next);
  return { lease: next, previousState: state };
}

export function summarizeLease(lease, now = Date.now()) {
  const state = effectiveState(lease, now);
  return {
    leaseId: lease.leaseId,
    revision: lease.revision,
    state,
    storedState: lease.state,
    sessionId: lease.sessionId,
    role: lease.role,
    stream: lease.stream,
    profile: lease.profile,
    origin: lease.origin,
    loginAuthorized: lease.loginAuthorized,
    loginBudget: lease.loginBudget,
    loginsPerformed: lease.loginsPerformed,
    loginsRemaining: Math.max(0, lease.loginBudget - lease.loginsPerformed),
    expectedAuditDelta: lease.expectedAuditDelta,
    issuedAt: lease.issuedAt,
    renewedAt: lease.renewedAt,
    expiresAt: lease.expiresAt,
    expired: state === "STALE_UNCONFIRMED",
    endedAt: lease.endedAt,
    cleanupOwner: lease.cleanupOwner,
    cleanupStatus: lease.cleanupStatus,
    transfer: lease.transfer,
    recoveredBy: lease.recoveredBy,
    recoverReason: lease.recoverReason,
  };
}

export function recoveryInstructions(summary) {
  if (summary.state === "ACTIVE") {
    return `owner ${summary.sessionId} holds the lease (revision ${summary.revision}) until ${summary.expiresAt}; renew with --expected-revision ${summary.revision}`;
  }
  if (summary.state === "STALE_UNCONFIRMED") {
    return `custody is uncertain (expired at ${summary.expiresAt}). It is NOT free: the recorded owner ${summary.sessionId} must release with --expected-revision ${summary.revision}, or an operator must run recover --confirm`;
  }
  if (summary.state === "RELEASED") {
    return `lease ${summary.leaseId} is released; a new acquire must carry fresh login authorization`;
  }
  return "no custody lease exists for this profile";
}
