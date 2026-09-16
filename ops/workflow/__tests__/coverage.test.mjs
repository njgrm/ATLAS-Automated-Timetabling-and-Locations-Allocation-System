// Reachability coverage for the verifier's rule codes (closes WF-C01 residual R2).
//
// Every case mutates one valid state document (or its schema) and asserts the
// intended code is reported. Cases that require a Git failure or a schema
// keyword the shipped contract never uses are retained explicitly in the README
// rather than faked here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSharedRepo, stateDocFromFixture, verifyInProcess, SCHEMA_FILE, createTempRepo, cleanupRepo, writeStateDoc } from "./harness.mjs";
import { observabilityPaths, writeHeartbeat, buildHeartbeat } from "../lib/observability.mjs";
import { gitCommonDir } from "../lib/git.mjs";

const ISO = "2026-09-14T10:00:00+08:00";

function completeReview() {
  return {
    qaVerdict: "ACCEPT_READY",
    qaSessionId: "ses-qa",
    auditorVerdict: "AUDIT_CLEAR",
    auditorSessionId: "ses-aud",
    auditRequired: true,
    qaRounds: [{ round: 1, verdict: "ACCEPT_READY", sessionId: "ses-qa" }],
  };
}

// A gate-class shape whose five top-level counters are the exact class sums.
function classedGates(source, live = { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 }, deferred = { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 }) {
  const zero = () => ({ total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 });
  const classes = { MANDATORY_SOURCE: { ...source }, MANDATORY_LIVE: { ...live }, DEFERRED_EXTERNAL: { ...deferred } };
  const sum = (key) => classes.MANDATORY_SOURCE[key] + classes.MANDATORY_LIVE[key] + classes.DEFERRED_EXTERNAL[key];
  return {
    total: sum("total"),
    passed: sum("passed"),
    failed: sum("failed"),
    blocked: sum("blocked"),
    unperformed: sum("unperformed"),
    plan: { MANDATORY_SOURCE: classes.MANDATORY_SOURCE.total, MANDATORY_LIVE: classes.MANDATORY_LIVE.total, DEFERRED_EXTERNAL: classes.DEFERRED_EXTERNAL.total },
    classes,
  };
}

