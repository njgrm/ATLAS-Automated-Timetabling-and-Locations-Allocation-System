// ops/workflow/lib/liveness.mjs
// Truthful liveness classification for local session heartbeats (WF-C03, B2).
//
// Liveness reconciles three independent sources of evidence:
//   1. the plugin heartbeat record (identity, status, timestamps, process id),
//   2. real Git worktree state (path exists, porcelain dirty, current HEAD),
//   3. machine-register ownership (`streams[].owners`, `leases[]`, `running[]`).
//
// A heartbeat expiry is uncertainty, never proof of death. An existing worktree
// directory is not activity. The only evidence that marks a session RETURNED is
// the session's own terminal event (`session.deleted`) or an explicit ERROR.
import { processAlive } from "./lock.mjs";
import { worktreeStatusPorcelain, runGit } from "./git.mjs";

export const CLASSIFICATIONS = ["ACTIVE", "IDLE", "RETURNED", "ERROR", "STALE_UNCONFIRMED", "UNKNOWN"];
export const DEFAULT_ACTIVE_WINDOW_MS = 5 * 60 * 1000;
export const REGISTER_OWNER_ROLES = ["planner", "executor", "qa", "auditor"];

export function currentHead(worktree) {
  if (typeof worktree !== "string" || worktree.length === 0) return null;
  const res = runGit(["rev-parse", "HEAD"], worktree);
  if (!res.ok) return null;
  const sha = res.stdout.trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

export function ageMs(record, now) {
  const updated = Date.parse(record && record.updatedAt ? record.updatedAt : "");
  if (Number.isNaN(updated)) return null;
  return Math.max(0, now - updated);
}

/**
 * Classify one session. Deterministic and driven only by the supplied evidence:
 * `processAlive` (from the recorded pid), `custodyStale`, and the record's own
 * status/event history. Never classifies a session dead from expiry alone.
 */
export function classifySession({ record, processAlive: alive = null, custodyStale = false, now = Date.now(), activeWindowMs = DEFAULT_ACTIVE_WINDOW_MS }) {
  if (!record || typeof record !== "object" || typeof record.sessionId !== "string") return "UNKNOWN";
  if (record.status === "ERROR" || record.lastEventType === "session.error") return "ERROR";
  if (record.status === "RETURNED") return "RETURNED";
  if (custodyStale) return "STALE_UNCONFIRMED";
  const age = ageMs(record, now);
  if (alive === true) {
    if (age !== null && age <= activeWindowMs) return "ACTIVE";
    return "IDLE";
  }
  // The recorded process is absent. That is uncertainty about the session's
  // state, not proof that the work is dead or that its custody is free.
  return "STALE_UNCONFIRMED";
}

export function recoveryFor(classification, record) {
  switch (classification) {
    case "ACTIVE":
      return "session is live; do not start a competing writer for this worktree or stream";
    case "IDLE":
      return "session is live but has not emitted a recent event; confirm with the owner before any state transition";
    case "RETURNED":
      return `session recorded its terminal event; verify the ${record.stream || "owning"} stream state through workflow:verify before integrating`;
    case "ERROR":
      return "session recorded an error; inspect the owning worktree and rerun the last gate before trusting its state";
    case "STALE_UNCONFIRMED":
      return "process presence could not be confirmed and/or custody expired; recover from the compaction checkpoint and machine state, never assume the session is dead";
    default:
      return "no readable heartbeat for this session; do not infer activity from a worktree directory alone";
  }
}

/** Build the full, evidence-bearing view for one heartbeat record. */
export function buildSessionView({ record, now = Date.now(), activeWindowMs = DEFAULT_ACTIVE_WINDOW_MS, custody = null, register = null }) {
  const alive = record && Number.isInteger(record.processId) ? processAlive(record.processId) : null;
  const custodyStale = custody !== null && custody.state === "STALE_UNCONFIRMED";
  const classification = classifySession({ record, processAlive: alive, custodyStale, now, activeWindowMs });
  const dirty = record && record.worktree ? worktreeStatusPorcelain(record.worktree) : null;
  const head = record && record.worktree ? currentHead(record.worktree) : null;
  const registerStream = register ? register.byId.get(record.stream) || null : null;
  return {
    sessionId: record.sessionId,
    role: record.role,
    stream: record.stream,
    classification,
    status: record.status,
    lastEventType: record.lastEventType,
    lastAtomicAction: record.lastAtomicAction,
    leaseId: record.leaseId,
    worktree: record.worktree,
    branch: record.branch,
    head: record.head,
    observedHead: head,
    headDrift: Boolean(record.head && head && record.head !== head),
    worktreeDirty: dirty === null ? null : dirty.trim().length > 0,
    processId: record.processId,
    processAlive: alive,
    updatedAt: record.updatedAt,
    ageMs: ageMs(record, now),
    revision: record.revision,
    custody: custody ? { leaseId: custody.leaseId, state: custody.state, expiresAt: custody.expiresAt, sessionId: custody.sessionId } : null,
    registerStream: registerStream ? { id: registerStream.id, state: registerStream.state, running: registerStream.running } : null,
    recovery: recoveryFor(classification, record),
  };
}

/** Project the verified machine register into a lookup plus per-stream facts. */
export function registerSnapshot(doc) {
  const byId = new Map();
  const streams = Array.isArray(doc.streams) ? doc.streams : [];
  for (const stream of streams) {
    const ownersActive = REGISTER_OWNER_ROLES.filter((role) => stream.owners && stream.owners[role] && stream.owners[role].status === "ACTIVE");
    byId.set(stream.id, {
      id: stream.id,
      state: stream.state,
      running: Array.isArray(stream.running) ? stream.running : [],
      awaited: Array.isArray(stream.awaited) ? stream.awaited : [],
      ownersActive,
      worktree: stream.git ? stream.git.worktree : null,
      branch: stream.git ? stream.git.branch : null,
    });
  }
  return {
    byId,
    leases: Array.isArray(doc.leases) ? doc.leases.map((l) => ({ id: l.id, streamId: l.streamId, state: l.state, role: l.role, worktree: l.worktree })) : [],
    coordination: doc.coordination || null,
  };
}

export function reconcileRegister({ register, heartbeats }) {
  const warnings = [];
  for (const record of heartbeats) {
    if (!record.stream) continue;
    const stream = register.byId.get(record.stream);
    if (!stream) {
      warnings.push({ code: "HEARTBEAT_UNKNOWN_STREAM", message: `heartbeat ${record.sessionId} names stream ${record.stream}, which the committed register does not define` });
      continue;
    }
    const terminal = ["INTEGRATED", "COMPLETE", "CLOSED", "SUPERSEDED"].includes(stream.state);
    const classification = classifySession({ record, processAlive: record.processId ? processAlive(record.processId) : null });
    if (terminal && (classification === "ACTIVE" || classification === "IDLE")) {
      warnings.push({ code: "HEARTBEAT_ON_TERMINAL_STREAM", message: `heartbeat ${record.sessionId} is ${classification} on terminal stream ${stream.id} (${stream.state})` });
    }
    if ((classification === "ACTIVE" || classification === "IDLE") && stream.ownersActive.length === 0) {
      warnings.push({ code: "REGISTER_OWNER_MISSING", message: `stream ${stream.id} has a live heartbeat but no ACTIVE writable owner in the committed register` });
    }
  }
  for (const lease of register.leases) {
    if (lease.state === "ACTIVE" && !heartbeats.some((h) => h.stream === lease.streamId)) {
      warnings.push({ code: "REGISTER_LEASE_WITHOUT_HEARTBEAT", message: `register lease ${lease.id} is ACTIVE for ${lease.streamId} but no local heartbeat names it` });
    }
  }
  warnings.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.message < b.message ? -1 : a.message > b.message ? 1 : 0));
  return { warnings };
}

