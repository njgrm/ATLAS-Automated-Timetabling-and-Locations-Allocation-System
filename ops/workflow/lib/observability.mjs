// ops/workflow/lib/observability.mjs
// Local, restart-safe workflow observability state for WF-C03.
//
// Everything written here lives under the repository **Git common directory**
// (`<git-common-dir>/atlas-observability/`), never inside a worktree and never
// as committed data. Heartbeats and notifications are compact, bounded records
// with an exact allowlist of fields; prompts, responses, credentials, tokens,
// environment contents, browser storage, command output, and source diffs are
// structurally impossible to store because they are not on the allowlist and
// free-form text is passed through `lib/redact.mjs`.
//
// Writes are atomic (stage beside the target, then rename over it). A reader
// only ever observes a complete record; a crash between stage and publish
// leaves the prior record intact and an orphan `*.tmp` file that is never read.
//
// One writer per session file: each session owns `<sessions>/<id>.json`.
import fs from "node:fs";
import path from "node:path";
import { writeFileAtomicSync, stageFileSync, sha256Hex } from "./util.mjs";
import { redactOptional, redactText } from "./redact.mjs";
import { acquireLock, releaseLock } from "./lock.mjs";

export const OBSERVABILITY_ROOT = "atlas-observability";
export const HEARTBEAT_SCHEMA = "atlas.observability.heartbeat/1";
export const NOTIFICATION_SCHEMA = "atlas.observability.notifications/1";

export const MAX_HEARTBEAT_BYTES = 8192;
export const MAX_TEXT = 240;
export const MAX_PATH = 400;
export const MAX_TRANSITIONS = 24;
export const MAX_NOTIFICATIONS = 50;
export const MAX_NOTIFICATION_MESSAGE = 300;

export const ROLES = ["planner", "executor", "qa", "auditor"];
export const HEARTBEAT_STATUSES = ["ACTIVE", "IDLE", "RETURNED", "ERROR"];
export const NOTIFICATION_KINDS = ["RETURNED", "ERROR", "CUSTODY_CONFLICT", "DECISION_REQUIRED"];

// The installed OpenCode 1.18.21 bus events this plugin subscribes to. Each id
// is present in the installed binary's event inventory; the mapping below is
// exercised by the fake-event tests.
export const SUBSCRIBED_EVENTS = [
  "session.created",
  "session.updated",
  "session.status",
  "session.idle",
  "session.error",
  "session.compacted",
  "session.deleted",
  "permission.asked",
  "permission.replied",
];

// Events whose payload the plugin reads only for identity/status. No payload
// text is ever copied into a heartbeat.
export const SESSION_ID_EVENTS = new Set(SUBSCRIBED_EVENTS);

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SHA40_RE = /^[0-9a-f]{40}$/;
const STREAM_RE = /^[A-Z0-9][A-Z0-9._-]{1,63}$/;
const SESSION_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export class ObservabilityError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function nowIso(now) {
  if (now instanceof Date) return now.toISOString();
  if (typeof now === "number" && Number.isFinite(now)) return new Date(now).toISOString();
  if (typeof now === "string" && ISO_RE.test(now)) return now;
  return new Date().toISOString();
}

function isoOrNull(value) {
  return typeof value === "string" && ISO_RE.test(value) ? value : null;
}

export function safeSessionFileId(sessionId) {
  const text = typeof sessionId === "string" ? sessionId : "";
  const safe = text.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
  if (safe.length === 0) throw new ObservabilityError("HEARTBEAT_SESSION_ID_REQUIRED", "a heartbeat requires a non-empty session id");
  return safe;
}

