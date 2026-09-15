// WF-C04 R1 — the created-stream integration lifecycle.
//
// `create-stream` stores the tip that was observed BEFORE the stream was
// integrated. The verifier requires `integrationSha` to be an ancestor-or-equal
// of `remoteObservation.sha`, and `record-remote-observation` is gated to
// INTEGRATED/COMPLETE, so without a refresh at integration every created stream
// is un-integrable. These controls reproduce that failure first, then prove the
// bounded `record-integration --observed-remote` remedy, its typed rejections,
// and the unchanged behavior for streams whose observation is null.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TRANSITION_CLI,
  VERIFY_CLI,
  createTempRepo,
  cleanupRepo,
  runCli,
  stateDocFromFixture,
  writeStateDoc,
  readJson,
} from "./harness.mjs";
import { runTransition } from "../lib/transition.mjs";
import { createGitMemo } from "../lib/git.mjs";

const memo = createGitMemo();
const RENDER_REL = "docs/plans/atlas-active-delivery-streams.generated.md";
const OBSERVATION_REF = "refs/remotes/origin/main";

function readOrNull(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function codesOf(report) {
  return (report.errors || []).map((e) => e.code);
}

// A schema-complete RUNNING record whose per-term identity is real for the
// disposable repository, so `create-stream` accepts it and the lifecycle can
// advance through record-executor-return.
function runningSpec(repo, overrides = {}) {
  const doc = stateDocFromFixture("pass-ordinary.json", repo);
  const spec = JSON.parse(JSON.stringify(doc.streams[0]));
  spec.id = "NEW-1";
  spec.kind = "STREAM";
  spec.riskTier = "MEDIUM";
  spec.state = "RUNNING";
  spec.nextAction = "Implement the bounded change and return REVIEW_REQUIRED.";
  spec.awaited = [];
  spec.running = ["executor implementation session"];
  spec.owners = {
    planner: { sessionId: null, status: "NONE", writable: false },
    executor: { sessionId: "ses-fixture-executor", status: "ACTIVE", writable: false },
    qa: { sessionId: null, status: "NONE", writable: false },
    auditor: { sessionId: null, status: "NONE", writable: false },
  };
  spec.gates = { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 };
  spec.review = { qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null, auditRequired: false };
  spec.git = {
    worktree: null,
    branch: "work/new-1",
    baseSha: repo.baseSha,
    candidateSha: repo.candidateSha,
    integrationSha: null,
    changedPaths: ["candidate.txt"],
    remoteObservation: null,
  };
  Object.assign(spec, overrides);
  return spec;
}

function writeSpec(repo, doc, name) {
  const filePath = path.join(repo.dir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`);
  return filePath;
}

function baseState(repo, name) {
  return writeStateDoc(repo, name, stateDocFromFixture("pass-ordinary.json", repo, (d) => (d.registry.revision = 1)));
}

function inProcess(statePath, transitionName, flags) {
  return runTransition({ statePath, transitionName, flags, gitMemo: memo });
}

// create-stream at a pre-integration observation, then drive the stream to
// ACCEPT_READY. Returns the path plus the revision at ACCEPT_READY.
function advanceToAcceptReady(repo, name) {
  const statePath = baseState(repo, name);
  const specPath = writeSpec(repo, runningSpec(repo), `spec-${name}`);

  const created = inProcess(statePath, "create-stream", {
    "stream-spec": specPath,
    "observed-origin-main": repo.candidateSha,
    "expect-revision": "1",
  });
  assert.equal(created.status, "ok", JSON.stringify(created.errors));
  assert.equal(created.summary.created, true);

  const returned = inProcess(statePath, "record-executor-return", {
    stream: "NEW-1",
    "expect-revision": "2",
    base: repo.baseSha,
    candidate: repo.candidateSha,
  });
  assert.equal(returned.status, "ok", JSON.stringify(returned.errors));

  const qa = inProcess(statePath, "record-qa-result", {
    stream: "NEW-1",
    "expect-revision": "3",
    "qa-verdict": "ACCEPT_READY",
    "qa-session": "ses-r1-qa",
    gates: "1/1/0/0/0",
  });
  assert.equal(qa.status, "ok", JSON.stringify(qa.errors));
  return statePath;
}

// ---------------------------------------------------------------------------
// Failing-first: the real integration defect

test("a creation-time observation makes the stream un-integrable until it is refreshed", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = advanceToAcceptReady(repo, "state-failing-first.json");
  const doc = readJson(statePath);
  const stream = doc.streams.find((s) => s.id === "NEW-1");
  assert.equal(stream.state, "ACCEPT_READY");
  assert.equal(stream.git.remoteObservation.sha, repo.candidateSha, "the creation-time observation is the pre-integration tip");
  assert.equal(stream.git.integrationSha, null);

  const stateBefore = fs.readFileSync(statePath);
  const renderBefore = readOrNull(path.join(repo.dir, ...RENDER_REL.split("/")));

  const result = inProcess(statePath, "record-integration", { stream: "NEW-1", "expect-revision": "4", integration: repo.integrationSha });
  assert.equal(result.status, "fail", "integration without a refresh must fail closed");
  assert.deepEqual(codesOf(result), ["TRANSITION_RESULT_INVALID"], JSON.stringify(result.errors));
  assert.match(result.errors[0].message, /REMOTE_OBSERVATION_INVALID/);
  assert.match(result.errors[0].message, /is not an ancestor-or-equal of observed remote sha/);

  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "the rejected integration must not mutate state");
  assert.deepEqual(readOrNull(path.join(repo.dir, ...RENDER_REL.split("/"))), renderBefore, "the rejected integration must not mutate the render");
  assert.equal(readJson(statePath).registry.revision, 4, "the revision must not advance");
});

// ---------------------------------------------------------------------------
// Positive lifecycle through the real CLI

test("record-integration --observed-remote refreshes the observation and completes the created-stream lifecycle", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = advanceToAcceptReady(repo, "state-lifecycle.json");
  const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));

  // Real CLI process: the new flags must be accepted end to end.
  const result = runCli(
    TRANSITION_CLI,
    [
      "--state", statePath,
      "--transition", "record-integration",
      "--stream", "NEW-1",
      "--expect-revision", "4",
      "--integration", repo.integrationSha,
      "--observed-remote", repo.integrationSha,
    ],
    { cwd: repo.dir },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.equal(result.json.summary.toState, "INTEGRATED");
  assert.equal(result.json.summary.revision, 5);

  // The refreshed observation is echoed in the summary and stored on the stream.
  assert.deepEqual(result.json.summary.observation, {
    ref: OBSERVATION_REF,
    sha: repo.integrationSha,
    observedAt: result.json.summary.observation.observedAt,
    kind: "REMOTE_TRACKING_REF",
  });

  const doc = readJson(statePath);
  const stream = doc.streams.find((s) => s.id === "NEW-1");
  assert.equal(stream.state, "INTEGRATED");
  assert.equal(stream.git.integrationSha, repo.integrationSha);
  assert.equal(stream.git.remoteObservation.ref, OBSERVATION_REF);
  // The observation sha MAY equal the integration sha: observing the integration
  // commit itself is a valid downstream-or-equal snapshot.
  assert.equal(stream.git.remoteObservation.sha, repo.integrationSha);
  assert.equal(stream.git.remoteObservation.kind, "REMOTE_TRACKING_REF");
  assert.match(stream.git.remoteObservation.observedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.notEqual(stream.git.remoteObservation.sha, repo.candidateSha, "the stale creation-time tip must be replaced");

  // A downstream commit strictly past the integration is also accepted.
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.deepEqual(verified.json.errors, []);
  assert.ok(fs.existsSync(renderPath), "the render must be published with the integrated state");
});

test("a past-integration observation is accepted and an alternate ref keeps its kind", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = advanceToAcceptReady(repo, "state-past-integration.json");

  // refs/heads/main is the integration commit itself; the kind must be LOCAL_REF.
  const result = inProcess(statePath, "record-integration", {
    stream: "NEW-1",
    "expect-revision": "4",
    integration: repo.integrationSha,
    "observed-remote": repo.integrationSha,
    "observed-ref": "refs/heads/main",
  });
  assert.equal(result.status, "ok", JSON.stringify(result.errors));
  assert.equal(result.summary.observation.kind, "LOCAL_REF");
  assert.equal(result.summary.observation.ref, "refs/heads/main");

  const stream = readJson(statePath).streams.find((s) => s.id === "NEW-1");
  assert.equal(stream.git.remoteObservation.kind, "LOCAL_REF");
  assert.equal(stream.git.remoteObservation.sha, repo.integrationSha);
});

// ---------------------------------------------------------------------------
// Negative controls for the refresh flags

test("record-integration rejects malformed, unknown, and non-downstream observations with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const cases = [
    { name: "malformed value", observed: "NOT-A-SHA", code: "TRANSITION_OBSERVED_REMOTE_INVALID" },
    { name: "uppercase value", observed: repo.integrationSha.toUpperCase(), code: "TRANSITION_OBSERVED_REMOTE_INVALID" },
    { name: "unknown commit", observed: "0".repeat(40), code: "TRANSITION_OBSERVED_REMOTE_UNKNOWN" },
    {
      name: "orphan commit that does not contain the integration",
      observed: repo.otherSha,
      code: "TRANSITION_OBSERVED_REMOTE_ANCESTRY",
    },
    {
      name: "ancestor of the integration",
      observed: repo.baseSha,
      code: "TRANSITION_OBSERVED_REMOTE_ANCESTRY",
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    const statePath = advanceToAcceptReady(repo, `state-reject-${index}.json`);
    const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));
    const stateBefore = fs.readFileSync(statePath);
    const renderBefore = readOrNull(renderPath);

    const result = inProcess(statePath, "record-integration", {
      stream: "NEW-1",
      "expect-revision": "4",
      integration: repo.integrationSha,
      "observed-remote": testCase.observed,
    });
    assert.equal(result.status, "fail", `${testCase.name} must fail`);
    assert.deepEqual(codesOf(result), [testCase.code], `${testCase.name}: ${JSON.stringify(result.errors)}`);
    assert.deepEqual(fs.readFileSync(statePath), stateBefore, `${testCase.name} must not mutate state`);
    assert.deepEqual(readOrNull(renderPath), renderBefore, `${testCase.name} must not mutate the render`);
  }
});

test("--observed-remote is not applicable to other transitions", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = baseState(repo, "state-not-applicable.json");
  const result = inProcess(statePath, "create-stream", {
    "stream-spec": writeSpec(repo, runningSpec(repo), "spec-na.json"),
    "observed-origin-main": repo.candidateSha,
    "expect-revision": "1",
    "observed-remote": repo.integrationSha,
  });
  assert.equal(result.status, "fail");
  assert.deepEqual(codesOf(result), ["TRANSITION_FLAG_NOT_APPLICABLE"]);
  assert.equal(readJson(statePath).registry.revision, 1, "the rejected flag must not mutate state");
});

// ---------------------------------------------------------------------------
// Regression: null-observation streams are unchanged

test("a stream whose observation is null still integrates without the flag", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.streams[0].state = "ACCEPT_READY";
    d.streams[0].running = [];
    d.streams[0].nextAction = "Integrate the accepted candidate.";
    d.streams[0].owners = {
      planner: { sessionId: null, status: "NONE", writable: false },
      executor: { sessionId: null, status: "NONE", writable: false },
      qa: { sessionId: null, status: "NONE", writable: false },
      auditor: { sessionId: null, status: "NONE", writable: false },
    };
    d.streams[0].gates = { total: 2, passed: 2, failed: 0, blocked: 0, unperformed: 0 };
    d.streams[0].review = { qaVerdict: "ACCEPT_READY", qaSessionId: "ses-existing-qa", auditorVerdict: null, auditorSessionId: null, auditRequired: false };
    d.streams[0].git = {
      worktree: null,
      branch: "work/ordinary",
      baseSha: repo.baseSha,
      candidateSha: repo.candidateSha,
      integrationSha: null,
      changedPaths: ["candidate.txt"],
      remoteObservation: null,
    };
  });
  const statePath = writeStateDoc(repo, "state-null-observation.json", doc);

  const result = inProcess(statePath, "record-integration", { stream: "ORD-1", "expect-revision": "1", integration: repo.integrationSha });
  assert.equal(result.status, "ok", JSON.stringify(result.errors));
  assert.equal(result.summary.toState, "INTEGRATED");
  assert.equal(result.summary.observation, undefined, "no refresh is reported when the flag is absent");

  const stream = readJson(statePath).streams.find((s) => s.id === "ORD-1");
  assert.equal(stream.git.integrationSha, repo.integrationSha);
  assert.equal(stream.git.remoteObservation, null, "an absent observation must stay absent");
});

test("record-remote-observation keeps its INTEGRATED/COMPLETE gate", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = advanceToAcceptReady(repo, "state-gate.json");

  const result = inProcess(statePath, "record-remote-observation", {
    stream: "NEW-1",
    "expect-revision": "4",
    ref: OBSERVATION_REF,
    "observed-sha": repo.integrationSha,
  });
  assert.equal(result.status, "fail", "the post-integration refresh must not be opened to ACCEPT_READY");
  assert.deepEqual(codesOf(result), ["TRANSITION_INVALID_STATE"]);
  assert.equal(readJson(statePath).registry.revision, 4);
});
