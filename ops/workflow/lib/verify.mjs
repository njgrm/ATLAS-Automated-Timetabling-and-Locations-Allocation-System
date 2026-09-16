// ops/workflow/lib/verify.mjs
// The single validation engine shared by verify-cycle.mjs and render-register.mjs.
// Collects ALL independent rule violations deterministically. Schema/parse
// catastrophes abort early with an explicit code.
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SCHEMA_PATH,
  loadSchema,
  findUnsupportedKeywords,
  validateDocument,
  isPlainObject,
} from "./schema.mjs";
import {
  resolveRepoRoot,
  createGitMemo,
  normalizePath,
  worktreeStatusPorcelain,
  gitCommonDir,
} from "./git.mjs";
import { sha256Hex } from "./util.mjs";
import { validateClosureReceipt } from "./receipt.mjs";
import { GATE_CLASSES } from "./readiness.mjs";
import { DEFAULT_ACTIVE_WINDOW_MS, ageMs } from "./liveness.mjs";
import { observabilityPaths, listHeartbeats } from "./observability.mjs";

// The live-evidence rule and the resolution rule codes. Exported so a caller
// (the transition engine, the coverage map) can name them without restating the
// literal.
export const RUNNING_WITHOUT_LIVE_EVIDENCE = "RUNNING_WITHOUT_LIVE_EVIDENCE";
export const RESOLUTION_INCONSISTENT = "RESOLUTION_INCONSISTENT";
export const RESOLUTION_SUPERSEDED_BY_UNKNOWN = "RESOLUTION_SUPERSEDED_BY_UNKNOWN";
export const WINDOW_INVALID = "WINDOW_INVALID";
export const WINDOW_UNKNOWN_STREAM = "WINDOW_UNKNOWN_STREAM";
// The closed repairable-class set (R2.5). These are the only verifier errors a
// transition may read on the CURRENT document and may still carry on the
// candidate, and only when the candidate's repairable multiset is a sub-multiset
// of the current one. Every other code is never tolerated.
export const REPAIRABLE_ERROR_CODES = new Set([RUNNING_WITHOUT_LIVE_EVIDENCE, "ARTIFACT_HASH_MISMATCH"]);

/**
 * The sorted `code|path` tuples, with multiplicity, of the repairable errors in
 * `errors`. Two independent repairable defect classes must be able to coexist
 * during repair, so the comparison is over the whole multiset rather than over
 * one class at a time (a per-class strict-subset rule deadlocks when the two
 * classes guard each other).
 */
export function repairableErrorTuples(errors) {
  return errors
    .filter((error) => REPAIRABLE_ERROR_CODES.has(error.code))
    .map((error) => `${error.code}|${error.path}`)
    .sort();
}
// A malformed clock/window is never silently replaced by the wall clock.
export const STATE_NOW_INVALID = "STATE_NOW_INVALID";
export const STATE_ACTIVE_WINDOW_INVALID = "STATE_ACTIVE_WINDOW_INVALID";
export const STATE_SCOPE_MISMATCH = "STATE_SCOPE_MISMATCH";
export const RESOLUTION_DISPOSITIONS = ["SUPERSEDED", "CLOSED"];
export const USER_RESOLVED_STATES = new Set(["SUPERSEDED", "CLOSED"]);

const NEXT_ACTION_STATES = new Set([
  "PLANNED",
  "RUNNING",
  "REVIEW_REQUIRED",
  "CORRECTION_REQUIRED",
  "ACCEPT_READY",
  "INTEGRATION_READY",
  "DECISION_REQUIRED",
  "HIGH_APPROVAL_REQUIRED",
  "BLOCKED",
  "EXTERNALLY_BLOCKED",
]);

// The states/verdicts that assert the work is accepted or closed. A predeclared
// gate plan must be fully accounted for at such a claim; anything less is a
// silent reclassification of a predeclared gate.
const ACCEPTANCE_OR_CLOSURE_STATES = new Set(["ACCEPT_READY", "INTEGRATION_READY", "INTEGRATED", "COMPLETE"]);

export function isAcceptanceOrClosureClaim(stream) {
  return (
    ACCEPTANCE_OR_CLOSURE_STATES.has(stream.state) ||
    stream.review.qaVerdict === "ACCEPT_READY" ||
    stream.review.auditorVerdict === "AUDIT_CLEAR"
  );
}

export const TERMINAL_STATES = new Set(["INTEGRATED", "COMPLETE", "CLOSED", "SUPERSEDED"]);
const SUCCESSOR_UNLOCKABLE_STATES = new Set(["INTEGRATED", "COMPLETE", "CLOSED"]);
const DEPENDENCY_GATED_STATES = new Set(["RUNNING", "ACCEPT_READY", "INTEGRATION_READY"]);
const CLOSURE_TERMINAL_STATES = new Set(["INTEGRATED", "COMPLETE", "CLOSED"]);

const nonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