export function observabilityPaths(commonDir) {
  if (typeof commonDir !== "string" || commonDir.trim().length === 0) {
    throw new ObservabilityError("OBSERVABILITY_DIR_UNAVAILABLE", "a Git common directory is required for observability state");
  }
  const root = path.join(commonDir, OBSERVABILITY_ROOT);
  const sessionsDir = path.join(root, "sessions");
  const custodyDir = path.join(root, "custody");
  return {
    root,
    sessionsDir,
    custodyDir,
    notificationsFile: path.join(root, "notifications.json"),
    notificationsLockPath: path.join(root, "notifications.lock"),
    custodyLockPath: path.join(root, "custody.lock"),
    sessionFile: (sessionId) => path.join(sessionsDir, `${safeSessionFileId(sessionId)}.json`),
    custodyFile: (key) => path.join(custodyDir, `${key}.json`),
  };
}

export function ensureObservabilityDirs(paths) {
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  fs.mkdirSync(paths.custodyDir, { recursive: true });
}

// ---- Event extraction (identity/status only, never payload text) ----------

export function extractEvent(event) {
  if (event === null || typeof event !== "object") return { type: null, sessionId: null };
  const type = typeof event.type === "string" ? event.type : null;
  const properties = event.properties && typeof event.properties === "object" ? event.properties : {};
  const rawSessionId =
    properties.sessionID ?? (properties.info && properties.info.id) ?? (properties.part && properties.part.sessionID) ?? null;
  const sessionId = typeof rawSessionId === "string" && SESSION_ID_RE.test(rawSessionId) ? rawSessionId : null;
  return { type, sessionId };
}

function statusFromPayload(status) {
  if (typeof status === "string") {
    const upper = status.toUpperCase();
    if (upper === "IDLE") return "IDLE";
    if (upper === "BUSY" || upper === "ACTIVE" || upper === "WORKING") return "ACTIVE";
    if (upper === "ERROR") return "ERROR";
    return null;
  }
  if (status && typeof status === "object" && typeof status.type === "string") {
    return statusFromPayload(status.type);
  }
  return null;
}

export function mapStatusHint(type, event) {
  switch (type) {
    case "session.created":
    case "session.updated":
      return "ACTIVE";
    case "session.status":
      return statusFromPayload(event && event.properties ? event.properties.status : null);
    case "session.idle":
      return "IDLE";
    case "session.error":
      return "ERROR";
    case "session.deleted":
      return "RETURNED";
    default:
      return null;
  }
}

// ---- Heartbeat record ------------------------------------------------------

function coerceRevision(value) {
  if (Number.isInteger(value) && value >= 1) return value;
  return 1;
}

function sanitizeTransitions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list.slice(-MAX_TRANSITIONS)) {
    if (!item || typeof item !== "object") continue;
    const type = redactOptional(item.type, 64);
    if (type === null) continue;
    out.push({
      at: isoOrNull(item.at),
      type,
      status: HEARTBEAT_STATUSES.includes(item.status) ? item.status : null,
    });
  }
  return out;
}

/**
 * Project arbitrary input onto the exact heartbeat allowlist and bound its size.
 * Unknown keys are dropped by construction; free-form text is redacted.
 */