// Count conservation: every view increments exactly one bucket, so the buckets
// always sum to the view total. An out-of-domain classification is conserved in
// the explicit UNKNOWN bucket rather than silently dropped, coerced to NaN, or
// added as an un-vocabulary key.
export function summarizeClassifications(views) {
  const byClassification = {};
  for (const name of CLASSIFICATIONS) byClassification[name] = 0;
  for (const view of views) {
    const value = view && typeof view === "object" ? view.classification : null;
    const bucket = CLASSIFICATIONS.includes(value) ? value : "UNKNOWN";
    byClassification[bucket] += 1;
  }
  return byClassification;
}

// Total count represented by a summarizeClassifications result. Used by the
// conservation control: sum(buckets) must always equal the input length.
export function classificationTotal(byClassification) {
  return Object.values(byClassification).reduce((sum, value) => sum + value, 0);
}

/** Concise human view; deterministic given the same state and clock. */
export function formatHuman(report) {
  const lines = [];
  lines.push(`ATLAS workflow status  status=${report.status}  registerRevision=${report.summary.registerRevision}  coordination=${report.summary.coordinationMode}`);
  lines.push(`sessions: ${report.summary.sessions.total} (${CLASSIFICATIONS.map((c) => `${c}=${report.summary.sessions.byClassification[c]}`).join(", ")})`);
  for (const view of report.summary.sessions.views) {
    lines.push(
      `- ${view.sessionId}  [${view.classification}]  role=${view.role || "-"}  stream=${view.stream || "-"}  pid=${view.processId || "-"}(${view.processAlive === true ? "alive" : view.processAlive === false ? "absent" : "unknown"})  worktree=${view.worktree || "-"}  head=${(view.head || "-").slice(0, 10)}  ageMs=${view.ageMs ?? "-"}`,
    );
    if (view.classification !== "ACTIVE") lines.push(`    recovery: ${view.recovery}`);
  }
  for (const warning of report.summary.reconcile.warnings) {
    lines.push(`  warn ${warning.code}: ${warning.message}`);
  }
  for (const action of report.nextActions) {
    lines.push(`next ${action.scope}: ${action.action}`);
  }
  return lines.join("\n");
}