function runCase({ fixture = "pass-ordinary.json", mutate, schemaPatch, inRepo = true, commonDir }) {
  const repo = getSharedRepo();
  const doc = stateDocFromFixture(fixture, repo, mutate);
  let options = {};
  if (schemaPatch) {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
    schemaPatch(schema);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-schema-"));
    const schemaPath = path.join(dir, "schema.json");
    fs.writeFileSync(schemaPath, JSON.stringify(schema));
    options = { schemaPath };
  }
  if (commonDir !== undefined) options = { ...options, commonDir };
  const stateDir = inRepo ? repo.dir : fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-outside-"));
  const statePath = path.join(stateDir, `coverage-${process.pid}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(statePath, `${JSON.stringify(doc, null, 2)}\n`);
  const result = verifyInProcess(statePath, options);
  return result.errors.map((e) => e.code);
}

const CASES = [
  {
    code: "DUPLICATE_STREAM_ID",
    mutate: (d) => {
      d.streams.push(JSON.parse(JSON.stringify(d.streams[0])));
    },
  },
  {
    code: "CORRECTIONS_INVALID",
    mutate: (d, repo) => {
      d.streams[0].corrections = [
        { round: 1, baseSha: repo.baseSha, candidateSha: repo.candidateSha, reason: "r1", qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null },
        { round: 1, baseSha: repo.baseSha, candidateSha: repo.otherSha, reason: "r2", qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null },
      ];
    },
  },
  {
    code: "GIT_ANCESTRY",
    mutate: (d, repo) => {
      // base -> candidate is valid, but the candidate is not an ancestor of the
      // declared integration commit.
      d.streams[0].git.baseSha = repo.baseSha;
      d.streams[0].git.candidateSha = repo.candidateSha;
      d.streams[0].git.integrationSha = repo.otherSha;
      d.streams[0].git.changedPaths = ["candidate.txt"];
    },
  },
  {
    code: "GIT_SHA_UNKNOWN",
    mutate: (d, repo) => {
      d.streams[0].git.baseSha = repo.baseSha;
      d.streams[0].git.candidateSha = "0".repeat(40);
      d.streams[0].git.changedPaths = ["candidate.txt"];
    },
  },
  {
    code: "COMPLETE_MISSING_QA",
    mutate: (d) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
    },
  },
  {
    code: "COMPLETE_MISSING_AUDIT",
    mutate: (d) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
      d.streams[0].gates = classedGates({ total: 1, passed: 1, failed: 0, blocked: 0, unperformed: 0 });
      d.streams[0].review = {
        qaVerdict: "ACCEPT_READY",
        qaSessionId: "q",
        auditorVerdict: null,
        auditorSessionId: null,
        auditRequired: true,
        qaRounds: [{ round: 1, verdict: "ACCEPT_READY", sessionId: "q" }],
      };
    },
  },
  {
    code: "QA_ROUNDS_INCONSISTENT",
    mutate: (d) => {
      d.streams[0].review.qaVerdict = "ACCEPT_READY";
      d.streams[0].review.qaSessionId = "ses-qa";
      d.streams[0].review.qaRounds = [];
      d.streams[0].gates = classedGates({ total: 1, passed: 1, failed: 0, blocked: 0, unperformed: 0 });
    },
  },
  {
    code: "QA_ROUNDS_INCONSISTENT",
    mutate: (d) => {
      d.streams[0].review.qaVerdict = "ACCEPT_READY";
      d.streams[0].review.qaSessionId = "ses-qa-2";
      d.streams[0].review.qaRounds = [
        { round: 1, verdict: "ACCEPT_READY", sessionId: "ses-qa-1" },
        { round: 3, verdict: "ACCEPT_READY", sessionId: "ses-qa-2" },
      ];
      d.streams[0].gates = classedGates({ total: 1, passed: 1, failed: 0, blocked: 0, unperformed: 0 });
    },
  },
  {
    code: "COMPLETE_MANDATORY_GATES_UNPASSED",
    mutate: (d) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
      d.streams[0].closure = null;
      d.streams[0].gates = classedGates({ total: 1, passed: 1, failed: 0, blocked: 0, unperformed: 0 }, { total: 1, passed: 0, failed: 0, blocked: 0, unperformed: 1 });
      d.streams[0].review = {
        qaVerdict: "ACCEPT_READY",
        qaSessionId: "ses-qa",
        auditorVerdict: null,
        auditorSessionId: null,
        auditRequired: false,
        qaRounds: [{ round: 1, verdict: "ACCEPT_READY", sessionId: "ses-qa" }],
      };
    },
  },
  {
    code: "GATES_ARITHMETIC",
    mutate: (d) => {
      // Per-class arithmetic is internally consistent, but the class total does
      // not equal the top-level counter (W3 class-sum dimension).
      const gates = classedGates({ total: 2, passed: 2, failed: 0, blocked: 0, unperformed: 0 });
      gates.total = 3;
      d.streams[0].gates = gates;
    },
  },
  {
    code: "POST_CORRECTION_FRESH_AUDIT_MISSING",
    mutate: (d, repo) => {
      d.streams[0].state = "COMPLETE";
      d.streams[0].nextAction = null;
      d.streams[0].review = completeReview();
      d.streams[0].corrections = [
        { round: 1, baseSha: repo.baseSha, candidateSha: repo.candidateSha, reason: "r1", qaVerdict: "ACCEPT_READY", qaSessionId: "q1", auditorVerdict: null, auditorSessionId: null },
      ];
    },
  },
  {
    code: "HIGH_APPROVAL_INCOMPLETE",
    mutate: (d) => {
      d.streams[0].approval = { required: true, presentedReady: false, granted: true, operatorIdentity: null, approvedAt: null, boundary: null, approvedActions: [], requiredObservationIds: [], execution: null };
    },
  },
  {
    code: "HIGH_DEPENDENCY_MISSING",
    mutate: (d) => {
      d.streams[0].approval = { required: true, presentedReady: true, granted: false, operatorIdentity: null, approvedAt: null, boundary: null, approvedActions: [], requiredObservationIds: ["obs-missing"], execution: null };
    },
  },
  {
    code: "ARTIFACT_MISSING",
    mutate: (d) => {
      d.streams[0].artifacts = [{ path: "ops/workflow/does-not-exist.txt", sha256: "a".repeat(64) }];
    },
  },
  {
    code: "ARTIFACT_HASH_MISMATCH",
    mutate: (d, repo) => {
      fs.writeFileSync(path.join(repo.dir, "coverage-artifact.txt"), "artifact body\n");
      d.streams[0].artifacts = [{ path: "coverage-artifact.txt", sha256: "b".repeat(64) }];
    },
  },
  {
    code: "BLOCKER_KIND_MISMATCH",
    mutate: (d) => {
      d.streams[0].state = "EXTERNALLY_BLOCKED";
      d.streams[0].blocker = { kind: "NONE", detail: "", safeWorkRemaining: false, safeWorkItems: [] };
    },
  },
  {
    code: "BLOCKER_INCONSISTENT",
    mutate: (d) => {
      d.streams[0].blocker = { kind: "NONE", detail: "", safeWorkRemaining: true, safeWorkItems: [] };
    },
  },
  {
    code: "RUNNING_WITHOUT_LIVE_EVIDENCE",
    mutate: (d) => {
      // A RUNNING declaration with no ACTIVE lease and no heartbeat.
      d.leases = [];
    },
  },
  {
    code: "RESOLUTION_INCONSISTENT",
    mutate: (d) => {
      d.streams[0].resolution = {
        disposition: "CLOSED",
        resolver: "planner-cycle-owner",
        text: "resolved elsewhere",
        resolvedAt: ISO,
        supersededBy: null,
      };
    },
  },
  {
    code: "RESOLUTION_INCONSISTENT",
    mutate: (d) => {
      // SUPERSEDED with a null replacement is inconsistent independently of the
      // state comparison.
      d.streams[0].state = "SUPERSEDED";
      d.streams[0].resolution = {
        disposition: "SUPERSEDED",
        resolver: "planner-cycle-owner",
        text: "superseded without naming the replacement",
        resolvedAt: ISO,
        supersededBy: null,
      };
    },
  },
  {
    code: "RESOLUTION_SUPERSEDED_BY_UNKNOWN",
    mutate: (d) => {
      d.streams[0].state = "SUPERSEDED";
      d.streams[0].resolution = {
        disposition: "SUPERSEDED",
        resolver: "planner-cycle-owner",
        text: "superseded by an undefined stream",
        resolvedAt: ISO,
        supersededBy: "NOT-A-STREAM",
      };
    },
  },
  {
    code: "STATE_SCOPE_MISMATCH",
    mutate: (d) => {
      d.leases = [];
    },
    commonDir: "C:/nonexistent-foreign-scope",
  },
  {
    code: "WINDOW_INVALID",
    mutate: (d) => {
      d.registry.windows = [{ streamId: "ORD-1", fromRevision: 9, toRevision: 3, holder: "ORD-1", declaredAt: ISO }];
    },
  },
  {
    code: "WINDOW_UNKNOWN_STREAM",
    mutate: (d) => {
      d.registry.windows = [{ streamId: "NOT-A-STREAM", fromRevision: 1, toRevision: 3, holder: "NOT-A-STREAM", declaredAt: ISO }];
    },
  },
  {
    code: "GIT_REPO_UNAVAILABLE",
    inRepo: false,
    mutate: (d, repo) => {
      d.streams[0].git.baseSha = repo.baseSha;
      d.streams[0].git.candidateSha = repo.candidateSha;
      d.streams[0].git.changedPaths = ["candidate.txt"];
    },
  },
  {
    code: "ACTIVE_CYCLE_UNKNOWN",
    mutate: (d) => {
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "NOPE", globalNextAction: "continue" };
    },
  },
  {
    code: "ACTIVE_CYCLE_TERMINAL",
    mutate: (d) => {
      const closed = JSON.parse(JSON.stringify(d.streams[0]));
      closed.id = "CLOSED-1";
      closed.state = "CLOSED";
      closed.nextAction = null;
      closed.running = [];
      closed.awaited = [];
      d.streams.push(closed);
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "CLOSED-1", globalNextAction: "continue" };
    },
  },
  {
    code: "COORDINATION_MODE_CONFLICT",
    mutate: (d) => {
      d.coordination = { mode: "MANUAL", activeCycleId: "ORD-1", globalNextAction: null };
    },
  },
  {
    code: "COORDINATION_NEXT_ACTION_MISSING",
    mutate: (d) => {
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "ORD-1", globalNextAction: null };
    },
  },
  {
    code: "AWAITED_STATE_MISSING",
    mutate: (d) => {
      d.streams[0].running = [];
      d.streams[0].awaited = [];
      d.coordination = { mode: "CYCLE_ACTIVE", activeCycleId: "ORD-1", globalNextAction: "continue" };
    },
  },
  {
    code: "LOGIN_PROFILE_UNKNOWN",
    mutate: (d) => {
      d.browserCustody = {
        profiles: [],
        logins: [{ id: "login-1", owner: "qa", profilePath: "C:/unknown/profile", performed: false, performedAt: null, authorization: null, evidence: null }],
      };
    },
  },
  // ---- Schema-level codes ---------------------------------------------------
  {
    code: "SCHEMA_TYPE",
    mutate: (d) => {
      d.registry.lastUpdatedBy = 42;
    },
  },
  {
    code: "SCHEMA_ENUM",
    mutate: (d) => {
      d.streams[0].riskTier = "EXTREME";
    },
  },
  {
    code: "SCHEMA_CONST",
    mutate: (d) => {
      d.contractVersion = "9.9.9";
    },
  },
  {
    code: "SCHEMA_MINIMUM",
    mutate: (d) => {
      d.registry.revision = 0;
    },
  },
  {
    code: "SCHEMA_MIN_LENGTH",
    mutate: (d) => {
      d.streams[0].id = "";
    },
  },
  {
    code: "SCHEMA_FALSE_SCHEMA",
    schemaPatch: (schema) => {
      schema.properties.contractVersion = false;
    },
    mutate: () => {},
  },
  {
    code: "SCHEMA_INVALID",
    schemaPatch: (schema) => {
      schema.properties.contractVersion = 5;
    },
    mutate: () => {},
  },
  {
    code: "SCHEMA_REF",
    schemaPatch: (schema) => {
      schema.properties.contractVersion = { $ref: "#/$defs/does-not-exist" };
    },
    mutate: () => {},
  },
  {
    code: "SCHEMA_PATTERN_INVALID",
    schemaPatch: (schema) => {
      schema.properties.registry.properties.lastUpdatedBy = { type: "string", pattern: "([" };
    },
    mutate: () => {},
  },
];

for (const testCase of CASES) {
  test(`verifier code ${testCase.code} is reachable`, () => {
    const codes = runCase(testCase);
    assert.ok(codes.includes(testCase.code), `expected ${testCase.code}, got ${JSON.stringify(codes)}`);
  });
}

// ---- RUNNING live evidence: the negative case plus two positive controls ----
//
// The rule is an error, not a warning, and it must not fire when either form of
// machine evidence is present: an ACTIVE lease bound to the stream, or a
// heartbeat naming it inside the active window.
test("RUNNING_WITHOUT_LIVE_EVIDENCE fires on absence and stays silent on each evidence form", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const NOW = "2026-09-16T00:00:00.000Z";
  const baseDoc = () => stateDocFromFixture("pass-ordinary.json", repo, (d) => (d.registry.revision = 1));

  // Negative: no lease, no heartbeat.
  const barePath = writeStateDoc(repo, "evidence-bare.json", stateDocFromFixture("pass-ordinary.json", repo, (d) => { d.leases = []; }));
  const bare = verifyInProcess(barePath, { now: new Date(NOW) });
  assert.equal(bare.ok, false);
  assert.deepEqual(bare.errors.map((e) => e.code), ["RUNNING_WITHOUT_LIVE_EVIDENCE"]);

  // Positive control 1: the committed fixture's ACTIVE lease.
  const leasedPath = writeStateDoc(repo, "evidence-lease.json", baseDoc());
  const leased = verifyInProcess(leasedPath, { now: new Date(NOW) });
  assert.equal(leased.ok, true, JSON.stringify(leased.errors));
  assert.deepEqual(leased.errors, []);

  // Positive control 2: a fresh heartbeat in the document's own store.
  const paths = observabilityPaths(gitCommonDir(repo.dir));
  writeHeartbeat(paths, buildHeartbeat({ sessionId: "ses-fresh", role: "executor", stream: "ORD-1", status: "ACTIVE", updatedAt: NOW }, { now: NOW }));
  const fresh = verifyInProcess(barePath, { now: new Date(NOW) });
  assert.equal(fresh.ok, true, "a fresh heartbeat is live evidence");
  assert.deepEqual(fresh.errors, []);

  // Beyond the window it fires again, and widening the window admits it.
  const stale = verifyInProcess(barePath, { now: new Date(Date.parse(NOW) + 300001) });
  assert.deepEqual(stale.errors.map((e) => e.code), ["RUNNING_WITHOUT_LIVE_EVIDENCE"]);
  const widened = verifyInProcess(barePath, { now: new Date(Date.parse(NOW) + 300001), activeWindowMs: 600000 });
  assert.equal(widened.ok, true, "the configured window is what the rule reads");

  // An empty store is the fail-closed direction, and an unresolvable repository
  // is an empty store.
  const noRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc09-coverage-norepo-"));
  const noRepoPath = path.join(noRepoDir, "state.json");
  fs.writeFileSync(noRepoPath, `${JSON.stringify(JSON.parse(fs.readFileSync(barePath, "utf8")), null, 2)}\n`);
  const noRepo = verifyInProcess(noRepoPath, { now: new Date(NOW) });
  assert.deepEqual(noRepo.errors.map((e) => e.code), ["RUNNING_WITHOUT_LIVE_EVIDENCE"]);
  fs.rmSync(noRepoDir, { recursive: true, force: true });
});

// ---- `resolution` is optional: absent and null are both "not resolved" ----
test("a null or absent resolution fires no resolution rule", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const absent = stateDocFromFixture("pass-ordinary.json", repo, (d) => (d.registry.revision = 1));
  const absentPath = writeStateDoc(repo, "resolution-absent.json", absent);
  assert.equal(verifyInProcess(absentPath).ok, true, JSON.stringify(verifyInProcess(absentPath).errors));

  const nulled = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.streams[0].resolution = null;
  });
  const nulledPath = writeStateDoc(repo, "resolution-null.json", nulled);
  assert.equal(verifyInProcess(nulledPath).ok, true, JSON.stringify(verifyInProcess(nulledPath).errors));

  const resolved = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.streams[0].state = "CLOSED";
    d.streams[0].nextAction = null;
    d.streams[0].resolution = {
      disposition: "CLOSED",
      resolver: "planner-cycle-owner",
      text: "closed with no replacement",
      resolvedAt: ISO,
      supersededBy: null,
    };
  });
  const resolvedPath = writeStateDoc(repo, "resolution-consistent.json", resolved);
  const result = verifyInProcess(resolvedPath);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
