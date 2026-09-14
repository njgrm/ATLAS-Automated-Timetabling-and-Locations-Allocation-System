// ops/workflow/lib/checkpoint.mjs
// Minimal, bounded compaction checkpoint contract (A5).
//
// A checkpoint is the ONLY thing a role may recover from after OpenCode
// compaction. It carries identity and progress pointers, never raw transcripts,
// tool output, credentials, or environment contents. Unknown input keys are
// dropped by construction so a caller cannot smuggle extra state into it.
import { isPlainObject } from "./schema.mjs";

export const CHECKPOINT_VERSION = "1.0.0";

// Exactly the fields the governing packet allows.
export const CHECKPOINT_FIELDS = [
  "streamId",
  "role",
  "worktree",
  "branch",
  "baseSha",
  "candidateSha",
  "integrationSha",
  "state",
  "revision",
  "leaseId",
  "directiveHash",
  "lastCompletedGate",
  "nextAtomicAction",
  "forbiddenBoundaries",
  "pendingApproval",
];

export const MAX_CHECKPOINT_BYTES = 2048;
export const MAX_STRING_LENGTH = 512;
export const MAX_FORBIDDEN_BOUNDARIES = 16;
export const ROLES = ["planner", "executor", "qa", "auditor"];

const SECRET_PATTERNS = [
  { name: "openai-key", re: /\bsk-[A-Za-z0-9_-]{12,}/ },
  { name: "bearer-token", re: /\bbearer\s+[A-Za-z0-9._~+/-]{16,}=*/i },
  { name: "pem-block", re: /-----BEGIN [A-Z ]+-----/ },
  { name: "password-assignment", re: /\bpassword\s*[:=]\s*\S+/i },
  { name: "api-key-assignment", re: /\bapi[_-]?key\s*[:=]\s*\S+/i },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/ },
];

export class CheckpointError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function requireString(value, field, { nullable = true, max = MAX_STRING_LENGTH } = {}) {
  if (value === null || value === undefined) {
    if (nullable) return null;
    throw new CheckpointError("CHECKPOINT_FIELD_REQUIRED", `checkpoint field "${field}" is required`);
  }
  if (typeof value !== "string") {
    throw new CheckpointError("CHECKPOINT_FIELD_TYPE", `checkpoint field "${field}" must be a string or null`);
  }
  if (value.length > max) {
    throw new CheckpointError("CHECKPOINT_FIELD_TOO_LONG", `checkpoint field "${field}" exceeds ${max} characters; never store transcripts`);
  }
  return value;
}

export function assertNoSecrets(checkpoint) {
  for (const field of CHECKPOINT_FIELDS) {
    const value = checkpoint[field];
    if (typeof value === "string") {
      for (const { name, re } of SECRET_PATTERNS) {
        if (re.test(value)) {
          throw new CheckpointError("CHECKPOINT_SECRET_DETECTED", `checkpoint field "${field}" looks like a ${name}; checkpoints never carry credentials`);
        }
      }
    }
  }
  return true;
}

/**
 * Project arbitrary input onto the exact checkpoint allowlist, validate it, and
 * fail closed on oversize or credential-shaped values.
 */
export function buildCheckpoint(input) {
  if (!isPlainObject(input)) throw new CheckpointError("CHECKPOINT_NOT_OBJECT", "checkpoint input must be an object");
  const checkpoint = { checkpointVersion: CHECKPOINT_VERSION };
  for (const field of CHECKPOINT_FIELDS) {
    if (field === "forbiddenBoundaries") {
      const list = input[field];
      if (list === undefined || list === null) checkpoint[field] = [];
      else if (!Array.isArray(list)) throw new CheckpointError("CHECKPOINT_FIELD_TYPE", 'checkpoint field "forbiddenBoundaries" must be an array of strings');
      else {
        if (list.length > MAX_FORBIDDEN_BOUNDARIES) {
          throw new CheckpointError("CHECKPOINT_TOO_MANY_BOUNDARIES", `checkpoint may carry at most ${MAX_FORBIDDEN_BOUNDARIES} forbidden boundaries`);
        }
        checkpoint[field] = list.map((item, i) => requireString(item, `forbiddenBoundaries[${i}]`, { nullable: false, max: 160 }));
      }
      continue;
    }
    checkpoint[field] = requireString(input[field], field, { nullable: true });
  }
  if (checkpoint.role !== null && !ROLES.includes(checkpoint.role)) {
    throw new CheckpointError("CHECKPOINT_ROLE_INVALID", `checkpoint role must be one of ${ROLES.join(", ")}`);
  }
  if (checkpoint.revision !== null && !/^\d+$/.test(checkpoint.revision)) {
    throw new CheckpointError("CHECKPOINT_REVISION_INVALID", "checkpoint revision must be a non-negative integer string");
  }
  assertNoSecrets(checkpoint);
  const bytes = Buffer.byteLength(JSON.stringify(checkpoint), "utf8");
  if (bytes > MAX_CHECKPOINT_BYTES) {
    throw new CheckpointError("CHECKPOINT_TOO_LARGE", `checkpoint is ${bytes} bytes; the limit is ${MAX_CHECKPOINT_BYTES} bytes`);
  }
  return checkpoint;
}

export function serializeCheckpoint(checkpoint) {
  return `${JSON.stringify(checkpoint)}\n`;
}

export function parseCheckpoint(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new CheckpointError("CHECKPOINT_PARSE_FAILED", `checkpoint is not valid JSON: ${err.message}`);
  }
  if (!isPlainObject(parsed) || parsed.checkpointVersion !== CHECKPOINT_VERSION) {
    throw new CheckpointError("CHECKPOINT_VERSION_UNSUPPORTED", `unsupported checkpoint version ${JSON.stringify(parsed && parsed.checkpointVersion)}`);
  }
  return buildCheckpoint(parsed);
}

/**
 * Build a checkpoint from the authoritative state document for one stream. The
 * caller supplies only the live session context (role, lease id, directive hash,
 * last completed gate, next atomic action) that the state document cannot know.
 */
export function checkpointFromState(doc, streamId, context = {}) {
  const stream = doc.streams.find((s) => s.id === streamId);
  if (!stream) throw new CheckpointError("CHECKPOINT_STREAM_UNKNOWN", `stream ${streamId} is not defined in the state document`);
  return buildCheckpoint({
    streamId: stream.id,
    role: context.role ?? null,
    worktree: stream.git.worktree,
    branch: stream.git.branch,
    baseSha: stream.git.baseSha,
    candidateSha: stream.git.candidateSha,
    integrationSha: stream.git.integrationSha,
    state: stream.state,
    revision: String(doc.registry.revision),
    leaseId: context.leaseId ?? null,
    directiveHash: context.directiveHash ?? null,
    lastCompletedGate: context.lastCompletedGate ?? null,
    nextAtomicAction: stream.nextAction,
    forbiddenBoundaries: context.forbiddenBoundaries ?? [],
    pendingApproval: context.pendingApproval ?? (stream.approval && stream.approval.presentedReady ? "presented-not-granted" : null),
  });
}