export function buildHeartbeat(input, options = {}) {
  if (input === null || typeof input !== "object") {
    throw new ObservabilityError("HEARTBEAT_NOT_OBJECT", "heartbeat input must be an object");
  }
  const now = nowIso(options.now);
  const sessionId = typeof input.sessionId === "string" ? input.sessionId : "";
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new ObservabilityError("HEARTBEAT_SESSION_ID_INVALID", "heartbeat sessionId must be a non-empty [A-Za-z0-9._:-] id");
  }
  const role = ROLES.includes(input.role) ? input.role : null;
  const stream = typeof input.stream === "string" && STREAM_RE.test(input.stream) ? input.stream : null;
  const head = typeof input.head === "string" && SHA40_RE.test(input.head) ? input.head : null;
  const status = HEARTBEAT_STATUSES.includes(input.status) ? input.status : "ACTIVE";
  const processId = Number.isInteger(input.processId) && input.processId > 0 ? input.processId : null;
  const record = {
    schema: HEARTBEAT_SCHEMA,
    sessionId,
    role,
    stream,
    worktree: redactOptional(input.worktree, MAX_PATH),
    branch: redactOptional(input.branch, 200),
    head,
    leaseId: redactOptional(input.leaseId, 128),
    status,
    firstSeenAt: isoOrNull(input.firstSeenAt) || now,
    updatedAt: isoOrNull(input.updatedAt) || now,
    lastEventAt: isoOrNull(input.lastEventAt),
    lastEventType: redactOptional(input.lastEventType, 64),
    lastAtomicAction: redactOptional(input.lastAtomicAction, 64),
    nextAction: redactOptional(input.nextAction, MAX_TEXT),
    processId,
    host: redactOptional(input.host, 120),
    revision: coerceRevision(input.revision),
    transitions: sanitizeTransitions(input.transitions),
    expiresAt: isoOrNull(input.expiresAt),
  };
  // The projection above cannot carry a credential, but bound the record anyway
  // so a pathological session id or worktree path can never grow it unboundedly.
  let bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
  if (bytes > MAX_HEARTBEAT_BYTES) {
    record.transitions = [];
    record.nextAction = record.nextAction === null ? null : record.nextAction.slice(0, 64);
    bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
  }
  if (bytes > MAX_HEARTBEAT_BYTES) {
    throw new ObservabilityError("HEARTBEAT_TOO_LARGE", `heartbeat is ${bytes} bytes; the limit is ${MAX_HEARTBEAT_BYTES}`);
  }
  return record;
}

function mergeContext(record, context) {
  const merged = { ...record };
  if (context === null || typeof context !== "object") return merged;
  if (ROLES.includes(context.role)) merged.role = context.role;
  if (typeof context.stream === "string" && STREAM_RE.test(context.stream)) merged.stream = context.stream;
  if (typeof context.worktree === "string" && context.worktree.length > 0) merged.worktree = context.worktree;
  if (typeof context.branch === "string" && context.branch.length > 0) merged.branch = context.branch;
  if (typeof context.head === "string" && SHA40_RE.test(context.head)) merged.head = context.head;
  if (typeof context.leaseId === "string" && context.leaseId.length > 0) merged.leaseId = context.leaseId;
  if (Number.isInteger(context.processId) && context.processId > 0) merged.processId = context.processId;
  if (typeof context.host === "string" && context.host.length > 0) merged.host = context.host;
  if (typeof context.nextAction === "string") merged.nextAction = context.nextAction;
  if (typeof context.status === "string" && HEARTBEAT_STATUSES.includes(context.status)) merged.status = context.status;
  return merged;
}

/**
 * Apply one subscribed bus event to a session heartbeat. Pure: it returns the
 * next record and never writes. Unsubscribed events and events without a
 * session id are ignored (`changed: false`).
 */
export function applyEvent(existing, event, context = {}) {
  const { type, sessionId } = extractEvent(event);
  if (!type || !SUBSCRIBED_EVENTS.includes(type)) {
    return { changed: false, reason: "UNSUBSCRIBED_EVENT", record: existing || null, type, sessionId };
  }
  if (!sessionId) {
    return { changed: false, reason: "NO_SESSION_ID", record: existing || null, type, sessionId: null };
  }
  if (existing && existing.sessionId && existing.sessionId !== sessionId) {
    return { changed: false, reason: "SESSION_MISMATCH", record: existing, type, sessionId };
  }
  const now = nowIso(context.now);
  const base = existing && existing.sessionId ? existing : { sessionId, firstSeenAt: now, revision: 0 };
  const merged = mergeContext(base, context);
  const hint = mapStatusHint(type, event);
  if (hint) merged.status = hint;
  merged.status = HEARTBEAT_STATUSES.includes(merged.status) ? merged.status : "ACTIVE";
  merged.updatedAt = now;
  merged.lastEventAt = now;
  merged.lastEventType = type;
  merged.revision = (Number.isInteger(base.revision) && base.revision >= 1 ? base.revision : 0) + 1;
  merged.transitions = [...(Array.isArray(base.transitions) ? base.transitions : []), { at: now, type, status: merged.status }];
  const record = buildHeartbeat(merged, { now });
  return { changed: true, reason: type, record, type, sessionId };
}

