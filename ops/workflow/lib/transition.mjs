// ops/workflow/lib/transition.mjs
// Atomic, narrowly-named delivery-cycle state transitions.
//
// One transition performs, under an exclusive repository-common-dir lock:
//   read -> schema/semantic verify -> expected-revision (CAS) -> mutate exactly
//   one stream -> render -> verify rendered bytes -> optionally mint/pin the
//   closure receipt -> atomic replace.
//
// Any invalid input, stale revision, invalid transition, ambiguous stream,
// failed render, failed receipt, or lock contention fails WITHOUT modifying the
// state document, the rendered register, or any receipt file.
import fs from "node:fs";
import path from "node:path";
import {
  verifyStateDocument,
  TERMINAL_STATES,
  RESOLUTION_DISPOSITIONS,
  REPAIRABLE_ERROR_CODES,
  repairableErrorTuples,
  resolveHeartbeats,
  normalizeNowMs,
} from "./verify.mjs";
import { renderRegister, GENERATED_NOTICE } from "./render.mjs";
import { sha256Hex, stageFileSync, commitStagedSync, discardStagedSync } from "./util.mjs";
import { resolveRepoRoot, createGitMemo } from "./git.mjs";
import { buildReceipt, receiptPathFor } from "./receipt.mjs";
import { acquireLock, releaseLock } from "./lock.mjs";
import { loadSchema, validateValue, isPlainObject } from "./schema.mjs";
import { containsSecret } from "./redact.mjs";
import { DEFAULT_ACTIVE_WINDOW_MS, ageMs } from "./liveness.mjs";

export const DEFAULT_RENDER_REL = "docs/plans/atlas-active-delivery-streams.generated.md";

export class TransitionError extends Error {
  constructor(code, message, errPath = "$") {
    super(message);
    this.code = code;
    this.path = errPath;
  }
}

const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

function cloneDoc(doc) {
  return JSON.parse(JSON.stringify(doc));
}

export function parseGates(value) {
  if (!nonEmpty(value)) throw new TransitionError("TRANSITION_GATES_REQUIRED", "--gates must be provided as total/passed/failed/blocked/unperformed", "$.gates");
  const parts = value.split("/");
  if (parts.length !== 5) throw new TransitionError("TRANSITION_GATES_INVALID", `--gates must have five "/"-separated integers, got "${value}"`, "$.gates");
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new TransitionError("TRANSITION_GATES_INVALID", `--gates values must be non-negative integers, got "${value}"`, "$.gates");
  }
  const [total, passed, failed, blocked, unperformed] = nums;
  return { total, passed, failed, blocked, unperformed };
}

export function isCleanGates(g) {
  return g.total > 0 && g.passed === g.total && g.failed === 0 && g.blocked === 0 && g.unperformed === 0;
}

// Predeclared gate classes. The plan is fixed when the stream is registered and
// may only ever be raised; a predeclared gate can never be moved to a lighter
// class or dropped from the arithmetic.
export const GATE_CLASSES = ["MANDATORY_SOURCE", "MANDATORY_LIVE", "DEFERRED_EXTERNAL"];

function parseCounters(name, counts) {
  const nums = counts.split("/").map((part) => Number(part));
  if (nums.length !== 5 || nums.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new TransitionError(
      "TRANSITION_GATES_CLASSES_INVALID",
      `gate class "${name}" counters must be five non-negative integers (total/passed/failed/blocked/unperformed), got "${counts}"`,
      "$.gates.classes",
    );
  }
  const [total, passed, failed, blocked, unperformed] = nums;
  return { total, passed, failed, blocked, unperformed };
}

export function parseGatesClasses(value) {
  if (!nonEmpty(value)) {
    throw new TransitionError(
      "TRANSITION_GATES_CLASSES_REQUIRED",
      "--gates-classes must be provided as CLASS=t/p/f/b/u,CLASS=t/p/f/b/u,CLASS=t/p/f/b/u",
      "$.gates.classes",
    );
  }
  const classes = {};
  for (const entry of value.split(",")) {
    const eq = entry.indexOf("=");
    if (eq === -1) {
      throw new TransitionError("TRANSITION_GATES_CLASSES_INVALID", `--gates-classes entry "${entry}" must be CLASS=t/p/f/b/u`, "$.gates.classes");
    }
    const name = entry.slice(0, eq);
    if (!GATE_CLASSES.includes(name)) {
      throw new TransitionError("TRANSITION_GATES_CLASSES_INVALID", `unknown gate class "${name}" (known: ${GATE_CLASSES.join(", ")})`, "$.gates.classes");
    }
    if (Object.prototype.hasOwnProperty.call(classes, name)) {
      throw new TransitionError("TRANSITION_GATES_CLASSES_INVALID", `duplicate gate class "${name}"`, "$.gates.classes");
    }
    classes[name] = parseCounters(name, entry.slice(eq + 1));
  }
  for (const name of GATE_CLASSES) {
    if (!Object.prototype.hasOwnProperty.call(classes, name)) {
      throw new TransitionError("TRANSITION_GATES_CLASSES_INVALID", `--gates-classes must declare every class; missing "${name}"`, "$.gates.classes");
    }
  }
  return classes;
}

export function parseGatesPlan(value) {
  const plan = {};
  for (const entry of value.split(",")) {
    const eq = entry.indexOf("=");
    if (eq === -1) {
      throw new TransitionError("TRANSITION_GATE_PLAN_INVALID", `--gates-plan entry "${entry}" must be CLASS=n`, "$.gates.plan");
    }
    const name = entry.slice(0, eq);
    const amount = Number(entry.slice(eq + 1));
    if (!GATE_CLASSES.includes(name)) {
      throw new TransitionError("TRANSITION_GATE_PLAN_INVALID", `unknown gate class "${name}" (known: ${GATE_CLASSES.join(", ")})`, "$.gates.plan");
    }
    if (Object.prototype.hasOwnProperty.call(plan, name)) {
      throw new TransitionError("TRANSITION_GATE_PLAN_INVALID", `duplicate gate class "${name}"`, "$.gates.plan");
    }
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TransitionError("TRANSITION_GATE_PLAN_INVALID", `gate class "${name}" plan must be a non-negative integer, got "${entry.slice(eq + 1)}"`, "$.gates.plan");
    }
    plan[name] = amount;
  }
  for (const name of GATE_CLASSES) {
    if (!Object.prototype.hasOwnProperty.call(plan, name)) {
      throw new TransitionError("TRANSITION_GATE_PLAN_INVALID", `--gates-plan must declare every class; missing "${name}"`, "$.gates.plan");
    }
  }
  return plan;
}

function verifyRenderedBytes(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) {
    throw new TransitionError("TRANSITION_RENDER_EMPTY", "renderer produced empty output", "$.render");
  }
  if (!markdown.includes(GENERATED_NOTICE)) {
    throw new TransitionError("TRANSITION_RENDER_NOTICE_MISSING", "rendered register lacks the generated notice", "$.render");
  }
  if (markdown.includes("\r")) {
    throw new TransitionError("TRANSITION_RENDER_NOT_LF", "rendered register contains CR bytes", "$.render");
  }
  if (!markdown.endsWith("\n")) {
    throw new TransitionError("TRANSITION_RENDER_NO_TRAILING_NEWLINE", "rendered register must end with a newline", "$.render");
  }
}

function applyAwaitedRunning(stream, flags, defaults) {
  if (flags.awaited !== undefined) stream.awaited = JSON.parse(flags.awaited);
  else if (defaults && defaults.awaited) stream.awaited = defaults.awaited.slice();
  if (flags.running !== undefined) stream.running = JSON.parse(flags.running);
  else if (defaults && defaults.running) stream.running = defaults.running.slice();
  if (!Array.isArray(stream.awaited) || stream.awaited.some((v) => typeof v !== "string")) {
    throw new TransitionError("TRANSITION_AWAITED_INVALID", "--awaited must be a JSON array of strings", "$.awaited");
  }
  if (!Array.isArray(stream.running) || stream.running.some((v) => typeof v !== "string")) {
    throw new TransitionError("TRANSITION_RUNNING_INVALID", "--running must be a JSON array of strings", "$.running");
  }
}

// ---- create-stream input surface (WF-C04) ---------------------------------
// A new stream arrives as exactly one reviewed JSON document containing one
// schema-complete stream record. Arbitrary JSON Patch, JavaScript evaluation,
// and partial mutation of existing streams are not expressible here: the file is
// parsed as a single object, validated against the shipped `$defs.stream`
// schema, and appended. The resulting candidate document then goes through the
// same verifier, render, render-byte check, and atomic replace every other
// transition uses, so a rejected spec leaves state, render, and receipt bytes
// untouched.
const OBSERVATION_REF = "refs/remotes/origin/main";
const OBSERVATION_KIND = "REMOTE_TRACKING_REF";
const SHA40_RE = /^[0-9a-f]{40}$/;

