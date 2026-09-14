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
import { verifyStateDocument } from "./verify.mjs";
import { renderRegister, GENERATED_NOTICE } from "./render.mjs";
import { sha256Hex, stageFileSync, commitStagedSync, discardStagedSync } from "./util.mjs";
import { resolveRepoRoot, createGitMemo } from "./git.mjs";
import { buildReceipt, receiptPathFor } from "./receipt.mjs";
import { acquireLock, releaseLock } from "./lock.mjs";

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

const QA_VERDICTS = ["ACCEPT_READY", "CORRECTION_REQUIRED", "PLANNER_DECISION_REQUIRED"];
const AUDITOR_VERDICTS = ["AUDIT_CLEAR", "CORRECTION_REQUIRED", "PLANNER_DECISION_REQUIRED"];
const LEASE_STATES = ["ACTIVE", "RETURNED", "IDLE", "ERROR", "STALE_UNCONFIRMED"];

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
    optional: ["qa-verdict", "qa-session", "gates", "next-action", "awaited", "running"],
    required: ["qa-verdict", "qa-session", "gates"],
    apply(ctx) {
      const { stream, flags } = ctx;
      const verdict = flags["qa-verdict"];
      if (!QA_VERDICTS.includes(verdict)) {
        throw new TransitionError("TRANSITION_QA_VERDICT_INVALID", `--qa-verdict must be one of ${QA_VERDICTS.join(", ")}`, "$.review.qaVerdict");
      }
      const gates = parseGates(flags.gates);
      if (verdict === "ACCEPT_READY" && !isCleanGates(gates)) {
        throw new TransitionError("TRANSITION_ACCEPT_READY_DIRTY_GATES", "ACCEPT_READY requires total>0, passed===total, and zero failed/blocked/unperformed", "$.gates");
      }
      stream.gates = gates;
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
    optional: ["integration", "worktree", "branch", "next-action", "awaited", "running"],
    required: ["integration"],
    apply(ctx) {
      const { stream, flags, repoRoot, git } = ctx;
      if (!git.shaExists(repoRoot, flags.integration)) {
        throw new TransitionError("TRANSITION_INTEGRATION_UNKNOWN", `integration ${flags.integration} is not a commit in this repository`, "$.git.integrationSha");
      }
      if (nonEmpty(stream.git.candidateSha) && !git.isAncestor(repoRoot, stream.git.candidateSha, flags.integration)) {
        throw new TransitionError("TRANSITION_ANCESTRY", `candidate ${stream.git.candidateSha} is not an ancestor of integration ${flags.integration}`, "$.git");
      }
      stream.git.integrationSha = flags.integration;
      if (flags.worktree !== undefined) stream.git.worktree = flags.worktree;
      if (flags.branch !== undefined) stream.git.branch = flags.branch;
      stream.owners.planner = { sessionId: stream.owners.planner.sessionId, status: "IDLE", writable: false };
      return { state: "INTEGRATED", defaults: { awaited: ["fresh Wave Completion Auditor"], running: [] } };
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

  "lease-update": {
    from: null,
    optional: ["lease-id", "lease-state", "lease-role", "lease-session", "lease-worktree", "lease-expires", "next-action", "awaited", "running"],
    required: ["lease-id", "lease-state", "lease-role"],
    apply(ctx) {
      const { doc, stream, flags, nowIso } = ctx;
      const state = flags["lease-state"];
      if (!LEASE_STATES.includes(state)) {
        throw new TransitionError("TRANSITION_LEASE_STATE_INVALID", `--lease-state must be one of ${LEASE_STATES.join(", ")}`, "$.leases");
      }
      const role = flags["lease-role"];
      if (!["planner", "executor", "qa", "auditor"].includes(role)) {
        throw new TransitionError("TRANSITION_LEASE_ROLE_INVALID", "--lease-role must be planner, executor, qa, or auditor", "$.leases");
      }
      const id = flags["lease-id"];
      let lease = doc.leases.find((l) => l.id === id);
      if (!lease) {
        lease = { id, streamId: stream.id, worktree: flags["lease-worktree"] || stream.git.worktree || null, role, sessionId: null, state, revision: 1, updatedAt: nowIso, expiresAt: flags["lease-expires"] || null };
        doc.leases.push(lease);
        return { state: undefined, defaults: null };
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
      return { state: undefined, defaults: null };
    },
  },
};

export function listTransitions() {
  return Object.keys(TRANSITIONS).sort();
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
  for (const name of Object.keys(flags)) {
    if (["expect-revision", "state", "transition", "render", "by", "stream"].includes(name)) continue;
    if (!(spec.optional || []).includes(name)) {
      return failReport("TRANSITION_FLAG_NOT_APPLICABLE", `flag --${name} is not applicable to transition ${transitionName}`, `$.flags.${name}`, baseSummary);
    }
  }
  if (!nonEmpty(flags["expect-revision"]) || !/^\d+$/.test(flags["expect-revision"])) {
    return failReport("TRANSITION_EXPECT_REVISION_INVALID", "an integer --expect-revision is required for the CAS check", "$.expect-revision", baseSummary);
  }
  const expectRevision = Number(flags["expect-revision"]);
  const streamId = flags.stream;
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
    const current = verifyStateDocument(stateAbs, { gitMemo: git });
    if (!current.ok) {
      const first = current.errors[0] || { code: "STATE_INVALID", message: "state failed verification" };
      throw new TransitionError("TRANSITION_STATE_INVALID", `current state is not verifier-clean: ${first.code}: ${first.message}`, first.path);
    }
    const doc = current.doc;
    if (doc.registry.revision !== expectRevision) {
      throw new TransitionError(
        "TRANSITION_STALE_REVISION",
        `expected revision ${expectRevision} but the state document is at revision ${doc.registry.revision}`,
        "$.registry.revision",
      );
    }

    // Stream selection: explicit --stream, else unique stream in an eligible state.
    let stream;
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
      throw new TransitionError("TRANSITION_INVALID_STATE", `stream ${stream.id} is ${stream.state}; ${transitionName} requires one of ${spec.from.join(", ")}`, "$.state");
    }

    const candidate = cloneDoc(doc);
    const candidateStream = candidate.streams.find((s) => s.id === stream.id);
    const ctx = { doc: candidate, stream: candidateStream, flags, repoRoot, git, nowIso, statePath: stateAbs };
    const outcome = spec.apply(ctx) || {};

    if (outcome.state !== undefined && outcome.state !== null) {
      candidateStream.state = outcome.state;
    }
    candidateStream.stateUpdatedAt = nowIso;
    if (outcome.defaults) applyAwaitedRunning(candidateStream, flags, outcome.defaults);
    else applyAwaitedRunning(candidateStream, flags, null);

    if (nonEmpty(flags["next-action"])) candidateStream.nextAction = flags["next-action"];
    else if (["PLANNED", "RUNNING", "REVIEW_REQUIRED", "CORRECTION_REQUIRED", "ACCEPT_READY", "INTEGRATION_READY", "DECISION_REQUIRED", "HIGH_APPROVAL_REQUIRED", "BLOCKED", "EXTERNALLY_BLOCKED"].includes(candidateStream.state) && !nonEmpty(candidateStream.nextAction)) {
      throw new TransitionError("TRANSITION_NEXT_ACTION_REQUIRED", `state ${candidateStream.state} requires a non-empty --next-action`, "$.nextAction");
    }

    candidate.registry.revision = expectRevision + 1;
    candidate.registry.lastUpdatedAt = nowIso;
    candidate.registry.lastUpdatedBy = flags.by || candidate.registry.lastUpdatedBy;

    // Optional closure receipt: mint from the pre-pin candidate bytes, pin it,
    // then verify the final candidate against the in-memory receipt bytes.
    let receiptBytes = null;
    let receiptPath = null;
    let receiptPin = null;
    if (outcome.mintReceiptPath) {
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
    const validated = verifyStateDocument(stateAbs, { stateBytes: nextBytes, resolveReceiptBytes, gitMemo: git });
    if (!validated.ok) {
      const first = validated.errors[0] || { code: "STATE_INVALID", message: "candidate state failed verification" };
      throw new TransitionError("TRANSITION_RESULT_INVALID", `candidate state failed verification: ${first.code}: ${first.message}`, first.path);
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

    return report(
      "ok",
      {
        ...baseSummary,
        streamId: stream.id,
        fromState: stream.state,
        toState: candidateStream.state,
        revision: candidate.registry.revision,
        stateSha256: sha256Hex(nextBytes),
        renderPath: renderRel,
        receiptPath: receiptPin ? receiptPin.path : null,
        lockPath: lock.lockPath,
      },
      [],
      artifacts,
      [{ streamId: candidateStream.id, nextAction: candidateStream.nextAction }],
    );
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