/** Record a tool invocation as a sanitized "last atomic action". */
export function applyToolAction(existing, toolName, context = {}) {
  const type = redactOptional(toolName, 64);
  if (!type) return { changed: false, reason: "NO_TOOL_NAME", record: existing || null };
  if (!existing || !existing.sessionId) return { changed: false, reason: "UNKNOWN_SESSION", record: existing || null };
  const now = nowIso(context.now);
  const merged = mergeContext(existing, context);
  merged.lastAtomicAction = type;
  merged.lastEventAt = now;
  merged.updatedAt = now;
  merged.revision = (Number.isInteger(existing.revision) && existing.revision >= 1 ? existing.revision : 0) + 1;
  const record = buildHeartbeat(merged, { now });
  return { changed: true, reason: "tool", record };
}

// ---- Heartbeat persistence -------------------------------------------------

// NOTE: unlike the browser custody lease, a heartbeat is ADVISORY local
// monitoring state. A missing, oversized, or corrupt session record is treated
// as "no heartbeat", and a later event legitimately rewrites it. Custody state
// must never be treated this way: an unreadable lease is uncertain custody and
// every custody operation fails closed (see `readLeaseResult` in custody.mjs).
export function readHeartbeat(paths, sessionId) {
  let raw;
  try {
    raw = fs.readFileSync(paths.sessionFile(sessionId));
  } catch {
    return null;
  }
  if (raw.length > MAX_HEARTBEAT_BYTES) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || parsed.schema !== HEARTBEAT_SCHEMA) return null;
  try {
    return buildHeartbeat(parsed, { now: parsed.updatedAt });
  } catch {
    return null;
  }
}

export function listHeartbeats(paths) {
  let files;
  try {
    files = fs.readdirSync(paths.sessionsDir);
  } catch {
    return [];
  }
  const records = [];
  for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
    const sessionId = file.slice(0, -".json".length);
    const record = readHeartbeat(paths, sessionId);
    if (record) records.push(record);
  }
  return records.sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0));
}