// Resolve `--stream-spec` against the process working directory, never against
// the state document, and never search a default location.
function loadStreamSpec(specFlag) {
  const specAbs = path.resolve(specFlag);
  let bytes;
  try {
    bytes = fs.readFileSync(specAbs);
  } catch (err) {
    throw new TransitionError("CREATE_SPEC_UNREADABLE", `cannot read --stream-spec at ${specAbs}: ${err.message}`, "$.streamSpec");
  }
  const text = bytes.toString("utf8");
  // Credential-shaped content is rejected before parsing and never echoed. The
  // value is not printed in the error, the report, or any artifact.
  if (containsSecret(text)) {
    throw new TransitionError(
      "CREATE_SPEC_SECRET_CONTENT",
      "the stream spec contains credential-shaped content; the value is not echoed or written",
      "$.streamSpec",
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new TransitionError("CREATE_SPEC_PARSE_FAILED", `--stream-spec is not valid JSON: ${err.message}`, "$.streamSpec");
  }
  if (!isPlainObject(parsed)) {
    throw new TransitionError("CREATE_SPEC_NOT_OBJECT", "--stream-spec must contain exactly one JSON object", "$.streamSpec");
  }
  return { specAbs, stream: parsed };
}

// Validate the spec against the same schema the state document uses. Unknown
// keys anywhere in the record are reported with their exact path; every other
// schema violation is summarized by code and path only, so no spec value can
// leak into the report.
function validateStreamSpec(stream) {
  const loaded = loadSchema();
  if (!loaded.ok) throw new TransitionError("CREATE_SPEC_SCHEMA_UNAVAILABLE", loaded.message, "$schema");
  const streamSchema = loaded.schema && loaded.schema.$defs ? loaded.schema.$defs.stream : null;
  if (!streamSchema) throw new TransitionError("CREATE_SPEC_SCHEMA_UNAVAILABLE", "the cycle-state schema does not define a stream record", "$schema");
  const errors = [];
  validateValue(streamSchema, stream, "$.stream", loaded.schema, errors);
  if (errors.length === 0) return;
  const unknown = errors.find((e) => e.code === "SCHEMA_UNKNOWN_KEY");
  if (unknown) {
    throw new TransitionError(
      "CREATE_SPEC_UNKNOWN_KEY",
      `unknown key at ${unknown.path}; a stream spec must be exactly a schema-complete stream record`,
      unknown.path,
    );
  }
  const summary = errors.map((e) => `${e.code} at ${e.path}`).join("; ");
  throw new TransitionError("CREATE_SPEC_INVALID", `stream spec failed schema validation: ${summary}`, "$.streamSpec");
}

// Creation-time claim/evidence consistency. A record may not claim more activity
// than it can evidence: RUNNING needs work named in `running[]`, PLANNED must
// name nothing running, and an owner claiming ACTIVE needs a session id.
// `PLANNED` + an ACTIVE lease and `PLANNED` + a dirty worktree are additionally
// enforced on the final candidate document by the verifier
// (`PLANNED_WITH_LIVE_LEASE`, `PLANNED_WITH_DIRTY_WORKTREE`).
function assertClaimEvidenceConsistency(stream) {
  if (stream.state === "RUNNING" && stream.running.length === 0) {
    throw new TransitionError("CREATE_SPEC_CLAIM_INCONSISTENT", "state RUNNING requires a non-empty running[] list", "$.stream.running");
  }
  if (stream.state === "PLANNED" && stream.running.length > 0) {
    throw new TransitionError("CREATE_SPEC_CLAIM_INCONSISTENT", "state PLANNED requires an empty running[] list", "$.stream.running");
  }
  for (const role of ["planner", "executor", "qa", "auditor"]) {
    const owner = stream.owners ? stream.owners[role] : null;
    if (owner && owner.status === "ACTIVE" && !nonEmpty(owner.sessionId)) {
      throw new TransitionError(
        "CREATE_SPEC_CLAIM_INCONSISTENT",
        `owner ${role} claims status ACTIVE without a sessionId`,
        `$.stream.owners.${role}.sessionId`,
      );
    }
  }
}

export const QA_VERDICTS = ["ACCEPT_READY", "CORRECTION_REQUIRED", "PLANNER_DECISION_REQUIRED"];
export const AUDITOR_VERDICTS = ["AUDIT_CLEAR", "CORRECTION_REQUIRED", "PLANNER_DECISION_REQUIRED"];
export const LEASE_STATES = ["ACTIVE", "RETURNED", "IDLE", "ERROR", "STALE_UNCONFIRMED"];
export const LEASE_ROLES = ["planner", "executor", "qa", "auditor"];
export const BLOCKER_KINDS = ["NONE", "EXTERNAL", "DEPENDENCY", "APPROVAL", "INTERNAL"];

// The complete schema-declared stream-state domain. `reconcile-stream` may edit
// the residue of every state EXCEPT RUNNING: RUNNING is the one state whose
// residue is itself a claim of live work, so it may only be exited through the
// proof-gated `abandon-stream`, never edited in place.
export const STREAM_STATES = [
  "PLANNED",
  "RUNNING",
  "REVIEW_REQUIRED",
  "CORRECTION_REQUIRED",
  "ACCEPT_READY",
  "INTEGRATION_READY",
  "INTEGRATED",
  "DECISION_REQUIRED",
  "HIGH_APPROVAL_REQUIRED",
  "BLOCKED",
  "EXTERNALLY_BLOCKED",
  "SUPERSEDED",
  "CLOSED",
  "COMPLETE",
];
export const RECONCILE_FROM_STATES = STREAM_STATES.filter((state) => state !== "RUNNING");

// Parse a `--x <json array of strings>` flag with the same validation style the
// existing `--awaited`/`--running` round-trip flags use.
function parseStringArrayFlag(flagName, raw, code, errPath) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new TransitionError(code, `--${flagName} must be valid JSON: ${err.message}`, errPath);
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    throw new TransitionError(code, `--${flagName} must be a JSON array of strings`, errPath);
  }
  return parsed;
}

/** True when multiset `candidate` is a sub-multiset of multiset `current`. */
export function isSubMultiset(candidate, current) {
  const available = new Map();
  for (const key of current) available.set(key, (available.get(key) || 0) + 1);
  for (const key of candidate) {
    const remaining = available.get(key) || 0;
    if (remaining === 0) return false;
    available.set(key, remaining - 1);
  }
  return true;
}

// ---- Registry revision windows (R2.10) ------------------------------------
// A window reserves the revisions in [fromRevision, toRevision] for one holder.
// Every transition checks before mutating: inside a held span, only the holder
// may proceed. The holder's identity is an attestation at the same trust level
// as `--by`; a window grants no state authority and never edits anything itself.
const TERMINAL_WINDOW_RELEASE_STATES = new Set(["INTEGRATED", "COMPLETE", "CLOSED", "SUPERSEDED"]);

function readWindows(doc) {
  return Array.isArray(doc.registry.windows) ? doc.registry.windows : [];
}

/** Materialize `registry.windows` only when a window is actually being declared. */
function ensureWindows(doc) {
  if (!Array.isArray(doc.registry.windows)) doc.registry.windows = [];
  return doc.registry.windows;
}

/** True when this transition is the window holder's own step. */
function isWindowHolder(window, { by, targetStreamId }) {
  if (nonEmpty(by) && by === window.holder) return true;
  if (nonEmpty(targetStreamId) && targetStreamId === window.streamId) return true;
  return false;
}

/**
 * Fail closed (zero mutation, no receipt, render byte-identical) when the
 * register revision falls inside a held span and the caller is not the holder.
 * Runs before any candidate is produced.
 */
function assertRevisionWindowFree(doc, { by, targetStreamId }) {
  for (const window of readWindows(doc)) {
    if (!(window.fromRevision <= doc.registry.revision && doc.registry.revision <= window.toRevision)) continue;
    if (isWindowHolder(window, { by, targetStreamId })) continue;
    throw new TransitionError(
      "TRANSITION_REVISION_WINDOW_HELD",
      `revision ${doc.registry.revision} is reserved by "${window.holder}" (${window.streamId}, ${window.fromRevision}..${window.toRevision}); only the holder may transition inside the span`,
      "$.registry.windows",
    );
  }
}

/**
 * Automatic release: a window disappears in the same candidate in which its
 * holder stream reaches a terminal state. The `windows` key stays lazily
 * materialized: a document that declares no window keeps no empty key. Returns
 * the number released.
 */
function releaseWindowsForTerminalHolders(doc) {
  const windows = readWindows(doc);
  const kept = windows.filter((window) => {
    const holder = doc.streams.find((stream) => stream.id === window.streamId);
    return !(holder && TERMINAL_WINDOW_RELEASE_STATES.has(holder.state));
  });
  if (kept.length !== windows.length) {
    if (kept.length === 0) delete doc.registry.windows;
    else doc.registry.windows = kept;
  }
  return windows.length - kept.length;
}