function sortedKeys(obj) {
  return Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function setDiff(a, b) {
  const other = new Set(b);
  return a.filter((item) => !other.has(item));
}

// ---- Live-evidence helpers (RUNNING_WITHOUT_LIVE_EVIDENCE) -----------------
//
// A RUNNING declaration is a claim that work is in flight. It is only admitted
// when the document itself carries machine evidence for it: an ACTIVE lease
// bound to the stream, or a heartbeat record naming the stream that is inside
// the configured window. `running[]` prose is a description, never evidence.

/** Normalize `now` (Date | epoch ms | ISO string) to epoch ms, or null. */
export function normalizeNowMs(now) {
  if (now === undefined || now === null) return Date.now();
  if (now instanceof Date) return Number.isNaN(now.getTime()) ? null : now.getTime();
  if (typeof now === "number") return Number.isFinite(now) ? now : null;
  if (typeof now === "string") {
    const parsed = Date.parse(now);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Resolve the heartbeat store the liveness rule reads. An explicit
 * `options.commonDir` must be the state document's own resolved Git common
 * directory: a foreign store would let an unrelated repository's heartbeat
 * satisfy a local RUNNING claim, which is the fail-open direction. When no Git
 * repository is resolvable, or the store does not exist, the store is empty —
 * that is the fail-closed direction for the rule.
 */
export function resolveHeartbeats(options, repoRoot) {
  if (Array.isArray(options.heartbeats)) return { heartbeats: options.heartbeats, unreadableCount: 0, scopeError: null };
  const expectedCommonDir = repoRoot ? gitCommonDir(repoRoot) : null;
  const explicit = typeof options.commonDir === "string" && options.commonDir.trim().length > 0 ? options.commonDir : null;
  if (explicit !== null) {
    if (!expectedCommonDir || normalizePath(path.resolve(explicit)) !== normalizePath(expectedCommonDir)) {
      return {
        heartbeats: [],
        unreadableCount: 0,
        scopeError: {
          code: STATE_SCOPE_MISMATCH,
          message: `--common-dir ${explicit} is not the state document's resolved Git common directory ${expectedCommonDir || "(unresolved)"}; foreign observability state is never read as evidence for a local RUNNING claim`,
          path: "$.commonDir",
        },
      };
    }
  }
  const storeRoot = explicit || expectedCommonDir;
  if (!storeRoot) return { heartbeats: [], unreadableCount: 0, scopeError: null };
  const paths = observabilityPaths(storeRoot);
  let files;
  try {
    files = fs.readdirSync(paths.sessionsDir).filter((name) => name.endsWith(".json"));
  } catch {
    return { heartbeats: [], unreadableCount: 0, scopeError: null };
  }
  const heartbeats = listHeartbeats(paths);
  // A heartbeat file that yields no readable record is disclosed, never
  // silently ignored: readHeartbeat treats a corrupt/oversized record as
  // "no heartbeat" because heartbeats are advisory local monitoring state.
  return { heartbeats, unreadableCount: Math.max(0, files.length - heartbeats.length), scopeError: null };
}

/**
 * The exact set of stream ids whose RUNNING declaration is unevidenced. Shared
 * with the transition engine's declared repair-read so the current-document
 * tolerance and the candidate gate are computed from one implementation.
 */
export function runningWithoutLiveEvidence(doc, { heartbeats = [], nowMs = Date.now(), activeWindowMs = DEFAULT_ACTIVE_WINDOW_MS } = {}) {
  const leases = Array.isArray(doc.leases) ? doc.leases : [];
  const activeLeaseStreams = new Set(leases.filter((lease) => lease && lease.state === "ACTIVE").map((lease) => lease.streamId));
  const freshHeartbeatStreams = new Set();
  for (const record of heartbeats) {
    if (!record || typeof record.stream !== "string") continue;
    const age = ageMs(record, nowMs);
    // `ageMs` returns null for an unparseable record; null must never coerce to
    // "0 <= window" and be read as fresh.
    if (age !== null && age <= activeWindowMs) freshHeartbeatStreams.add(record.stream);
  }
  const offending = new Set();
  for (const stream of doc.streams) {
    if (stream.state !== "RUNNING") continue;
    if (activeLeaseStreams.has(stream.id)) continue;
    if (freshHeartbeatStreams.has(stream.id)) continue;
    offending.add(stream.id);
  }
  return offending;
}

export function verifyStateDocument(statePath, options = {}) {
  const schemaPath = options.schemaPath || DEFAULT_SCHEMA_PATH;
  const errors = [];

  // 1. Schema must load and may contain only supported keywords.
  const loaded = loadSchema(schemaPath);
  if (!loaded.ok) {
    return {
      ok: false,
      errors: [{ code: loaded.code, message: loaded.message, path: "$schema" }],
      doc: null,
      stateBytes: null,
      stateSha256: null,
      repoRoot: null,
      schemaPath,
    };
  }
  const unsupported = findUnsupportedKeywords(loaded.schema, "#");
  if (unsupported.length > 0) {
    for (const item of unsupported) {
      errors.push({
        code: "SCHEMA_UNSUPPORTED_KEYWORD",
        message: `unsupported schema keyword "${item.keyword}"`,
        path: `$schema${item.location}`,
      });
    }
    return { ok: false, errors: sortErrors(errors), doc: null, stateBytes: null, stateSha256: null, repoRoot: null, schemaPath };
  }

  // 2. State file must be readable and parseable. An in-memory override lets the
  //    atomic transition engine validate candidate bytes before any replace.
  let stateBytes;
  if (options.stateBytes !== undefined) {
    stateBytes = Buffer.isBuffer(options.stateBytes) ? options.stateBytes : Buffer.from(options.stateBytes, "utf8");
  } else {
    try {
      stateBytes = fs.readFileSync(statePath);
    } catch (err) {
      return {
        ok: false,
        errors: [{ code: "STATE_UNREADABLE", message: `cannot read state file: ${err.message}`, path: statePath }],
        doc: null,
        stateBytes: null,
        stateSha256: null,
        repoRoot: null,
        schemaPath,
      };
    }
  }
  const stateSha256 = sha256Hex(stateBytes);
  let doc;
  try {
    doc = JSON.parse(stateBytes.toString("utf8"));
  } catch (err) {
    return {
      ok: false,
      errors: [{ code: "STATE_PARSE_FAILED", message: `state file is not valid JSON: ${err.message}`, path: statePath }],
      doc: null,
      stateBytes,
      stateSha256,
      repoRoot: null,
      schemaPath,
    };
  }

  // 3. Structural schema validation.
  const structural = validateDocument(doc, loaded.schema);
  if (structural.length > 0) {
    return {
      ok: false,
      errors: sortErrors(structural),
      doc,
      stateBytes,
      stateSha256,
      repoRoot: null,
      schemaPath,
    };
  }

  const stateDir = path.dirname(path.resolve(statePath));
  const repoRoot = resolveRepoRoot(stateDir);
  const streams = doc.streams;
  const push = (code, message, errPath) => errors.push({ code, message, path: errPath });

  // Clock, window and heartbeat store for the live-evidence rule. These are
  // consulted ONLY while the document declares a RUNNING stream: with zero
  // RUNNING declarations the store and the clock are never read, so
  // verification stays a pure function of (state bytes, Git facts, pinned
  // artifact bytes) and `workflow:render:check` stays clock-independent.
  const nowMs = normalizeNowMs(options.now);
  if (nowMs === null) {
    errors.push({ code: STATE_NOW_INVALID, message: `--now must be a Date, epoch milliseconds, or an ISO-8601 timestamp, got ${JSON.stringify(options.now)}`, path: "$.now" });
  }
  const activeWindowMs = options.activeWindowMs === undefined ? DEFAULT_ACTIVE_WINDOW_MS : options.activeWindowMs;
  if (!Number.isInteger(activeWindowMs) || activeWindowMs <= 0) {
    errors.push({
      code: STATE_ACTIVE_WINDOW_INVALID,
      message: `--active-window-ms must be a positive integer, got ${JSON.stringify(options.activeWindowMs)}`,
      path: "$.activeWindowMs",
    });
  }
  const hasRunningDeclaration = streams.some((stream) => stream.state === "RUNNING");
  const resolvedStore = hasRunningDeclaration
    ? resolveHeartbeats(options, repoRoot)
    : { heartbeats: [], scopeError: null };
  if (resolvedStore.scopeError) errors.push(resolvedStore.scopeError);
  const heartbeats = resolvedStore.heartbeats;
  const offendingRunningStreams = hasRunningDeclaration
    ? runningWithoutLiveEvidence(doc, { heartbeats, nowMs: nowMs === null ? Date.now() : nowMs, activeWindowMs })
    : new Set();

  // A caller (the atomic transition engine) may share a memo between the
  // current-state and candidate-state validations so unchanged Git facts are
  // resolved once. Every entry is read-only and keyed by its exact query.
  const gitMemo = options.gitMemo || createGitMemo();
  const ancestorCached = (a, b) => gitMemo.isAncestor(repoRoot, a, b);
  const ancestorOrEqualCached = (a, b) => gitMemo.isAncestorOrEqual(repoRoot, a, b);
  const diffCached = (base, candidate) => gitMemo.diffNameOnly(repoRoot, base, candidate);

  // Batch commit-object existence for every stream in one Git call.
  const existenceShas = [];
  for (const s of streams) {
    const gg = s.git;
    const candidates = [gg.baseSha, gg.candidateSha, gg.integrationSha, gg.remoteObservation ? gg.remoteObservation.sha : null];
    for (const sha of candidates) if (typeof sha === "string") existenceShas.push(sha);
  }
  const existence = repoRoot ? gitMemo.shaExistsMany(repoRoot, existenceShas) : new Map();

  // ---- Stream identity -----------------------------------------------------
  const seenIds = new Map();
  const streamsById = new Map();
  streams.forEach((stream, i) => {
    if (seenIds.has(stream.id)) {
      push("DUPLICATE_STREAM_ID", `duplicate stream id "${stream.id}"`, `streams[${i}].id`);
    } else {
      seenIds.set(stream.id, i);
      streamsById.set(stream.id, stream);
    }
  });

  // ---- Per-stream rules ----------------------------------------------------
  streams.forEach((stream, i) => {
    const sp = `streams[${i}]`;
    const gates = stream.gates;
    const topLevelSum = gates.passed + gates.failed + gates.blocked + gates.unperformed;
    if (gates.total !== topLevelSum) {
      push(
        "GATES_ARITHMETIC",
        `gates total ${gates.total} != passed+failed+blocked+unperformed (${topLevelSum})`,
        `${sp}.gates`,
      );
    }
    // Per-class arithmetic, and each top-level counter must equal the sum of the
    // three predeclared classes. This is the load-bearing control that a
    // predeclared gate cannot be moved out of the arithmetic.
    for (const className of GATE_CLASSES) {
      const counters = gates.classes[className];
      const classSum = counters.passed + counters.failed + counters.blocked + counters.unperformed;
      if (counters.total !== classSum) {
        push(
          "GATES_ARITHMETIC",
          `gates.classes.${className} total ${counters.total} != passed+failed+blocked+unperformed (${classSum})`,
          `${sp}.gates.classes.${className}`,
        );
      }
    }
    for (const key of ["total", "passed", "failed", "blocked", "unperformed"]) {
      const summed = GATE_CLASSES.reduce((sum, name) => sum + gates.classes[name][key], 0);
      if (gates[key] !== summed) {
        push("GATES_ARITHMETIC", `gates.${key} ${gates[key]} != sum of the three gate classes (${summed})`, `${sp}.gates`);
      }
    }

    // A gate may never appear above its predeclared class plan, and at an
    // acceptance/closure claim every predeclared gate must be accounted for.
    const claim = isAcceptanceOrClosureClaim(stream);
    for (const className of GATE_CLASSES) {
      const actual = gates.classes[className].total;
      const planned = gates.plan[className];
      if (actual > planned) {
        push(
          "GATE_PLAN_MISMATCH",
          `gate class ${className} total ${actual} exceeds its predeclared plan ${planned}`,
          `${sp}.gates.classes.${className}.total`,
        );
      } else if (claim && actual !== planned) {
        push(
          "GATE_PLAN_MISMATCH",
          `gate class ${className} total ${actual} != its predeclared plan ${planned} at an acceptance/closure claim`,
          `${sp}.gates.classes.${className}.total`,
        );
      }
    }

    if (stream.state === "ACCEPT_READY" || stream.review.qaVerdict === "ACCEPT_READY") {
      const mandatorySource = gates.classes.MANDATORY_SOURCE;
      const mandatoryLive = gates.classes.MANDATORY_LIVE;
      const sourceClean =
        mandatorySource.total > 0 &&
        mandatorySource.passed === mandatorySource.total &&
        mandatorySource.failed === 0 &&
        mandatorySource.blocked === 0 &&
        mandatorySource.unperformed === 0;
      const liveClean = mandatoryLive.failed === 0 && mandatoryLive.blocked === 0;
      if (!(gates.total > 0 && sourceClean && liveClean)) {
        push(
          "ACCEPT_READY_DIRTY_GATES",
          "ACCEPT_READY requires total>0, MANDATORY_SOURCE fully passed, and zero failed/blocked MANDATORY_LIVE gates",
          `${sp}.gates`,
        );
      }
    }
    if (stream.state === "COMPLETE") {
      const mandatoryLive = gates.classes.MANDATORY_LIVE;
      if (!(mandatoryLive.passed === mandatoryLive.total && mandatoryLive.unperformed === 0)) {
        push(
          "COMPLETE_MANDATORY_GATES_UNPASSED",
          `COMPLETE requires every MANDATORY_LIVE gate passed with zero unperformed (have ${mandatoryLive.passed}/${mandatoryLive.total}, unperformed ${mandatoryLive.unperformed})`,
          `${sp}.gates.classes.MANDATORY_LIVE`,
        );
      }
    }

    // ---- QA rounds and the corrections trail ----
    // Every QA round is recorded; the last round is the current verdict. A
    // disclosed CORRECTION_REQUIRED round requires a recorded correction round
    // before the stream may claim acceptance or closure.
    const qaRounds = stream.review.qaRounds;
    if (qaRounds.length === 0) {
      if (stream.review.qaVerdict !== null) {
        push("QA_ROUNDS_INCONSISTENT", "review.qaVerdict is set while review.qaRounds is empty", `${sp}.review.qaRounds`);
      }
    } else {
      let roundsConsistent = true;
      qaRounds.forEach((round, ri) => {
        if (round.round !== ri + 1) roundsConsistent = false;
      });
      const lastRound = qaRounds[qaRounds.length - 1];
      if (!(lastRound.verdict === stream.review.qaVerdict && (lastRound.sessionId ?? null) === (stream.review.qaSessionId ?? null))) {
        roundsConsistent = false;
      }
      if (!roundsConsistent) {
        push(
          "QA_ROUNDS_INCONSISTENT",
          "review.qaRounds must be exactly 1..n with the last round matching review.qaVerdict/qaSessionId",
          `${sp}.review.qaRounds`,
        );
      }
    }
    if (claim) {
      for (const round of qaRounds) {
        if (round.verdict !== "CORRECTION_REQUIRED") continue;
        if (!stream.corrections.some((correction) => correction.round >= round.round)) {
          push(
            "CORRECTION_NOT_RECORDED",
            `qaRounds round ${round.round} disclosed CORRECTION_REQUIRED while corrections[] holds no round >= ${round.round}`,
            `${sp}.corrections`,
          );
        }
      }
    }

    // ---- COMPLETE requirements ----
    if (stream.state === "COMPLETE") {
      if (stream.review.qaVerdict !== "ACCEPT_READY") {
        push("COMPLETE_MISSING_QA", "COMPLETE requires review.qaVerdict ACCEPT_READY", `${sp}.review.qaVerdict`);
      }
      if (stream.review.auditRequired) {
        if (stream.review.auditorVerdict !== "AUDIT_CLEAR" || !nonEmptyString(stream.review.auditorSessionId)) {
          push(
            "COMPLETE_MISSING_AUDIT",
            "COMPLETE with auditRequired requires auditorVerdict AUDIT_CLEAR and a non-empty auditorSessionId",
            `${sp}.review`,
          );
        }
      }
      if (stream.corrections.length > 0) {
        const sorted = [...stream.corrections].sort((a, b) => a.round - b.round);
        const last = sorted[sorted.length - 1];
        const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        if (last.qaVerdict !== "ACCEPT_READY" || !nonEmptyString(last.qaSessionId)) {
          push("POST_CORRECTION_FRESH_QA_MISSING", "last correction round lacks ACCEPT_READY with a non-empty qaSessionId", `${sp}.corrections`);
        } else if (prev && nonEmptyString(prev.qaSessionId) && prev.qaSessionId === last.qaSessionId) {
          push("POST_CORRECTION_FRESH_QA_MISSING", "post-correction QA session is not fresh (identical to the previous round)", `${sp}.corrections`);
        }
        if (stream.review.auditRequired) {
          if (last.auditorVerdict !== "AUDIT_CLEAR" || !nonEmptyString(last.auditorSessionId)) {
            push("POST_CORRECTION_FRESH_AUDIT_MISSING", "last correction round lacks AUDIT_CLEAR with a non-empty auditorSessionId", `${sp}.corrections`);
          } else if (prev && nonEmptyString(prev.auditorSessionId) && prev.auditorSessionId === last.auditorSessionId) {
            push("POST_CORRECTION_FRESH_AUDIT_MISSING", "post-correction auditor session is not fresh (identical to the previous round)", `${sp}.corrections`);
          }
        }
        if (stream.git.candidateSha !== null && last.candidateSha !== stream.git.candidateSha) {
          push("CORRECTIONS_INVALID", `last correction candidateSha ${last.candidateSha} != git.candidateSha ${stream.git.candidateSha}`, `${sp}.corrections`);
        }
      }
      const receiptError = validateClosureReceipt(stream, repoRoot, stateDir, options.resolveReceiptBytes);
      if (receiptError) {
        push(receiptError.code, receiptError.message, `${sp}.closure.receipt`);
      }
    }

    // ---- Correction ordering ----
    stream.corrections.forEach((corr, ci) => {
      if (ci > 0 && corr.round <= stream.corrections[ci - 1].round) {
        push("CORRECTIONS_INVALID", `correction round ${corr.round} is not strictly increasing`, `${sp}.corrections[${ci}].round`);
      }
    });
    const candidateShas = stream.corrections.map((c) => c.candidateSha);
    if (new Set(candidateShas).size !== candidateShas.length) {
      push("CORRECTIONS_INVALID", "correction candidateShas must be unique", `${sp}.corrections`);
    }

    // ---- Git binding ----
    const g = stream.git;
    if (g.candidateSha !== null) {
      if (!repoRoot) {
        push("GIT_REPO_UNAVAILABLE", "candidateSha is set but no Git repository could be resolved from the state file directory", `${sp}.git`);
      } else {
        const required = [g.baseSha, g.candidateSha, g.integrationSha].filter((sha) => sha !== null);
        const unknown = required.filter((sha) => !existence.get(sha));
        if (unknown.length > 0) {
          push("GIT_SHA_UNKNOWN", `unknown commit object(s): ${unknown.join(", ")}`, `${sp}.git`);
        } else {
          let ancestryOk = true;
          if (g.baseSha === null) {
            ancestryOk = false;
            push("GIT_ANCESTRY", "candidateSha is set but baseSha is null", `${sp}.git.baseSha`);
          } else if (!ancestorCached(g.baseSha, g.candidateSha)) {
            ancestryOk = false;
            push("GIT_ANCESTRY", `baseSha ${g.baseSha} is not an ancestor of candidateSha ${g.candidateSha}`, `${sp}.git`);
          }
          if (g.integrationSha !== null && !ancestorCached(g.candidateSha, g.integrationSha)) {
            ancestryOk = false;
            push("GIT_ANCESTRY", `candidateSha ${g.candidateSha} is not an ancestor of integrationSha ${g.integrationSha}`, `${sp}.git`);
          }
          if (ancestryOk && g.baseSha !== null) {
            const actual = diffCached(g.baseSha, g.candidateSha);
            if (actual === null) {
              push("GIT_DIFF_FAILED", `git diff ${g.baseSha}...${g.candidateSha} failed`, `${sp}.git`);
            } else {
              const declared = g.changedPaths;
              // missing = actually changed but absent from the declaration;
              // extra   = declared but not actually changed.
              const missing = setDiff(actual, declared);
              const extra = setDiff(declared, actual);
              if (missing.length > 0 || extra.length > 0) {
                push(
                  "CHANGED_PATHS_MISMATCH",
                  `changedPaths mismatch (missing: [${missing.join(", ")}]; extra: [${extra.join(", ")}])`,
                  `${sp}.git.changedPaths`,
                );
              }
            }
          }
        }
      }
    }

    // ---- Remote observation (A1: a snapshot, never required to equal HEAD) ----
    // An observation attests a named ref and the SHA observed there. It is NOT
    // compared with the containing commit, the current tip, or the working
    // HEAD, so recording one cannot create a "new final SHA" fix-up chain. It
    // is rejected when the observed SHA is not a real commit or when it is not
    // downstream of the integrated work.
    if (g.remoteObservation !== null) {
      if (!repoRoot) {
        push("GIT_REPO_UNAVAILABLE", "remoteObservation is set but no Git repository could be resolved from the state file directory", `${sp}.git.remoteObservation`);
      } else if (!existence.get(g.remoteObservation.sha)) {
        push(
          "REMOTE_OBSERVATION_INVALID",
          `remote observation sha ${g.remoteObservation.sha} is not a commit in this repository`,
          `${sp}.git.remoteObservation.sha`,
        );
      } else if (g.integrationSha !== null && !ancestorOrEqualCached(g.integrationSha, g.remoteObservation.sha)) {
        push(
          "REMOTE_OBSERVATION_INVALID",
          `integrationSha ${g.integrationSha} is not an ancestor-or-equal of observed remote sha ${g.remoteObservation.sha}`,
          `${sp}.git.remoteObservation.sha`,
        );
      }
    }

    // ---- HIGH approval ----
    const ap = stream.approval;
    if (ap.execution && ap.execution.performed === true) {
      const ok =
        ap.required === true &&
        ap.granted === true &&
        nonEmptyString(ap.operatorIdentity) &&
        ap.approvedAt !== null &&
        nonEmptyString(ap.boundary) &&
        Array.isArray(ap.execution.actionsPerformed) &&
        ap.execution.actionsPerformed.length > 0;
      if (!ok) {
        push("HIGH_EXECUTION_WITHOUT_APPROVAL", "approval.execution.performed requires a complete granted approval (required, granted, operatorIdentity, approvedAt, boundary, actionsPerformed)", `${sp}.approval`);
      }
      const sanctioned = new Set(ap.approvedActions);
      const outside = (ap.execution.actionsPerformed || []).filter((action) => !sanctioned.has(action));
      if (outside.length > 0) {
        push("HIGH_BOUNDARY_EXCEEDED", `performed action(s) outside approvedActions: ${outside.join(", ")}`, `${sp}.approval.execution.actionsPerformed`);
      }
    }
    if (ap.granted === true && !(nonEmptyString(ap.operatorIdentity) && ap.approvedAt !== null && nonEmptyString(ap.boundary))) {
      push("HIGH_APPROVAL_INCOMPLETE", "granted approval requires operatorIdentity, approvedAt, and boundary", `${sp}.approval`);
    }
    if (ap.presentedReady === true) {
      const ids = ap.requiredObservationIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        push("HIGH_DEPENDENCY_MISSING", "presentedReady requires non-empty requiredObservationIds", `${sp}.approval.requiredObservationIds`);
      } else {
        const now = nowMs;
        ids.forEach((id) => {
          const obs = stream.observations.find((o) => o.id === id);
          if (!obs) {
            push("HIGH_DEPENDENCY_MISSING", `required observation "${id}" not found on this stream`, `${sp}.approval.requiredObservationIds`);
            return;
          }
          if (obs.status !== "PASS") {
            push("HIGH_DEPENDENCY_UNHEALTHY", `required observation "${id}" status is ${obs.status}`, `${sp}.observations`);
            return;
          }
          const expires = obs.expiresAt === null ? null : Date.parse(obs.expiresAt);
          if (expires === null || Number.isNaN(expires) || !(expires > now)) {
            push("HIGH_DEPENDENCY_EXPIRED", `required observation "${id}" is not unexpired (expiresAt=${obs.expiresAt})`, `${sp}.observations`);
          }
        });
      }
    }

    // ---- Blockers ----
    const blocker = stream.blocker;
    if (stream.state === "EXTERNALLY_BLOCKED" && blocker.kind !== "EXTERNAL") {
      push("BLOCKER_KIND_MISMATCH", `state EXTERNALLY_BLOCKED requires blocker.kind EXTERNAL (found ${blocker.kind})`, `${sp}.blocker.kind`);
    }
    if (stream.state === "BLOCKED" && blocker.kind === "NONE") {
      push("BLOCKER_KIND_MISMATCH", "state BLOCKED requires a non-NONE blocker kind", `${sp}.blocker.kind`);
    }
    if ((blocker.kind === "EXTERNAL" || blocker.kind === "DEPENDENCY") && (blocker.safeWorkRemaining === true || blocker.safeWorkItems.length > 0)) {
      push("EXTERNAL_BLOCKER_WITH_SAFE_WORK", `${blocker.kind} blockers may not carry safe work`, `${sp}.blocker`);
    }
    if (blocker.safeWorkRemaining !== blocker.safeWorkItems.length > 0) {
      push("BLOCKER_INCONSISTENT", "blocker.safeWorkRemaining must equal (safeWorkItems.length > 0)", `${sp}.blocker`);
    }

    // ---- Owners ----
    const ownerRoles = ["planner", "executor", "qa", "auditor"];
    const writableActive = ownerRoles.filter((role) => stream.owners[role].writable === true && stream.owners[role].status === "ACTIVE");
    if (writableActive.length > 1) {
      push("WRITABLE_OWNER_CONFLICT", `more than one ACTIVE writable owner: ${writableActive.join(", ")}`, `${sp}.owners`);
    }

    // ---- Successors / dependencies ----
    stream.successors.forEach((succ, si) => {
      if (succ.unlocked === true && !SUCCESSOR_UNLOCKABLE_STATES.has(stream.state)) {
        push("SUCCESSOR_UNLOCKED_INCOMPLETE", `stream ${stream.id} (state ${stream.state}) may not unlock ${succ.streamId}`, `${sp}.successors[${si}]`);
      }
    });
    stream.requires.forEach((requiredId, ri) => {
      const target = streamsById.get(requiredId);
      if (!target) {
        push("UNKNOWN_STREAM_REFERENCE", `requires references undefined stream "${requiredId}"`, `${sp}.requires[${ri}]`);
        return;
      }
      if (DEPENDENCY_GATED_STATES.has(stream.state) && !CLOSURE_TERMINAL_STATES.has(target.state)) {
        push(
          "DEPENDENCY_NOT_SATISFIED",
          `stream ${stream.id} (state ${stream.state}) requires ${requiredId}, which is ${target.state}`,
          `${sp}.requires[${ri}]`,
        );
      }
    });

    // ---- Progress declaration ----
    if (NEXT_ACTION_STATES.has(stream.state) && !nonEmptyString(stream.nextAction)) {
      push("NEXT_ACTION_MISSING", `state ${stream.state} requires a non-empty nextAction`, `${sp}.nextAction`);
    }

    // ---- Artifacts ----
    const artifactBase = repoRoot ? repoRoot : stateDir;
    stream.artifacts.forEach((artifact, ai) => {
      const filePath = path.resolve(artifactBase, artifact.path.split("/").join(path.sep));
      let bytes;
      try {
        bytes = fs.readFileSync(filePath);
      } catch (err) {
        push("ARTIFACT_MISSING", `artifact ${artifact.path} is missing: ${err.message}`, `${sp}.artifacts[${ai}]`);
        return;
      }
      const actual = sha256Hex(bytes);
      if (actual !== artifact.sha256) {
        push("ARTIFACT_HASH_MISMATCH", `artifact ${artifact.path} sha256 ${actual} != ${artifact.sha256}`, `${sp}.artifacts[${ai}].sha256`);
      }
    });

    // ---- Resolution (the documented terminal exit for DECISION_REQUIRED) ----
    // `resolution === null` and an absent key are both "not resolved": no rule
    // fires, so every historical or not-yet-resolved record stays valid.
    const resolution = stream.resolution === undefined ? null : stream.resolution;
    if (resolution !== null) {
      if (resolution.disposition !== stream.state) {
        push(
          RESOLUTION_INCONSISTENT,
          `resolution.disposition ${resolution.disposition} != stream state ${stream.state}`,
          `${sp}.resolution`,
        );
      }
      if (resolution.disposition === "SUPERSEDED" && resolution.supersededBy === null) {
        push(RESOLUTION_INCONSISTENT, "resolution.disposition SUPERSEDED requires a non-null supersededBy", `${sp}.resolution.supersededBy`);
      }
      if (resolution.supersededBy !== null && !streamsById.has(resolution.supersededBy)) {
        push(
          RESOLUTION_SUPERSEDED_BY_UNKNOWN,
          `resolution.supersededBy "${resolution.supersededBy}" is not a defined stream`,
          `${sp}.resolution.supersededBy`,
        );
      }
    }
  });

  // ---- Cross-stream writable worktree ownership ---------------------------
  const worktreeOwners = new Map();
  streams.forEach((stream, i) => {
    if (!nonEmptyString(stream.git.worktree)) return;
    const key = normalizePath(stream.git.worktree);
    const active = ["planner", "executor", "qa", "auditor"].filter(
      (role) => stream.owners[role].writable === true && stream.owners[role].status === "ACTIVE",
    );
    if (active.length === 0) return;
    if (!worktreeOwners.has(key)) worktreeOwners.set(key, []);
    worktreeOwners.get(key).push({ streamId: stream.id, roles: active, path: stream.git.worktree, index: i });
  });
  for (const [, entries] of worktreeOwners) {
    const totalActive = entries.reduce((sum, entry) => sum + entry.roles.length, 0);
    if (totalActive > 1) {
      push(
        "WRITABLE_OWNER_CONFLICT",
        `worktree ${entries[0].path} has ${totalActive} ACTIVE writable owners across ${entries.map((e) => e.streamId).join(", ")}`,
        `streams[${entries[0].index}].owners`,
      );
    }
  }

  // ---- Stream/worktree leases (A3 active-work detection) -------------------
  // A stream may not be declared PLANNED with an empty running list while a
  // verified ACTIVE lease names it, or while its owned worktree is dirty. Plain
  // directory existence is NOT activity: a clean worktree with no lease passes.
  // Lease expiry is evidence of uncertainty, never authority to clean up or
  // replace another owner's work.
  const leases = Array.isArray(doc.leases) ? doc.leases : [];
  const seenLeaseIds = new Set();
  leases.forEach((lease, li) => {
    const lp = `leases[${li}]`;
    if (seenLeaseIds.has(lease.id)) {
      push("DUPLICATE_LEASE_ID", `duplicate lease id "${lease.id}"`, `${lp}.id`);
    } else {
      seenLeaseIds.add(lease.id);
    }
    const ownerStream = streamsById.get(lease.streamId);
    if (!ownerStream) {
      push("LEASE_UNKNOWN_STREAM", `lease ${lease.id} references undefined stream "${lease.streamId}"`, `${lp}.streamId`);
      return;
    }
    if (lease.state === "ACTIVE" && ownerStream.state === "COMPLETE") {
      push("COMPLETE_WITH_LIVE_LEASE", `stream ${ownerStream.id} is COMPLETE but lease ${lease.id} is ACTIVE`, `${lp}.state`);
    }
  });
  streams.forEach((stream, i) => {
    if (stream.state !== "PLANNED" || stream.running.length > 0) return;
    const sp = `streams[${i}]`;
    const activeLease = leases.find((l) => l.streamId === stream.id && l.state === "ACTIVE");
    if (activeLease) {
      push("PLANNED_WITH_LIVE_LEASE", `stream ${stream.id} is PLANNED with empty running but lease ${activeLease.id} is ACTIVE`, `${sp}.state`);
    }
    const dirty = worktreeStatusPorcelain(stream.git.worktree);
    if (dirty !== null && dirty.trim().length > 0) {
      push("PLANNED_WITH_DIRTY_WORKTREE", `stream ${stream.id} is PLANNED with empty running but its owned worktree is dirty`, `${sp}.git.worktree`);
    }
  });

  // ---- Live evidence for a RUNNING declaration -----------------------------
  // RUNNING is the one state whose residue is a claim of live work, so the
  // declaration must be backed by machine evidence: an ACTIVE lease bound to
  // the stream, or a heartbeat record naming the stream inside the active
  // window. `running[]` prose is a description and never evidence.
  streams.forEach((stream, i) => {
    if (!offendingRunningStreams.has(stream.id)) return;
    push(
      RUNNING_WITHOUT_LIVE_EVIDENCE,
      `stream ${stream.id} declares RUNNING with no ACTIVE lease and no heartbeat within ${activeWindowMs}ms`,
      `streams[${i}].state`,
    );
  });

  // ---- Registry revision windows -------------------------------------------
  // An optional, lazily-materialized reservation. A missing `windows` key and an
  // empty array are equivalent: no window is declared and no rule fires. A window
  // is only a reservation; it grants no authority and its `holder` is an
  // attestation at the same trust level as the existing `--by` flag.
  const windows = Array.isArray(doc.registry.windows) ? doc.registry.windows : [];
  windows.forEach((window, wi) => {
    const wp = `$.registry.windows[${wi}]`;
    if (window.toRevision < window.fromRevision) {
      push(WINDOW_INVALID, `revision window for "${window.streamId}" has toRevision ${window.toRevision} < fromRevision ${window.fromRevision}`, wp);
    }
    if (!streamsById.has(window.streamId)) {
      push(WINDOW_UNKNOWN_STREAM, `revision window references undefined stream "${window.streamId}"`, `${wp}.streamId`);
    }
  });

  // ---- Coordination --------------------------------------------------------
  const coordination = doc.coordination;
  if (coordination.mode === "CYCLE_ACTIVE") {
    const active = coordination.activeCycleId === null ? null : streamsById.get(coordination.activeCycleId);
    if (!active) {
      push("ACTIVE_CYCLE_UNKNOWN", `coordination.activeCycleId "${coordination.activeCycleId}" is not a defined stream`, "$.coordination.activeCycleId");
    } else if (TERMINAL_STATES.has(active.state)) {
      push("ACTIVE_CYCLE_TERMINAL", `active cycle ${active.id} is terminal (${active.state})`, "$.coordination.activeCycleId");
    }
    if (!nonEmptyString(coordination.globalNextAction)) {
      push("COORDINATION_NEXT_ACTION_MISSING", "CYCLE_ACTIVE requires a non-empty globalNextAction", "$.coordination.globalNextAction");
    }
    if (active && active.awaited.length + active.running.length === 0) {
      push("AWAITED_STATE_MISSING", `active cycle ${active.id} has empty awaited and running`, "$.coordination");
    }
  } else if (coordination.mode === "MANUAL" && coordination.activeCycleId !== null) {
    push("COORDINATION_MODE_CONFLICT", "MANUAL coordination requires activeCycleId to be null", "$.coordination.activeCycleId");
  }

  // ---- Custody -------------------------------------------------------------
  for (const profile of doc.browserCustody.profiles) {
    const active = profile.custody.filter((entry) => entry.status === "ACTIVE");
    if (active.length > 1) {
      push("CUSTODY_OVERLAP", `profile ${profile.profilePath} has ${active.length} ACTIVE custody entries`, "$.browserCustody.profiles");
    }
  }
  const profilePaths = doc.browserCustody.profiles.map((p) => p.profilePath);
  doc.browserCustody.logins.forEach((login, li) => {
    if (!profilePaths.includes(login.profilePath)) {
      push("LOGIN_PROFILE_UNKNOWN", `login ${login.id} references unknown profile ${login.profilePath}`, `$.browserCustody.logins[${li}].profilePath`);
    }
    if (login.performed === true) {
      const auth = login.authorization;
      if (!auth || !nonEmptyString(auth.operatorIdentity) || !nonEmptyString(auth.expectedAuditDelta)) {
        push("LOGIN_UNAUTHORIZED", `login ${login.id} was performed without a complete authorization`, `$.browserCustody.logins[${li}].authorization`);
      }
    }
  });

  const sorted = sortErrors(errors);
  const byState = {};
  for (const key of sortedKeys(streams.reduce((acc, s) => ((acc[s.state] = true), acc), {}))) {
    byState[key] = streams.filter((s) => s.state === key).length;
  }

  return {
    ok: sorted.length === 0,
    errors: sorted,
    doc,
    stateBytes,
    stateSha256,
    repoRoot,
    schemaPath,
    summary: {
      streams: { total: streams.length, byState },
      errors: sorted.length,
      statePath,
      stateSha256,
    },
    nextActions: streams
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((s) => ({ streamId: s.id, nextAction: s.nextAction })),
    artifacts: collectArtifacts(streams),
  };
}

export function collectArtifacts(streams) {
  const entries = [];
  for (const stream of streams) {
    for (const artifact of stream.artifacts) {
      entries.push({ path: artifact.path, sha256: artifact.sha256 });
    }
  }
  entries.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.sha256 !== b.sha256) return a.sha256 < b.sha256 ? -1 : 1;
    return 0;
  });
  return entries;
}

export function sortErrors(errors) {
  return [...errors].sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    if (a.message !== b.message) return a.message < b.message ? -1 : 1;
    return 0;
  });
}

export function buildReport(result) {
  const ok = result.ok === true;
  return {
    status: ok ? "ok" : "fail",
    summary: result.summary || {
      streams: { total: 0, byState: {} },
      errors: result.errors.length,
      statePath: null,
      stateSha256: null,
    },
    nextActions: result.nextActions || [],
    artifacts: result.artifacts || [],
    errors: result.errors || [],
  };
}

export { isPlainObject };