export function writeHeartbeat(paths, record) {
  const normalized = buildHeartbeat(record, { now: record.updatedAt });
  ensureObservabilityDirs(paths);
  writeFileAtomicSync(paths.sessionFile(normalized.sessionId), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

/**
 * Stage a heartbeat beside its target without publishing it. Used to prove the
 * crash-between-stage-and-publish property: the prior record stays intact and
 * the staged `*.tmp` is never read back as a heartbeat.
 */
export function stageHeartbeat(paths, record) {
  const normalized = buildHeartbeat(record, { now: record.updatedAt });
  ensureObservabilityDirs(paths);
  return stageFileSync(paths.sessionFile(normalized.sessionId), `${JSON.stringify(normalized, null, 2)}\n`);
}

export function heartbeatFingerprint(record) {
  return sha256Hex(JSON.stringify(record));
}

// ---- Store-level operations (the exact production path the plugin calls) --

/**
 * Apply one bus event to the local store: read the prior heartbeat, apply the
 * event, publish atomically, and raise a local ERROR notification on
 * `session.error`. This is the whole plugin event path, extracted so it can be
 * exercised in-process without loading the OpenCode runtime.
 */
export function recordEvent(paths, event, context = {}) {
  const { sessionId } = extractEvent(event);
  if (!sessionId) return { changed: false, reason: "NO_SESSION_ID", record: null, notification: null };
  const existing = readHeartbeat(paths, sessionId);
  const applied = applyEvent(existing, event, context);
  if (!applied.changed || !applied.record) {
    return { changed: false, reason: applied.reason, record: applied.record || null, notification: null };
  }
  writeHeartbeat(paths, applied.record);
  let notification = null;
  if (applied.record.lastEventType === "session.error") {
    notification = pushNotification(
      paths,
      { kind: "ERROR", sessionId, stream: applied.record.stream, role: applied.record.role, message: "session.error observed locally" },
      { now: context.now },
    );
  }
  return { changed: true, reason: applied.type, record: applied.record, notification };
}

/** Record a tool invocation as a sanitized last-atomic-action on an existing heartbeat. */
export function recordToolAction(paths, sessionId, toolName, context = {}) {
  const existing = readHeartbeat(paths, sessionId);
  if (!existing) return { changed: false, reason: "UNKNOWN_SESSION", record: null };
  const applied = applyToolAction(existing, toolName, context);
  if (!applied.changed || !applied.record) return { changed: false, reason: applied.reason, record: existing };
  writeHeartbeat(paths, applied.record);
  return { changed: true, reason: "tool", record: applied.record };
}

// ---- Notifications (optional, bounded, local only) -------------------------

export function buildNotification(input, options = {}) {
  if (input === null || typeof input !== "object") {
    throw new ObservabilityError("NOTIFICATION_NOT_OBJECT", "notification input must be an object");
  }
  const now = nowIso(options.now || input.at);
  const kind = NOTIFICATION_KINDS.includes(input.kind) ? input.kind : null;
  if (!kind) {
    throw new ObservabilityError("NOTIFICATION_KIND_INVALID", `notification kind must be one of ${NOTIFICATION_KINDS.join(", ")}`);
  }
  const sessionId = typeof input.sessionId === "string" && SESSION_ID_RE.test(input.sessionId) ? input.sessionId : null;
  const stream = typeof input.stream === "string" && STREAM_RE.test(input.stream) ? input.stream : null;
  const role = ROLES.includes(input.role) ? input.role : null;
  return {
    schema: NOTIFICATION_SCHEMA,
    id: `${now}|${kind}|${sessionId ?? "-"}`,
    kind,
    at: now,
    sessionId,
    stream,
    role,
    message: redactOptional(input.message, MAX_NOTIFICATION_MESSAGE) || kind,
  };
}

export function readNotifications(paths) {
  let raw;
  try {
    raw = fs.readFileSync(paths.notificationsFile);
  } catch {
    return { schema: NOTIFICATION_SCHEMA, entries: [] };
  }
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!parsed || parsed.schema !== NOTIFICATION_SCHEMA || !Array.isArray(parsed.entries)) {
      return { schema: NOTIFICATION_SCHEMA, entries: [] };
    }
    return { schema: NOTIFICATION_SCHEMA, entries: parsed.entries.slice(-MAX_NOTIFICATIONS) };
  } catch {
    return { schema: NOTIFICATION_SCHEMA, entries: [] };
  }
}

/**
 * Append one notification to the bounded local ring buffer. This is a purely
 * local file write: it starts no process, performs no network call, edits no
 * product state, and grants no approval or retry authority.
 *
 * Serialized through its own lock under the observability root so concurrent
 * writers cannot lose an entry. On lock contention the append is skipped rather
 * than forced; a monitoring record is never worth blocking a caller for.
 */
export function pushNotification(paths, input, options = {}) {
  const notification = buildNotification(input, options);
  let lock = null;
  try {
    lock = acquireLock({ lockPath: paths.notificationsLockPath, maxInspect: 3, backoffMs: 20 });
  } catch {
    lock = { ok: false, code: "LOCK_ACQUIRE_FAILED" };
  }
  if (lock && lock.ok === false) {
    return { ok: false, reason: lock.code, entries: readNotifications(paths).entries };
  }
  try {
    ensureObservabilityDirs(paths);
    const current = readNotifications(paths);
    const entries = [...current.entries, notification].slice(-MAX_NOTIFICATIONS);
    writeFileAtomicSync(paths.notificationsFile, `${JSON.stringify({ schema: NOTIFICATION_SCHEMA, entries }, null, 2)}\n`);
    return { ok: true, entries };
  } finally {
    if (lock && lock.ok) releaseLock(lock);
  }
}

export function clearNotifications(paths) {
  ensureObservabilityDirs(paths);
  writeFileAtomicSync(paths.notificationsFile, `${JSON.stringify({ schema: NOTIFICATION_SCHEMA, entries: [] }, null, 2)}\n`);
}

export { redactText, redactOptional };