export const TRANSITIONS = {
  "record-executor-return": {
    from: ["PLANNED", "RUNNING", "CORRECTION_REQUIRED"],
    optional: ["base", "candidate", "worktree", "branch", "executor-session", "next-action", "awaited", "running"],
    required: ["candidate"],
    apply(ctx) {
      const { stream, flags, repoRoot, git } = ctx;
      const base = flags.base || stream.git.baseSha;
      if (!nonEmpty(base)) throw new TransitionError("TRANSITION_BASE_REQUIRED", "record-executor-return needs --base or an existing git.baseSha", "$.git.baseSha");
      if (!git.shaExists(repoRoot, flags.candidate)) {
        throw new TransitionError("TRANSITION_CANDIDATE_UNKNOWN", `candidate ${flags.candidate} is not a commit in this repository`, "$.git.candidateSha");
      }
      if (!git.isAncestor(repoRoot, base, flags.candidate)) {
        throw new TransitionError("TRANSITION_ANCESTRY", `base ${base} is not an ancestor of candidate ${flags.candidate}`, "$.git");
      }
      const changed = git.diffNameOnly(repoRoot, base, flags.candidate);
      if (changed === null) throw new TransitionError("TRANSITION_DIFF_FAILED", `git diff ${base}...${flags.candidate} failed`, "$.git");
      stream.git.baseSha = base;
      stream.git.candidateSha = flags.candidate;
      stream.git.changedPaths = changed;
      if (flags.worktree !== undefined) stream.git.worktree = flags.worktree;
      if (flags.branch !== undefined) stream.git.branch = flags.branch;
      stream.owners.executor = { sessionId: flags["executor-session"] || null, status: "RETURNED", writable: false };
      return { state: "REVIEW_REQUIRED", defaults: { awaited: ["fresh independent QA over the frozen candidate"], running: [] } };
    },
  },

  "record-correction": {
    from: ["REVIEW_REQUIRED", "CORRECTION_REQUIRED", "ACCEPT_READY"],
    optional: ["candidate", "reason", "base", "next-action", "awaited", "running"],
    required: ["candidate", "reason"],
    apply(ctx) {
      const { stream, flags, repoRoot, git } = ctx;
      const base = stream.git.baseSha;
      if (!nonEmpty(base)) throw new TransitionError("TRANSITION_BASE_REQUIRED", "record-correction needs an existing git.baseSha", "$.git.baseSha");
      if (!git.shaExists(repoRoot, flags.candidate)) {
        throw new TransitionError("TRANSITION_CANDIDATE_UNKNOWN", `candidate ${flags.candidate} is not a commit in this repository`, "$.git.candidateSha");
      }
      if (!git.isAncestor(repoRoot, base, flags.candidate)) {
        throw new TransitionError("TRANSITION_ANCESTRY", `base ${base} is not an ancestor of candidate ${flags.candidate}`, "$.git");
      }
      const changed = git.diffNameOnly(repoRoot, base, flags.candidate);
      if (changed === null) throw new TransitionError("TRANSITION_DIFF_FAILED", `git diff ${base}...${flags.candidate} failed`, "$.git");
      const priorRound = stream.corrections.length > 0 ? stream.corrections[stream.corrections.length - 1].round : 0;
      stream.corrections.push({
        round: priorRound + 1,
        baseSha: stream.git.candidateSha || base,
        candidateSha: flags.candidate,
        reason: flags.reason,
        qaVerdict: null,
        qaSessionId: null,
        auditorVerdict: null,
        auditorSessionId: null,
      });
      stream.git.candidateSha = flags.candidate;
      stream.git.changedPaths = changed;
      return { state: "CORRECTION_REQUIRED", defaults: { awaited: ["fresh independent QA over the corrected candidate"], running: [] } };
    },
  },

  "record-qa-result": {
    from: ["REVIEW_REQUIRED", "CORRECTION_REQUIRED"],
    optional: ["qa-verdict", "qa-session", "gates", "gates-classes", "gates-plan", "next-action", "awaited", "running"],
    required: ["qa-verdict", "qa-session", "gates", "gates-classes"],
    apply(ctx) {
      const { stream, flags } = ctx;
      const verdict = flags["qa-verdict"];
      if (!QA_VERDICTS.includes(verdict)) {
        throw new TransitionError("TRANSITION_QA_VERDICT_INVALID", `--qa-verdict must be one of ${QA_VERDICTS.join(", ")}`, "$.review.qaVerdict");
      }
      const gates = parseGates(flags.gates);
      const classes = parseGatesClasses(flags["gates-classes"]);

      // Increase-only plan. A predeclared gate count may be raised but never
      // lowered, so a gate cannot be retroactively removed from the plan.
      const plan = { ...stream.gates.plan };
      if (flags["gates-plan"] !== undefined) {
        const requested = parseGatesPlan(flags["gates-plan"]);
        for (const name of GATE_CLASSES) {
          if (requested[name] < plan[name]) {
            throw new TransitionError(
              "TRANSITION_GATE_PLAN_REGRESSION",
              `gate class ${name} plan may not decrease (${plan[name]} -> ${requested[name]})`,
              "$.gates.plan",
            );
          }
          plan[name] = requested[name];
        }
      }

      // The candidate must satisfy the plan/class rules before any write.
      const acceptanceClaim = verdict === "ACCEPT_READY" || stream.state === "ACCEPT_READY";
      for (const name of GATE_CLASSES) {
        const actual = classes[name].total;
        if (actual > plan[name]) {
          throw new TransitionError(
            "TRANSITION_GATE_PLAN_MISMATCH",
            `gate class ${name} total ${actual} exceeds its predeclared plan ${plan[name]}`,
            `$.gates.classes.${name}.total`,
          );
        }
        if (acceptanceClaim && actual !== plan[name]) {
          throw new TransitionError(
            "TRANSITION_GATE_PLAN_MISMATCH",
            `gate class ${name} total ${actual} != its predeclared plan ${plan[name]} at an acceptance claim`,
            `$.gates.classes.${name}.total`,
          );
        }
      }

      if (verdict === "ACCEPT_READY") {
        const mandatorySource = classes.MANDATORY_SOURCE;
        const mandatoryLive = classes.MANDATORY_LIVE;
        const sourceClean =
          mandatorySource.total > 0 &&
          mandatorySource.passed === mandatorySource.total &&
          mandatorySource.failed === 0 &&
          mandatorySource.blocked === 0 &&
          mandatorySource.unperformed === 0;
        const liveClean = mandatoryLive.failed === 0 && mandatoryLive.blocked === 0;
        if (!(gates.total > 0 && sourceClean && liveClean)) {
          throw new TransitionError(
            "TRANSITION_ACCEPT_READY_DIRTY_GATES",
            "ACCEPT_READY requires total>0, MANDATORY_SOURCE fully passed, and zero failed/blocked MANDATORY_LIVE gates",
            "$.gates",
          );
        }
        // A disclosed CORRECTION_REQUIRED round must have a recorded correction
        // whose candidate is the current candidate before acceptance is recorded.
        if (stream.review.qaVerdict === "CORRECTION_REQUIRED") {
          const lastCorrection = stream.corrections.length > 0 ? stream.corrections[stream.corrections.length - 1] : null;
          if (!lastCorrection || lastCorrection.candidateSha !== stream.git.candidateSha) {
            throw new TransitionError(
              "TRANSITION_CORRECTION_NOT_RECORDED",
              "recording ACCEPT_READY after CORRECTION_REQUIRED requires a recorded correction whose candidateSha equals the current git.candidateSha",
              "$.corrections",
            );
          }
        }
      }

      stream.gates = { total: gates.total, passed: gates.passed, failed: gates.failed, blocked: gates.blocked, unperformed: gates.unperformed, plan, classes };
      // Append the round before applying the verdict so the recorded history is
      // the pre-transition history plus this result.
      stream.review.qaRounds.push({ round: stream.review.qaRounds.length + 1, verdict, sessionId: flags["qa-session"] });
      stream.review.qaVerdict = verdict;
      stream.review.qaSessionId = flags["qa-session"];
      stream.owners.qa = { sessionId: flags["qa-session"], status: "RETURNED", writable: false };
      const last = stream.corrections.length > 0 ? stream.corrections[stream.corrections.length - 1] : null;
      if (last && !nonEmpty(last.qaSessionId)) {
        last.qaVerdict = verdict;
        last.qaSessionId = flags["qa-session"];
      }
      const state = verdict === "ACCEPT_READY" ? "ACCEPT_READY" : verdict === "CORRECTION_REQUIRED" ? "CORRECTION_REQUIRED" : "DECISION_REQUIRED";
      const defaults =
        state === "ACCEPT_READY"
          ? { awaited: ["planner validates the immutable range and integration boundary"], running: [] }
          : state === "CORRECTION_REQUIRED"
            ? { awaited: ["bounded additive correction commit"], running: [] }
            : { awaited: ["operator/planner decision"], running: [] };
      return { state, defaults };
    },
  },

  "record-integration": {
    from: ["ACCEPT_READY", "INTEGRATION_READY"],
    optional: ["integration", "observed-remote", "observed-ref", "worktree", "branch", "next-action", "awaited", "running"],
    required: ["integration"],
    apply(ctx) {
      const { stream, flags, repoRoot, git, nowIso } = ctx;
      if (!git.shaExists(repoRoot, flags.integration)) {
        throw new TransitionError("TRANSITION_INTEGRATION_UNKNOWN", `integration ${flags.integration} is not a commit in this repository`, "$.git.integrationSha");
      }
      // `--observed-ref` only qualifies `--observed-remote`; on its own it would
      // be silently ignored, so it fails closed instead (WF-C04 audit F1).
      if (flags["observed-ref"] !== undefined && flags["observed-remote"] === undefined) {
        throw new TransitionError(
          "TRANSITION_OBSERVED_REF_WITHOUT_REMOTE",
          "--observed-ref requires --observed-remote; a ref without an observed commit id is silently ignored otherwise",
          "$.git.remoteObservation.ref",
        );
      }
      if (nonEmpty(stream.git.candidateSha) && !git.isAncestor(repoRoot, stream.git.candidateSha, flags.integration)) {
        throw new TransitionError("TRANSITION_ANCESTRY", `candidate ${stream.git.candidateSha} is not an ancestor of integration ${flags.integration}`, "$.git");
      }

      // A stream registered by `create-stream` carries the tip that was observed
      // BEFORE it was integrated. The verifier requires integrationSha to be an
      // ancestor-or-equal of remoteObservation.sha, and `record-remote-observation`
      // is gated to INTEGRATED/COMPLETE, so without a refresh at integration every
      // created stream would be un-integrable. `--observed-remote` refreshes the
      // observation to the tip that actually contains the integration. The flag is
      // optional: a stream whose observation is null integrates exactly as before.
      let refreshedObservation = null;
      if (flags["observed-remote"] !== undefined) {
        const observedRemote = flags["observed-remote"];
        const ref = flags["observed-ref"] || OBSERVATION_REF;
        if (!SHA40_RE.test(observedRemote)) {
          throw new TransitionError(
            "TRANSITION_OBSERVED_REMOTE_INVALID",
            "--observed-remote must be a lowercase 40-hex commit id",
            "$.git.remoteObservation.sha",
          );
        }
        if (!git.shaExists(repoRoot, observedRemote)) {
          throw new TransitionError(
            "TRANSITION_OBSERVED_REMOTE_UNKNOWN",
            `observed remote ${observedRemote} is not a commit in this repository`,
            "$.git.remoteObservation.sha",
          );
        }
        // The observed tip must contain the integration. It may equal it: an
        // observation of the integration commit itself is a valid downstream-or-
        // equal snapshot, and the verifier treats equality as satisfying the
        // ancestor-or-equal rule.
        if (!git.isAncestorOrEqual(repoRoot, flags.integration, observedRemote)) {
          throw new TransitionError(
            "TRANSITION_OBSERVED_REMOTE_ANCESTRY",
            `integration ${flags.integration} is not an ancestor-or-equal of observed remote ${observedRemote}`,
            "$.git.remoteObservation.sha",
          );
        }
        refreshedObservation = {
          ref,
          sha: observedRemote,
          observedAt: nowIso,
          kind: ref.startsWith("refs/remotes/") ? "REMOTE_TRACKING_REF" : "LOCAL_REF",
        };
      }

      stream.git.integrationSha = flags.integration;
      if (refreshedObservation) stream.git.remoteObservation = refreshedObservation;
      if (flags.worktree !== undefined) stream.git.worktree = flags.worktree;
      if (flags.branch !== undefined) stream.git.branch = flags.branch;
      stream.owners.planner = { sessionId: stream.owners.planner.sessionId, status: "IDLE", writable: false };
      return {
        state: "INTEGRATED",
        defaults: { awaited: ["fresh Wave Completion Auditor"], running: [] },
        observation: refreshedObservation,
      };
    },
  },

  "record-audit": {
    from: ["INTEGRATED"],
    optional: ["auditor-verdict", "auditor-session", "next-action", "awaited", "running"],
    required: ["auditor-verdict"],
    apply(ctx) {
      const { stream, flags } = ctx;
      const verdict = flags["auditor-verdict"];
      if (!AUDITOR_VERDICTS.includes(verdict)) {
        throw new TransitionError("TRANSITION_AUDITOR_VERDICT_INVALID", `--auditor-verdict must be one of ${AUDITOR_VERDICTS.join(", ")}`, "$.review.auditorVerdict");
      }
      if (verdict === "AUDIT_CLEAR" && !nonEmpty(flags["auditor-session"])) {
        throw new TransitionError("TRANSITION_AUDITOR_SESSION_REQUIRED", "AUDIT_CLEAR requires a non-empty --auditor-session", "$.review.auditorSessionId");
      }
      stream.review.auditorVerdict = verdict;
      stream.review.auditorSessionId = flags["auditor-session"] || null;
      stream.owners.auditor = { sessionId: flags["auditor-session"] || null, status: "RETURNED", writable: false };
      const last = stream.corrections.length > 0 ? stream.corrections[stream.corrections.length - 1] : null;
      if (last && !nonEmpty(last.auditorSessionId)) {
        last.auditorVerdict = verdict;
        last.auditorSessionId = flags["auditor-session"] || null;
      }
      const defaults =
        verdict === "AUDIT_CLEAR"
          ? { awaited: ["close the cycle and pin the closure receipt"], running: [] }
          : { awaited: ["bounded correction commit"], running: [] };
      return { state: "INTEGRATED", defaults };
    },
  },

  "close-cycle": {
    from: ["INTEGRATED"],
    optional: ["receipt", "next-action", "awaited", "running"],
    required: ["receipt"],
    apply(ctx) {
      const { stream, flags } = ctx;
      if (stream.review.qaVerdict !== "ACCEPT_READY") {
        throw new TransitionError("TRANSITION_QA_REQUIRED", "close-cycle requires review.qaVerdict ACCEPT_READY", "$.review.qaVerdict");
      }
      if (stream.review.auditRequired && !(stream.review.auditorVerdict === "AUDIT_CLEAR" && nonEmpty(stream.review.auditorSessionId))) {
        throw new TransitionError("TRANSITION_AUDIT_REQUIRED", "close-cycle requires auditorVerdict AUDIT_CLEAR and a non-empty auditorSessionId", "$.review");
      }
      stream.closure = { receipt: { path: "", sha256: "0".repeat(64) } };
      return { state: "COMPLETE", mintReceiptPath: flags.receipt, defaults: { awaited: [], running: [] } };
    },
  },

  "record-remote-observation": {
    from: ["INTEGRATED", "COMPLETE"],
    optional: ["ref", "observed-sha", "ref-kind", "next-action", "awaited", "running"],
    required: ["ref", "observed-sha"],
    apply(ctx) {
      const { stream, flags, repoRoot, git } = ctx;
      if (!git.shaExists(repoRoot, flags["observed-sha"])) {
        throw new TransitionError("TRANSITION_OBSERVED_SHA_UNKNOWN", `observed sha ${flags["observed-sha"]} is not a commit in this repository`, "$.git.remoteObservation.sha");
      }
      if (nonEmpty(stream.git.integrationSha) && !git.isAncestorOrEqual(repoRoot, stream.git.integrationSha, flags["observed-sha"])) {
        throw new TransitionError("TRANSITION_OBSERVATION_ANCESTRY", `integration ${stream.git.integrationSha} is not an ancestor-or-equal of observed sha ${flags["observed-sha"]}`, "$.git.remoteObservation.sha");
      }
      const kind = flags["ref-kind"] || (flags.ref.startsWith("refs/remotes/") ? "REMOTE_TRACKING_REF" : "LOCAL_REF");
      if (!["LOCAL_REF", "REMOTE_TRACKING_REF"].includes(kind)) {
        throw new TransitionError("TRANSITION_REF_KIND_INVALID", "--ref-kind must be LOCAL_REF or REMOTE_TRACKING_REF", "$.git.remoteObservation.kind");
      }
      stream.git.remoteObservation = {
        ref: flags.ref,
        sha: flags["observed-sha"],
        observedAt: ctx.nowIso,
        kind,
      };
      return { state: undefined, defaults: null };
    },
  },

  // Atomic residue reconciliation with NO state change. Every state whose
  // residue is not itself a claim of live work is reconcilable; RUNNING is
  // excluded because its residue IS the live-work claim (§3.1).
  "reconcile-stream": {
    from: RECONCILE_FROM_STATES,
    optional: [
      "awaited",
      "running",
      "next-action",
      "blocker-kind",
      "blocker-detail",
      "blocker-safe-work-remaining",
      "blocker-safe-work-items",
    ],
    required: [],
    apply(ctx) {
      const { stream, flags } = ctx;
      const applicable = [
        "awaited",
        "running",
        "next-action",
        "blocker-kind",
        "blocker-detail",
        "blocker-safe-work-remaining",
        "blocker-safe-work-items",
      ].filter((name) => flags[name] !== undefined);
      if (applicable.length === 0) {
        throw new TransitionError(
          "TRANSITION_RECONCILE_NO_CHANGES",
          "reconcile-stream requires at least one of --awaited, --running, --next-action, --blocker-kind, --blocker-detail, --blocker-safe-work-remaining, --blocker-safe-work-items",
          "$.flags",
        );
      }

      if (flags["blocker-kind"] !== undefined) {
        if (!BLOCKER_KINDS.includes(flags["blocker-kind"])) {
          throw new TransitionError(
            "TRANSITION_BLOCKER_KIND_INVALID",
            `--blocker-kind must be one of ${BLOCKER_KINDS.join(", ")}, got "${flags["blocker-kind"]}"`,
            "$.blocker.kind",
          );
        }
        stream.blocker.kind = flags["blocker-kind"];
      }
      if (flags["blocker-detail"] !== undefined) stream.blocker.detail = flags["blocker-detail"];
      if (flags["blocker-safe-work-items"] !== undefined) {
        stream.blocker.safeWorkItems = parseStringArrayFlag(
          "blocker-safe-work-items",
          flags["blocker-safe-work-items"],
          "TRANSITION_BLOCKER_ITEMS_INVALID",
          "$.blocker.safeWorkItems",
        );
      }
      // Strict boolean: only the exact strings "true"/"false" are accepted, so
      // `1`, `0`, `yes` and an empty value cannot be read as a boolean.
      if (flags["blocker-safe-work-remaining"] !== undefined) {
        const raw = flags["blocker-safe-work-remaining"];
        if (raw !== "true" && raw !== "false") {
          throw new TransitionError(
            "TRANSITION_BLOCKER_FLAG_INVALID",
            `--blocker-safe-work-remaining must be exactly "true" or "false", got "${raw}"`,
            "$.blocker.safeWorkRemaining",
          );
        }
        stream.blocker.safeWorkRemaining = raw === "true";
      }
      // Blocker fields apply individually; an unset field keeps its prior value.
      // Enforcing the invariant here makes the transition trip-proof for the
      // verifier's BLOCKER_INCONSISTENT instead of relying on it.
      if (stream.blocker.safeWorkRemaining !== stream.blocker.safeWorkItems.length > 0) {
        throw new TransitionError(
          "TRANSITION_BLOCKER_INCONSISTENT",
          "blocker.safeWorkRemaining must equal (blocker.safeWorkItems.length > 0) after reconciling",
          "$.blocker",
        );
      }
      return { state: undefined, defaults: null };
    },
  },

  // The documented terminal exit for DECISION_REQUIRED: records who resolved
  // the decision and what the resolution was, and clears the live-work residue.
  "resolve-decision": {
    from: ["DECISION_REQUIRED"],
    optional: ["superseded-by", "next-action", "disposition", "resolver", "resolution"],
    required: ["disposition", "resolver", "resolution", "next-action"],
    apply(ctx) {
      const { doc, stream, flags, nowIso } = ctx;
      const disposition = flags.disposition;
      if (!RESOLUTION_DISPOSITIONS.includes(disposition)) {
        throw new TransitionError(
          "TRANSITION_DISPOSITION_INVALID",
          `--disposition must be one of ${RESOLUTION_DISPOSITIONS.join(", ")}, got "${disposition}"`,
          "$.resolution.disposition",
        );
      }
      const hasSupersededBy = flags["superseded-by"] !== undefined;
      if (disposition === "SUPERSEDED" && !nonEmpty(flags["superseded-by"])) {
        throw new TransitionError(
          "TRANSITION_SUPERSEDED_BY_REQUIRED",
          "--disposition SUPERSEDED requires --superseded-by <stream-id>: a superseded decision must name its replacement",
          "$.resolution.supersededBy",
        );
      }
      if (disposition === "CLOSED" && hasSupersededBy) {
        throw new TransitionError(
          "TRANSITION_SUPERSEDED_BY_NOT_APPLICABLE",
          "--superseded-by is not applicable to --disposition CLOSED",
          "$.resolution.supersededBy",
        );
      }
      const supersededBy = nonEmpty(flags["superseded-by"]) ? flags["superseded-by"] : null;
      if (supersededBy !== null) {
        const replacement = doc.streams.find((candidate) => candidate.id === supersededBy);
        if (!replacement) {
          throw new TransitionError(
            "TRANSITION_SUPERSEDED_BY_UNKNOWN",
            `--superseded-by "${supersededBy}" is not a defined stream`,
            "$.resolution.supersededBy",
          );
        }
        if (replacement.id === stream.id) {
          throw new TransitionError(
            "TRANSITION_SUPERSEDED_BY_SELF",
            "--superseded-by may not name the stream being resolved",
            "$.resolution.supersededBy",
          );
        }
        if (replacement.state === "SUPERSEDED" || replacement.state === "CLOSED") {
          throw new TransitionError(
            "TRANSITION_SUPERSEDED_BY_DEAD",
            `--superseded-by "${supersededBy}" is ${replacement.state}; the replacement must not itself be resolved-away`,
            "$.resolution.supersededBy",
          );
        }
      }
      stream.resolution = {
        disposition,
        resolver: flags.resolver,
        text: flags.resolution,
        resolvedAt: nowIso,
        supersededBy,
      };
      stream.running = [];
      stream.awaited = [];
      return { state: disposition, defaults: null };
    },
  },

  // The proof-gated exit from RUNNING (and a PLANNED re-abandon). It refuses
  // while an ACTIVE lease or a fresh heartbeat still attests live work, so an
  // unjustified RUNNING declaration can only be removed with evidence that the
  // work is gone. The engine-level repair-read (R2.5) is what lets it read a
  // document that still carries the liveness defect, and the monotonicity gate
  // is what stops it from leaving an equal or larger defect behind.
  "abandon-stream": {
    from: ["RUNNING", "PLANNED"],
    optional: ["awaited", "reason", "next-action"],
    required: ["reason", "next-action"],
    apply(ctx) {
      const { stream, flags, heartbeats, unreadableHeartbeats, nowMs, activeWindowMs } = ctx;
      const activeLease = (Array.isArray(ctx.doc.leases) ? ctx.doc.leases : []).find(
        (lease) => lease.streamId === stream.id && lease.state === "ACTIVE",
      );
      if (activeLease) {
        throw new TransitionError(
          "TRANSITION_ABANDON_ACTIVE_LEASE",
          `lease ${activeLease.id} is ACTIVE for ${stream.id}; a lease may only be returned after the stream has left RUNNING`,
          "$.leases",
        );
      }
      const naming = heartbeats.filter((record) => record && record.stream === stream.id);
      const ages = naming.map((record) => ageMs(record, nowMs)).filter((age) => age !== null);
      const freshestAgeMs = ages.length > 0 ? Math.min(...ages) : null;
      if (freshestAgeMs !== null && freshestAgeMs <= activeWindowMs) {
        throw new TransitionError(
          "TRANSITION_ABANDON_FRESH_HEARTBEAT",
          `a heartbeat naming ${stream.id} is ${freshestAgeMs}ms old, inside the ${activeWindowMs}ms active window; the stream is not abandoned`,
          "$.blocker",
        );
      }
      stream.running = [];
      // An unreadable heartbeat file is not "a heartbeat newer than the window",
      // so it does not block by itself; it is disclosed below and in the README.
      return {
        state: "PLANNED",
        defaults: { awaited: [] },
        heartbeatEvidence: {
          recordsNamingStream: naming.length,
          freshestAgeMs,
          activeWindowMs,
          unreadableFiles: unreadableHeartbeats,
        },
      };
    },
  },

  // Refreshes exactly one stale artifact attestation on a settled stream. It
  // exists because a sanctioned schema/source edit invalidates an existing pin
  // and no other transition could repair an attestation. It may refresh an
  // existing entry only: it can neither add nor remove a pin, and the caller
  // must present the bytes whose hash it claims.
  "refresh-artifact-pin": {
    from: ["COMPLETE", "INTEGRATED", "CLOSED"],
    fromErrorCode: "TRANSITION_ARTIFACT_STATE_FORBIDDEN",
    optional: ["artifact-path", "artifact-sha256", "reason"],
    required: ["artifact-path", "artifact-sha256", "reason"],
    apply(ctx) {
      const { stream, flags, repoRoot, statePath } = ctx;
      if (!["COMPLETE", "INTEGRATED", "CLOSED"].includes(stream.state)) {
        throw new TransitionError(
          "TRANSITION_ARTIFACT_STATE_FORBIDDEN",
          `refresh-artifact-pin requires a settled stream (COMPLETE, INTEGRATED, CLOSED); ${stream.id} is ${stream.state}`,
          "$.state",
        );
      }
      const artifactPath = flags["artifact-path"];
      if (!/^[0-9a-f]{64}$/.test(flags["artifact-sha256"])) {
        throw new TransitionError(
          "TRANSITION_ARTIFACT_SHA_INVALID",
          "--artifact-sha256 must be a lowercase 64-hex digest",
          "$.artifacts",
        );
      }
      const index = stream.artifacts.findIndex((artifact) => artifact.path === artifactPath);
      if (index === -1) {
        throw new TransitionError(
          "TRANSITION_ARTIFACT_NOT_PINNED",
          `stream ${stream.id} carries no artifacts[] entry for "${artifactPath}"; a pin may be refreshed, never created`,
          "$.artifacts",
        );
      }
      // The file is resolved against the repository root exactly as artifact
      // verification resolves it, and the claimed digest must equal the current
      // working-tree bytes: a caller cannot invent a hash or pin bytes absent.
      const base = repoRoot || path.dirname(statePath);
      const filePath = path.resolve(base, artifactPath.split("/").join(path.sep));
      let bytes;
      try {
        bytes = fs.readFileSync(filePath);
      } catch (err) {
        throw new TransitionError(
          "TRANSITION_ARTIFACT_HASH_MISMATCH",
          `artifact ${artifactPath} could not be read: ${err.message}`,
          "$.artifacts",
        );
      }
      const actual = sha256Hex(bytes);
      if (actual !== flags["artifact-sha256"]) {
        throw new TransitionError(
          "TRANSITION_ARTIFACT_HASH_MISMATCH",
          `artifact ${artifactPath} sha256 ${actual} != --artifact-sha256 ${flags["artifact-sha256"]}`,
          "$.artifacts",
        );
      }
      // Exactly one digest changes; the path, the array length, and every other
      // field are untouched.
      stream.artifacts[index].sha256 = flags["artifact-sha256"];
      return { state: undefined, defaults: null, artifactRefresh: { path: artifactPath, sha256: actual } };
    },
  },

  // Atomic registration of one new stream. `--observed-origin-main` is the only
  // source of the machine-state evidence the created record carries, so an
  // author cannot assert a remote tip it did not observe. The transition adds
  // exactly one record; no other stream is touched.
  "create-stream": {
    scope: "create",
    optional: ["stream-spec", "observed-origin-main", "lease-id", "lease-role", "lease-session", "lease-expires", "lease-worktree", "register-window-to", "register-window-holder"],
    required: ["stream-spec", "observed-origin-main"],
    apply(ctx) {
      const { doc, flags, repoRoot, git, nowIso } = ctx;
      if (flags.stream !== undefined) {
        throw new TransitionError(
          "TRANSITION_FLAG_NOT_APPLICABLE",
          "flag --stream is not applicable to create-stream; the id comes from --stream-spec",
          "$.flags.stream",
        );
      }
      const { stream } = loadStreamSpec(flags["stream-spec"]);
      validateStreamSpec(stream);

      if (doc.streams.some((s) => s.id === stream.id)) {
        throw new TransitionError(
          "CREATE_SPEC_DUPLICATE_ID",
          `stream "${stream.id}" is already defined in the state document`,
          "$.stream.id",
        );
      }

      const observed = flags["observed-origin-main"];
      if (!SHA40_RE.test(observed)) {
        throw new TransitionError(
          "CREATE_SPEC_OBSERVED_SHA_INVALID",
          "--observed-origin-main must be a lowercase 40-hex commit id",
          "$.stream.git.remoteObservation.sha",
        );
      }
      if (!git.shaExists(repoRoot, observed)) {
        throw new TransitionError(
          "CREATE_SPEC_OBSERVED_SHA_UNKNOWN",
          `observed origin/main ${observed} is not a commit in this repository`,
          "$.stream.git.remoteObservation.sha",
        );
      }
      if (stream.git.remoteObservation !== null) {
        throw new TransitionError(
          "CREATE_SPEC_REMOTE_OBSERVATION_CONTRADICTORY",
          "a stream spec must not carry git.remoteObservation; --observed-origin-main is the only source",
          "$.stream.git.remoteObservation",
        );
      }

      assertClaimEvidenceConsistency(stream);

      // Optional atomic lease creation. A RUNNING declaration needs machine
      // evidence; creating the record and its ACTIVE lease in one transition is
      // the only way to satisfy the verifier's live-evidence rule through the
      // registration path. Supplying lease flags for a non-RUNNING record fails
      // early with its own typed code rather than relying on the verifier's
      // PLANNED_WITH_LIVE_LEASE.
      const leaseFlagNames = ["lease-id", "lease-role", "lease-session", "lease-expires", "lease-worktree"];
      const anyLeaseFlag = leaseFlagNames.some((name) => flags[name] !== undefined);
      let boundLease = null;
      if (anyLeaseFlag) {
        if (!nonEmpty(flags["lease-id"])) {
          throw new TransitionError(
            "TRANSITION_LEASE_ID_REQUIRED",
            "--lease-role/--lease-session/--lease-expires/--lease-worktree require --lease-id",
            "$.leases",
          );
        }
        if (!nonEmpty(flags["lease-role"])) {
          throw new TransitionError("TRANSITION_LEASE_ROLE_REQUIRED", "--lease-id requires --lease-role", "$.leases");
        }
        if (!LEASE_ROLES.includes(flags["lease-role"])) {
          throw new TransitionError(
            "TRANSITION_LEASE_ROLE_INVALID",
            `--lease-role must be planner, executor, qa, or auditor, got "${flags["lease-role"]}"`,
            "$.leases",
          );
        }
        if (stream.state !== "RUNNING") {
          throw new TransitionError(
            "TRANSITION_CREATE_LEASE_STATE_INVALID",
            `an atomic lease may only accompany a RUNNING record; "${stream.id}" is ${stream.state}`,
            "$.leases",
          );
        }
        if (doc.leases.some((lease) => lease.id === flags["lease-id"])) {
          throw new TransitionError("TRANSITION_LEASE_DUPLICATE_ID", `lease "${flags["lease-id"]}" is already defined`, "$.leases");
        }
        boundLease = {
          id: flags["lease-id"],
          streamId: stream.id,
          worktree: nonEmpty(flags["lease-worktree"]) ? flags["lease-worktree"] : stream.git.worktree || null,
          role: flags["lease-role"],
          sessionId: nonEmpty(flags["lease-session"]) ? flags["lease-session"] : null,
          state: "ACTIVE",
          revision: 1,
          updatedAt: nowIso,
          expiresAt: nonEmpty(flags["lease-expires"]) ? flags["lease-expires"] : null,
        };
      }

      const created = cloneDoc(stream);
      created.git.remoteObservation = { ref: OBSERVATION_REF, sha: observed, observedAt: nowIso, kind: OBSERVATION_KIND };
      // The tool owns the transition timestamp so a spec cannot backdate state.
      created.stateUpdatedAt = nowIso;
      doc.streams.push(created);
      if (boundLease) doc.leases.push(boundLease);

      // Optional register revision-window reservation awarded to the new stream.
      // `fromRevision` is the register revision at declaration, so the span is
      // anchored to the record the spec actually observed.
      let declaredWindow = null;
      if (flags["register-window-holder"] !== undefined && flags["register-window-to"] === undefined) {
        throw new TransitionError(
          "TRANSITION_WINDOW_FLAG_REQUIRED",
          "--register-window-holder requires --register-window-to",
          "$.registry.windows",
        );
      }
      if (flags["register-window-to"] !== undefined) {
        const toRevision = Number(flags["register-window-to"]);
        if (!Number.isInteger(toRevision) || toRevision < 1) {
          throw new TransitionError(
            "TRANSITION_WINDOW_INVALID",
            `--register-window-to must be a positive integer, got "${flags["register-window-to"]}"`,
            "$.registry.windows",
          );
        }
        const fromRevision = doc.registry.revision;
        if (toRevision < fromRevision) {
          throw new TransitionError(
            "TRANSITION_WINDOW_INVALID",
            `--register-window-to ${toRevision} is below the declaration revision ${fromRevision}`,
            "$.registry.windows",
          );
        }
        const holder = nonEmpty(flags["register-window-holder"]) ? flags["register-window-holder"] : created.id;
        declaredWindow = { streamId: created.id, fromRevision, toRevision, holder, declaredAt: nowIso };
        ensureWindows(doc).push(declaredWindow);
      }
      return { createdStreamId: created.id, boundLease, declaredWindow };
    },
  },

  "coordination-update": {
    scope: "document",
    from: null,
    optional: ["mode", "active-cycle-id", "global-next-action"],
    required: ["mode"],
    apply(ctx) {
      const { doc, flags } = ctx;
      const mode = flags.mode;
      if (!["MANUAL", "CYCLE_ACTIVE"].includes(mode)) {
        throw new TransitionError("TRANSITION_MODE_INVALID", `--mode must be MANUAL or CYCLE_ACTIVE, got "${mode}"`, "$.mode");
      }
      const normalize = (value) => (value === undefined || value === "" || value === "null" ? null : value);
      const requestedCycleId = normalize(flags["active-cycle-id"]);
      const globalNextAction =
        flags["global-next-action"] === undefined ? doc.coordination.globalNextAction : normalize(flags["global-next-action"]);

      if (mode === "MANUAL") {
        // MANUAL forces a null active cycle; an explicitly non-null id is a
        // caller error rather than a silent overwrite.
        if (requestedCycleId !== null) {
          throw new TransitionError(
            "TRANSITION_COORDINATION_INVALID",
            "MANUAL coordination requires --active-cycle-id null",
            "$.coordination.activeCycleId",
          );
        }
        doc.coordination = { mode: "MANUAL", activeCycleId: null, globalNextAction };
        return { state: undefined, defaults: null };
      }

      if (requestedCycleId === null) {
        throw new TransitionError(
          "TRANSITION_COORDINATION_INVALID",
          "CYCLE_ACTIVE requires --active-cycle-id <stream-id>",
          "$.coordination.activeCycleId",
        );
      }
      const activeCycleId = requestedCycleId;
      const target = doc.streams.find((s) => s.id === activeCycleId);
      if (!target) {
        throw new TransitionError(
          "TRANSITION_COORDINATION_UNKNOWN_CYCLE",
          `active cycle "${activeCycleId}" is not a defined stream`,
          "$.coordination.activeCycleId",
        );
      }
      if (TERMINAL_STATES.has(target.state)) {
        throw new TransitionError(
          "TRANSITION_COORDINATION_TERMINAL",
          `active cycle "${activeCycleId}" is terminal (${target.state})`,
          "$.coordination.activeCycleId",
        );
      }
      if (!nonEmpty(globalNextAction)) {
        throw new TransitionError(
          "TRANSITION_COORDINATION_NEXT_ACTION_REQUIRED",
          "CYCLE_ACTIVE requires a non-empty --global-next-action",
          "$.coordination.globalNextAction",
        );
      }
      doc.coordination = { mode: "CYCLE_ACTIVE", activeCycleId, globalNextAction };
      return { state: undefined, defaults: null };
    },
  },

  "lease-update": {
    from: null,
    // When a window operation is requested it names its own target stream, so the
    // selector falls back to it; a caller never has to repeat `--stream`.
    streamSelectorFlags: ["window-declare", "release-window"],
    optional: [
      "lease-id",
      "lease-state",
      "lease-role",
      "lease-session",
      "lease-worktree",
      "lease-expires",
      "next-action",
      "awaited",
      "running",
      "window-declare",
      "window-from",
      "window-to",
      "window-holder",
      "release-window",
    ],
    required: [],
    apply(ctx) {
      const { doc, stream, flags, nowIso } = ctx;
      const hasDeclare = flags["window-declare"] !== undefined;
      const hasRelease = flags["release-window"] !== undefined;
      const leaseFlagNames = ["lease-id", "lease-state", "lease-role", "lease-session", "lease-worktree", "lease-expires"];
      const anyLeaseFlag = leaseFlagNames.some((name) => flags[name] !== undefined);
      if (hasDeclare && hasRelease) {
        throw new TransitionError(
          "TRANSITION_WINDOW_FLAGS_CONFLICT",
          "--window-declare and --release-window are mutually exclusive",
          "$.registry.windows",
        );
      }
      if (!hasDeclare && !hasRelease && !anyLeaseFlag) {
        throw new TransitionError(
          "TRANSITION_LEASE_UPDATE_NO_CHANGES",
          "lease-update requires a lease operation or a window operation",
          "$.flags",
        );
      }

      let windowOutcome = null;
      if (hasRelease) {
        const windows = readWindows(doc);
        const index = windows.findIndex((window) => window.streamId === flags["release-window"]);
        if (index === -1) {
          throw new TransitionError(
            "TRANSITION_WINDOW_UNKNOWN",
            `--release-window names no declared window for stream "${flags["release-window"]}"`,
            "$.registry.windows",
          );
        }
        const window = windows[index];
        // Explicit release is always available and is the documented remedy for a
        // stuck holder. The engine-level window check has already established
        // that this is the holder's own step: `--release-window <streamId>` names
        // the window's own stream, so the target-stream branch of the holder
        // predicate is satisfied. A window is an attestation at `--by`'s trust
        // level, never an authority of its own.
        windows.splice(index, 1);
        windowOutcome = { released: window.streamId, holder: window.holder };
      } else if (hasDeclare) {
        const streamId = flags["window-declare"];
        const target = doc.streams.find((candidate) => candidate.id === streamId);
        if (!target) {
          throw new TransitionError(
            "TRANSITION_WINDOW_UNKNOWN_STREAM",
            `--window-declare names undefined stream "${streamId}"`,
            "$.registry.windows",
          );
        }
        if (readWindows(doc).some((window) => window.streamId === streamId)) {
          throw new TransitionError(
            "TRANSITION_WINDOW_DUPLICATE",
            `stream "${streamId}" already holds a declared revision window`,
            "$.registry.windows",
          );
        }
        const toRevision = Number(flags["window-to"]);
        if (!Number.isInteger(toRevision) || toRevision < 1) {
          throw new TransitionError(
            "TRANSITION_WINDOW_INVALID",
            `--window-to must be a positive integer, got "${flags["window-to"]}"`,
            "$.registry.windows",
          );
        }
        const fromRevision = flags["window-from"] !== undefined ? Number(flags["window-from"]) : doc.registry.revision;
        if (!Number.isInteger(fromRevision) || fromRevision < 1) {
          throw new TransitionError(
            "TRANSITION_WINDOW_INVALID",
            `--window-from must be a positive integer, got "${flags["window-from"]}"`,
            "$.registry.windows",
          );
        }
        if (toRevision < fromRevision) {
          throw new TransitionError(
            "TRANSITION_WINDOW_INVALID",
            `--window-to ${toRevision} is below --window-from ${fromRevision}`,
            "$.registry.windows",
          );
        }
        const holder = nonEmpty(flags["window-holder"]) ? flags["window-holder"] : streamId;
        const declared = { streamId, fromRevision, toRevision, holder, declaredAt: nowIso };
        ensureWindows(doc).push(declared);
        windowOutcome = { declared };
      }

      if (!anyLeaseFlag) return { state: undefined, defaults: null, window: windowOutcome };

      const state = flags["lease-state"];
      if (!LEASE_STATES.includes(state)) {
        throw new TransitionError("TRANSITION_LEASE_STATE_INVALID", `--lease-state must be one of ${LEASE_STATES.join(", ")}`, "$.leases");
      }
      const role = flags["lease-role"];
      if (!["planner", "executor", "qa", "auditor"].includes(role)) {
        throw new TransitionError("TRANSITION_LEASE_ROLE_INVALID", "--lease-role must be planner, executor, qa, or auditor", "$.leases");
      }
      if (!nonEmpty(flags["lease-id"])) {
        throw new TransitionError("TRANSITION_FLAG_REQUIRED", "lease-update lease operations require --lease-id", "$.flags.lease-id");
      }
      const id = flags["lease-id"];
      let lease = doc.leases.find((l) => l.id === id);
      if (!lease) {
        lease = {
          id,
          streamId: stream.id,
          worktree: flags["lease-worktree"] || stream.git.worktree || null,
          role,
          sessionId: flags["lease-session"] !== undefined ? flags["lease-session"] : null,
          state,
          revision: 1,
          updatedAt: nowIso,
          expiresAt: flags["lease-expires"] || null,
        };
        doc.leases.push(lease);
        return { state: undefined, defaults: null, window: windowOutcome };
      }
      if (lease.streamId !== stream.id) {
        throw new TransitionError("TRANSITION_LEASE_STREAM_MISMATCH", `lease ${id} belongs to stream ${lease.streamId}, not ${stream.id}`, "$.leases");
      }
      lease.role = role;
      lease.state = state;
      lease.sessionId = flags["lease-session"] !== undefined ? flags["lease-session"] : lease.sessionId;
      lease.worktree = flags["lease-worktree"] !== undefined ? flags["lease-worktree"] : lease.worktree;
      lease.expiresAt = flags["lease-expires"] !== undefined ? flags["lease-expires"] : lease.expiresAt;
      lease.revision += 1;
      lease.updatedAt = nowIso;
      return { state: undefined, defaults: null, window: windowOutcome };
    },
  },
};

export function listTransitions() {
  return Object.keys(TRANSITIONS).sort();
}

/**
 * The stream a transition targets: an explicit `--stream`, else the first
 * declared selector flag a spec names (a window operation names its own stream).
 * A spec that declares no selector flags behaves exactly as before.
 */
function resolveTargetStreamId(spec, flags) {
  if (nonEmpty(flags.stream)) return flags.stream;
  for (const name of spec.streamSelectorFlags || []) {
    if (nonEmpty(flags[name])) return flags[name];
  }
  return flags.stream;
}

function report(status, summary, errors, artifacts = [], nextActions = []) {
  return { status, summary, nextActions, artifacts, errors };
}

function failReport(code, message, errPath = "$", summary = {}) {
  return report("fail", summary, [{ code, message, path: errPath }]);
}

/**
 * Execute one named transition. Never throws for expected failures; returns a
 * single deterministic JSON-shaped report. Mutation is all-or-nothing: state,
 * rendered register, and receipt are staged first and only published after the
 * candidate has passed full verification.
 */
export function runTransition({ statePath, transitionName, flags = {}, now = null, gitMemo = null }) {
  const stateAbs = path.resolve(statePath);
  const stateDir = path.dirname(stateAbs);
  const nowIso = now || new Date().toISOString();
  const spec = TRANSITIONS[transitionName];
  const baseSummary = { transition: transitionName, statePath: stateAbs };

  if (!spec) {
    return failReport("TRANSITION_UNKNOWN", `unknown transition "${transitionName}" (known: ${listTransitions().join(", ")})`, "$.transition", baseSummary);
  }
  for (const name of spec.required || []) {
    if (!nonEmpty(flags[name])) {
      return failReport("TRANSITION_FLAG_REQUIRED", `transition ${transitionName} requires --${name}`, `$.flags.${name}`, baseSummary);
    }
  }
  // `now` and `active-window-ms` are base flags: they configure the clock and
  // the liveness window of this invocation and are read by the engine and BOTH
  // verifications, so they are never "not applicable" to a transition.
  for (const name of Object.keys(flags)) {
    if (["expect-revision", "state", "transition", "render", "by", "stream", "now", "active-window-ms"].includes(name)) continue;
    if (!(spec.optional || []).includes(name)) {
      return failReport("TRANSITION_FLAG_NOT_APPLICABLE", `flag --${name} is not applicable to transition ${transitionName}`, `$.flags.${name}`, baseSummary);
    }
  }
  if (!nonEmpty(flags["expect-revision"]) || !/^\d+$/.test(flags["expect-revision"])) {
    return failReport("TRANSITION_EXPECT_REVISION_INVALID", "an integer --expect-revision is required for the CAS check", "$.expect-revision", baseSummary);
  }
  const expectRevision = Number(flags["expect-revision"]);
  // A malformed window is a hard failure, never a silent fallback to the
  // configured default (that would make the liveness verdict unreproducible).
  const activeWindowMs = flags["active-window-ms"] === undefined ? DEFAULT_ACTIVE_WINDOW_MS : Number(flags["active-window-ms"]);
  if (!Number.isInteger(activeWindowMs) || activeWindowMs <= 0) {
    return failReport(
      "TRANSITION_ACTIVE_WINDOW_INVALID",
      `--active-window-ms must be a positive integer, got "${flags["active-window-ms"]}"`,
      "$.active-window-ms",
      baseSummary,
    );
  }
  const nowMs = normalizeNowMs(now);
  if (nowMs === null) {
    return failReport("TRANSITION_NOW_INVALID", `--now must be an ISO-8601 timestamp, got "${now}"`, "$.now", baseSummary);
  }
  const streamId = resolveTargetStreamId(spec, flags);
  const repoRoot = resolveRepoRoot(stateDir);

  const lock = acquireLock({ repoRoot, transition: transitionName, streamId, statePath: stateAbs });
  if (!lock.ok) {
    return report("fail", { ...baseSummary, lockPath: lock.lockPath, owner: lock.owner || null }, [{ code: lock.code, message: lock.message, path: "$.lock" }]);
  }

  let staged = [];
  try {
    // Test-only hook: hold the lock briefly so a concurrent writer is forced to
    // contend deterministically. Never set in production.
    const holdMs = Number(process.env.ATLAS_WORKFLOW_LOCK_HOLD_MS || 0);
    if (Number.isFinite(holdMs) && holdMs > 0) {
      const shared = new Int32Array(new SharedArrayBuffer(4));
      Atomics.wait(shared, 0, 0, holdMs);
    }
    const fault = process.env.ATLAS_WORKFLOW_FAULT || "";
    if (fault === "AFTER_LOCK") throw new TransitionError("FAULT_INJECTED", "injected fault AFTER_LOCK", "$.fault");

    let currentBytes;
    try {
      currentBytes = fs.readFileSync(stateAbs);
    } catch (err) {
      throw new TransitionError("STATE_UNREADABLE", `cannot read state file: ${err.message}`, stateAbs);
    }
    // Share Git fact resolution between the current and candidate validations.
    const git = gitMemo || createGitMemo();
    // One heartbeat read per transition, from the state document's own Git
    // common directory. The store is disclosed for `abandon-stream` and passed
    // to both verifications so the current and candidate liveness verdicts are
    // computed from identical evidence.
    const store = resolveHeartbeats({}, repoRoot);
    const heartbeats = store.heartbeats;
    const unreadableHeartbeats = store.unreadableCount;
    const verifyOptions = { gitMemo: git, heartbeats, now: nowMs, activeWindowMs };

    const current = verifyStateDocument(stateAbs, verifyOptions);
    // The sanctioned repair-read (R2.5). One engine-level rule, one closed set:
    // the current document may be read when EVERY error it reports is in the
    // repairable set, and the candidate may then carry only a sub-multiset of
    // those repairable errors. No transition name, no CLI flag, and no per-class
    // toggle participates. Any non-repairable current error still fails closed.
    if (!current.ok) {
      const others = current.errors.filter((error) => !REPAIRABLE_ERROR_CODES.has(error.code));
      if (others.length > 0 || !current.doc) {
        const first = others[0] || current.errors[0] || { code: "STATE_INVALID", message: "state failed verification", path: "$" };
        throw new TransitionError("TRANSITION_STATE_INVALID", `current state is not verifier-clean: ${first.code}: ${first.message}`, first.path);
      }
    }
    const currentRepairable = current.ok ? [] : repairableErrorTuples(current.errors);
    const doc = current.doc;
    if (doc.registry.revision !== expectRevision) {
      throw new TransitionError(
        "TRANSITION_STALE_REVISION",
        `expected revision ${expectRevision} but the state document is at revision ${doc.registry.revision}`,
        "$.registry.revision",
      );
    }

    // Stream selection: explicit --stream, else unique stream in an eligible
    // state. Document-scoped transitions mutate top-level coordination and take
    // no stream target; `create-stream` appends a new record and selects nothing.
    const documentScoped = spec.scope === "document";
    const createsStream = spec.scope === "create";
    let stream = null;
    if (!documentScoped && !createsStream) {
      if (nonEmpty(streamId)) {
        stream = doc.streams.find((s) => s.id === streamId);
        if (!stream) throw new TransitionError("TRANSITION_STREAM_UNKNOWN", `stream ${streamId} is not defined in the state document`, "$.stream");
      } else {
        const eligible = doc.streams.filter((s) => !spec.from || spec.from.includes(s.state));
        if (eligible.length === 0) throw new TransitionError("TRANSITION_STREAM_UNKNOWN", `no stream is in an eligible state for ${transitionName}`, "$.stream");
        if (eligible.length > 1) throw new TransitionError("TRANSITION_STREAM_AMBIGUOUS", `${eligible.length} streams are eligible for ${transitionName}; pass --stream`, "$.stream");
        stream = eligible[0];
      }

      if (spec.from && !spec.from.includes(stream.state)) {
        throw new TransitionError(
          spec.fromErrorCode || "TRANSITION_INVALID_STATE",
          `stream ${stream.id} is ${stream.state}; ${transitionName} requires one of ${spec.from.join(", ")}`,
          "$.state",
        );
      }
    }

    // The register revision-window reservation is checked before any mutation:
    // inside a held span, only the holder's own step may proceed. A refusal
    // stages nothing, so the state document, the rendered register, and every
    // receipt stay byte-identical.
    assertRevisionWindowFree(doc, { by: flags.by, targetStreamId: stream ? stream.id : null });

    const candidate = cloneDoc(doc);
    const candidateStream = documentScoped || createsStream ? null : candidate.streams.find((s) => s.id === stream.id);
    const ctx = { doc: candidate, stream: candidateStream, flags, repoRoot, git, nowIso, statePath: stateAbs, heartbeats, unreadableHeartbeats, nowMs, activeWindowMs };
    const outcome = spec.apply(ctx) || {};

    let createdStream = null;
    if (createsStream) {
      createdStream = candidate.streams.find((s) => s.id === outcome.createdStreamId) || null;
      if (!createdStream) {
        throw new TransitionError("CREATE_SPEC_INTERNAL", "the created stream was not appended to the candidate document", "$.streams");
      }
    }

    if (!documentScoped && !createsStream) {
      if (outcome.state !== undefined && outcome.state !== null) {
        candidateStream.state = outcome.state;
      }
      candidateStream.stateUpdatedAt = nowIso;
      applyAwaitedRunning(candidateStream, flags, outcome.defaults || null);

      if (nonEmpty(flags["next-action"])) candidateStream.nextAction = flags["next-action"];
      else if (["PLANNED", "RUNNING", "REVIEW_REQUIRED", "CORRECTION_REQUIRED", "ACCEPT_READY", "INTEGRATION_READY", "DECISION_REQUIRED", "HIGH_APPROVAL_REQUIRED", "BLOCKED", "EXTERNALLY_BLOCKED"].includes(candidateStream.state) && !nonEmpty(candidateStream.nextAction)) {
        throw new TransitionError("TRANSITION_NEXT_ACTION_REQUIRED", `state ${candidateStream.state} requires a non-empty --next-action`, "$.nextAction");
      }
    }

    // Automatic window release: a reservation disappears in the same candidate
    // in which its holder stream reaches a terminal state. Explicit release via
    // `lease-update --release-window` remains the remedy for a stuck holder.
    releaseWindowsForTerminalHolders(candidate);

    candidate.registry.revision = expectRevision + 1;
    candidate.registry.lastUpdatedAt = nowIso;
    candidate.registry.lastUpdatedBy = flags.by || candidate.registry.lastUpdatedBy;

    // Optional closure receipt: mint from the pre-pin candidate bytes, pin it,
    // then verify the final candidate against the in-memory receipt bytes.
    let receiptBytes = null;
    let receiptPath = null;
    let receiptPin = null;
    if (outcome.mintReceiptPath && candidateStream) {
      receiptPath = path.resolve(repoRoot || stateDir, outcome.mintReceiptPath.split("/").join(path.sep));
      const prePinBytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
      const receipt = buildReceipt(candidateStream, statePath, prePinBytes);
      receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
      receiptPin = { path: path.relative(repoRoot || stateDir, receiptPath).split(path.sep).join("/"), sha256: sha256Hex(receiptBytes) };
      candidateStream.closure = { receipt: receiptPin };
    }

    const nextBytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    const resolveReceiptBytes = (filePath) => {
      if (receiptBytes && receiptPath && path.resolve(filePath) === path.resolve(receiptPath)) return receiptBytes;
      return undefined;
    };
    const validated = verifyStateDocument(stateAbs, { ...verifyOptions, stateBytes: nextBytes, resolveReceiptBytes });
    if (!validated.ok) {
      // Repair-read gate: the tolerance is granted only for a repairable sub-multiset.
      // Any non-repairable candidate error, a newly introduced repairable defect,
      // or an equal-or-greater repairable count when one already exists fails
      // closed. With a clean current document the candidate must be clean too.
      const candidateOthers = validated.errors.filter((error) => !REPAIRABLE_ERROR_CODES.has(error.code));
      if (candidateOthers.length > 0) {
        const first = candidateOthers[0];
        throw new TransitionError("TRANSITION_RESULT_INVALID", `candidate state failed verification: ${first.code}: ${first.message}`, first.path);
      }
      if (!isSubMultiset(repairableErrorTuples(validated.errors), currentRepairable)) {
        const first = validated.errors[0];
        throw new TransitionError(
          "TRANSITION_REPAIR_NOT_MONOTONE",
          `the repair-read tolerance requires the candidate's repairable errors to be a sub-multiset of the current document's; current [${currentRepairable.join(", ")}] -> candidate [${repairableErrorTuples(validated.errors).join(", ")}] (first: ${first.code})`,
          "$.state",
        );
      }
    }

    const markdown = renderRegister(candidate, sha256Hex(nextBytes));
    verifyRenderedBytes(markdown);
    if (fault === "VERIFY_RENDERED") throw new TransitionError("FAULT_INJECTED", "injected fault VERIFY_RENDERED", "$.fault");

    const renderRel = flags.render || DEFAULT_RENDER_REL;
    const renderPath = path.resolve(repoRoot || stateDir, renderRel.split("/").join(path.sep));

    // Stage every artifact before publishing any of them.
    const stateTmp = stageFileSync(stateAbs, nextBytes);
    staged.push(stateTmp);
    if (fault === "STAGE_STATE") throw new TransitionError("FAULT_INJECTED", "injected fault STAGE_STATE", "$.fault");
    const renderTmp = stageFileSync(renderPath, Buffer.from(markdown, "utf8"));
    staged.push(renderTmp);
    if (fault === "STAGE_RENDER") throw new TransitionError("FAULT_INJECTED", "injected fault STAGE_RENDER", "$.fault");
    let receiptTmp = null;
    if (receiptBytes) {
      receiptTmp = stageFileSync(receiptPath, receiptBytes);
      staged.push(receiptTmp);
      if (fault === "STAGE_RECEIPT") throw new TransitionError("FAULT_INJECTED", "injected fault STAGE_RECEIPT", "$.fault");
    }

    // Publish. Rename is atomic per file; the receipt is published before the
    // state so the state never pins a receipt that is not yet present.
    if (receiptTmp) {
      commitStagedSync(receiptTmp, receiptPath);
      staged = staged.filter((p) => p !== receiptTmp);
    }
    commitStagedSync(renderTmp, renderPath);
    staged = staged.filter((p) => p !== renderTmp);
    commitStagedSync(stateTmp, stateAbs);
    staged = staged.filter((p) => p !== stateTmp);

    const artifacts = [{ path: renderRel, sha256: sha256Hex(Buffer.from(markdown, "utf8")) }];
    if (receiptPin) artifacts.push({ path: receiptPin.path, sha256: receiptPin.sha256 });

    const summary = {
      ...baseSummary,
      revision: candidate.registry.revision,
      stateSha256: sha256Hex(nextBytes),
      renderPath: renderRel,
      receiptPath: receiptPin ? receiptPin.path : null,
      lockPath: lock.lockPath,
    };
    let nextActions = [];
    if (candidateStream) {
      summary.streamId = candidateStream.id;
      summary.fromState = stream.state;
      summary.toState = candidateStream.state;
      if (outcome.observation) summary.observation = outcome.observation;
      // `abandon-stream` must disclose the heartbeat evidence it relied on: a
      // read-only refusal is only auditable when the evidence is reported.
      if (outcome.heartbeatEvidence) summary.heartbeatEvidence = outcome.heartbeatEvidence;
      if (outcome.artifactRefresh) summary.artifactRefresh = outcome.artifactRefresh;
      if (outcome.window) summary.window = outcome.window;
      nextActions = [{ streamId: candidateStream.id, nextAction: candidateStream.nextAction }];
    } else if (createdStream) {
      summary.streamId = createdStream.id;
      summary.created = true;
      summary.toState = createdStream.state;
      summary.observation = createdStream.git.remoteObservation;
      summary.boundLeaseId = outcome.boundLease ? outcome.boundLease.id : null;
      if (outcome.declaredWindow) summary.window = { declared: outcome.declaredWindow };
      nextActions = [{ streamId: createdStream.id, nextAction: createdStream.nextAction }];
    } else {
      summary.coordination = candidate.coordination;
      if (outcome.window) summary.window = outcome.window;
    }
    return report("ok", summary, [], artifacts, nextActions);
  } catch (err) {
    const code = err instanceof TransitionError ? err.code : "TRANSITION_INTERNAL_ERROR";
    const errPath = err instanceof TransitionError ? err.path : "$";
    return report("fail", { ...baseSummary, lockPath: lock.lockPath }, [{ code, message: err.message, path: errPath }]);
  } finally {
    for (const tmp of staged) discardStagedSync(tmp);
    releaseLock(lock);
  }
}

export { receiptPathFor };
