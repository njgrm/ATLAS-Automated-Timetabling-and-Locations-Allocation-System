// WF-C04 — atomic stream registration (`create-stream`).
//
// The transition is exercised through the real CLI and the real library entry
// point. Every rejection asserts byte-identical state, render, and receipt, so a
// rejected registration can never leave partial mutation behind. A synthetic
// fixture is admissible here because the input contract IS a JSON document: the
// stream schema itself is the producer, and the positive cases additionally run
// through the production verifier and renderer over a disposable Git repository.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  TRANSITION_CLI,
  VERIFY_CLI,
  STATUS_CLI,
  getSharedRepo,
  createTempRepo,
  createCleanRepo,
  cleanupRepo,
  runCli,
  errorCodes,
  stateDocFromFixture,
  writeStateDoc,
  writeJson,
  readJson,
  sha256,
} from "./harness.mjs";
import { runTransition } from "../lib/transition.mjs";
import { createGitMemo } from "../lib/git.mjs";
import { registerSnapshot } from "../lib/liveness.mjs";

const memo = createGitMemo();
const OBSERVED = null; // resolved per test from the disposable repository

const RENDER_REL = "docs/plans/atlas-active-delivery-streams.generated.md";

function readOrNull(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name === ".git" || entry.name === "node_modules")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

function noPartialFiles(repo, label) {
  assert.deepEqual(
    walk(repo.dir, (name) => name.includes(".tmp") || name.includes(".stage")),
    [],
    `${label} must leave no partial files`,
  );
}

// A complete, schema-correct stream record. `overrides` replaces whole nested
// objects so each control mutates exactly one contract surface.
function makeSpec(repo, overrides = {}) {
  const doc = stateDocFromFixture("pass-ordinary.json", repo);
  const spec = JSON.parse(JSON.stringify(doc.streams[0]));
  spec.id = "NEW-1";
  spec.kind = "STREAM";
  spec.riskTier = "LOW";
  spec.state = "REVIEW_REQUIRED";
  spec.nextAction = "Await fresh independent QA over the frozen candidate.";
  spec.awaited = ["fresh independent QA"];
  spec.running = [];
  spec.owners = {
    planner: { sessionId: null, status: "NONE", writable: false },
    executor: { sessionId: null, status: "NONE", writable: false },
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

function statePathFor(repo, name = "create-state.json") {
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
  });
  return writeStateDoc(repo, name, doc);
}

function specPathFor(repo, spec, name = "new-stream.json") {
  return writeJson(path.join(repo.dir, name), spec);
}

function inProcess(statePath, flags) {
  return runTransition({ statePath, transitionName: "create-stream", flags, gitMemo: memo });
}

function codesOf(report) {
  return (report.errors || []).map((e) => e.code);
}

function createFlags(repo, specPath, overrides = {}) {
  return {
    "stream-spec": specPath,
    "observed-origin-main": repo.integrationSha,
    "expect-revision": "1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Positive path

test("create-stream appends exactly one stream, increments the revision once, and preserves existing bytes", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));
  const specPath = specPathFor(repo, makeSpec(repo));

  const before = readJson(statePath);
  const result = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.equal(result.json.summary.created, true);
  assert.equal(result.json.summary.streamId, "NEW-1");
  assert.equal(result.json.summary.toState, "REVIEW_REQUIRED");
  assert.equal(result.json.summary.revision, 2);

  const after = readJson(statePath);
  assert.equal(after.streams.length, before.streams.length + 1);
  assert.equal(after.registry.revision, before.registry.revision + 1);

  // Every pre-existing stream survives with identical semantics.
  for (const prior of before.streams) {
    const found = after.streams.find((s) => s.id === prior.id);
    assert.ok(found, `${prior.id} must survive`);
    assert.deepEqual(found, prior, `${prior.id} must be byte-equivalent`);
  }

  const created = after.streams.find((s) => s.id === "NEW-1");
  assert.equal(created.git.remoteObservation.ref, "refs/remotes/origin/main");
  assert.equal(created.git.remoteObservation.sha, repo.integrationSha);
  assert.equal(created.git.remoteObservation.kind, "REMOTE_TRACKING_REF");
  assert.match(created.git.remoteObservation.observedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(created.git.remoteObservation.observedAt, created.stateUpdatedAt, "the tool owns both timestamps");

  // The rendered register is published with the state and matches the renderer.
  assert.ok(fs.existsSync(renderPath), "the render must be published atomically with the state");
  const check = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.equal(check.json.summary.streams.total, before.streams.length + 1);
  assert.deepEqual(check.json.errors, []);
  noPartialFiles(repo, "a successful create-stream");
});

test("create-stream state and render bytes are byte-identical across repeated runs", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const specPath = specPathFor(repo, makeSpec(repo));
  const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));
  const pinned = "2026-09-15T00:00:00.000Z";

  // The transition timestamp is pinned through the engine's `now` parameter so
  // the comparison proves determinism rather than comparing two wall clocks.
  const states = [];
  const renders = [];
  for (const name of ["a", "b"]) {
    const statePath = writeStateDoc(repo, `state-${name}.json`, stateDocFromFixture("pass-ordinary.json", repo, (d) => (d.registry.revision = 1)));
    const result = runTransition({ statePath, transitionName: "create-stream", flags: createFlags(repo, specPath), now: pinned, gitMemo: memo });
    assert.equal(result.status, "ok", JSON.stringify(result.errors));
    states.push(fs.readFileSync(statePath));
    renders.push(fs.readFileSync(renderPath));
    assert.equal(result.artifacts[0].sha256, sha256(fs.readFileSync(renderPath)), "the reported artifact hash must match the published bytes");
  }
  assert.deepEqual(states[0], states[1], "state bytes must be deterministic for identical input");
  assert.deepEqual(renders[0], renders[1], "render bytes must be byte-identical across repeated runs");
});

test("repeating a successful create-stream fails as a duplicate and never overwrites", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const specPath = specPathFor(repo, makeSpec(repo));

  const first = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const committed = fs.readFileSync(statePath);
  const renderCommitted = fs.readFileSync(path.join(repo.dir, ...RENDER_REL.split("/")));

  const retry = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "2", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(retry.status, 1);
  assert.deepEqual(errorCodes(retry), ["CREATE_SPEC_DUPLICATE_ID"]);
  const after = readJson(statePath);
  assert.equal(after.streams.filter((s) => s.id === "NEW-1").length, 1, "exactly one record must exist");
  assert.deepEqual(fs.readFileSync(statePath), committed, "the duplicate retry must not rewrite the state");
  assert.deepEqual(fs.readFileSync(path.join(repo.dir, ...RENDER_REL.split("/"))), renderCommitted, "the duplicate retry must not rewrite the render");
});

// ---------------------------------------------------------------------------
// Input-surface rejections (zero mutation)

test("create-stream rejects stale revisions, malformed specs, unknown keys, and bad observations with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const cases = [
    {
      name: "stale expected revision",
      spec: () => makeSpec(repo),
      flags: { "expect-revision": "99" },
      code: "TRANSITION_STALE_REVISION",
    },
    {
      name: "unreadable spec path",
      specPathOverride: path.join(repo.dir, "absent-spec.json"),
      flags: {},
      code: "CREATE_SPEC_UNREADABLE",
    },
    {
      name: "spec that is not one object",
      specRaw: "[1, 2, 3]\n",
      flags: {},
      code: "CREATE_SPEC_NOT_OBJECT",
    },
    {
      name: "unknown key anywhere in the record",
      spec: () => ({ ...makeSpec(repo), unexpectedKey: true }),
      flags: {},
      code: "CREATE_SPEC_UNKNOWN_KEY",
    },
    {
      name: "nested unknown key",
      spec: () => ({ ...makeSpec(repo), git: { ...makeSpec(repo).git, surprise: 1 } }),
      flags: {},
      code: "CREATE_SPEC_UNKNOWN_KEY",
    },
    {
      name: "schema-incomplete record",
      spec: () => {
        const s = makeSpec(repo);
        delete s.gates;
        return s;
      },
      flags: {},
      code: "CREATE_SPEC_INVALID",
    },
    {
      name: "malformed ignored value in an enum field",
      spec: () => ({ ...makeSpec(repo), riskTier: "EXTREME" }),
      flags: {},
      code: "CREATE_SPEC_INVALID",
    },
    {
      name: "contradictory non-null remoteObservation",
      spec: () => ({
        ...makeSpec(repo),
        git: { ...makeSpec(repo).git, remoteObservation: { ref: "refs/remotes/origin/main", sha: repo.integrationSha, observedAt: "2026-09-15T00:00:00Z", kind: "REMOTE_TRACKING_REF" } },
      }),
      flags: {},
      code: "CREATE_SPEC_REMOTE_OBSERVATION_CONTRADICTORY",
    },
    {
      name: "malformed observed origin/main",
      spec: () => makeSpec(repo),
      flags: { "observed-origin-main": "NOT-A-SHA" },
      code: "CREATE_SPEC_OBSERVED_SHA_INVALID",
    },
    {
      name: "unknown observed origin/main commit",
      spec: () => makeSpec(repo),
      flags: { "observed-origin-main": "0".repeat(40) },
      code: "CREATE_SPEC_OBSERVED_SHA_UNKNOWN",
    },
    {
      name: "duplicate stream id",
      spec: () => ({ ...makeSpec(repo), id: "ORD-1" }),
      flags: {},
      code: "CREATE_SPEC_DUPLICATE_ID",
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    const statePath = statePathFor(repo, `reject-${index}-${testCase.code}.json`);
    const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));
    const specPath =
      testCase.specPathOverride !== undefined
        ? testCase.specPathOverride
        : testCase.specRaw !== undefined
          ? (() => {
              const p = path.join(repo.dir, "raw-spec.json");
              fs.writeFileSync(p, testCase.specRaw);
              return p;
            })()
          : specPathFor(repo, testCase.spec(), "case-spec.json");

    const stateBefore = fs.readFileSync(statePath);
    const renderBefore = readOrNull(renderPath);

    const result = inProcess(statePath, createFlags(repo, specPath, testCase.flags));
    assert.equal(result.status, "fail", `${testCase.name} must fail: ${JSON.stringify(result.errors)}`);
    assert.ok(codesOf(result).includes(testCase.code), `${testCase.name} must report ${testCase.code}, got ${JSON.stringify(codesOf(result))}`);
    assert.deepEqual(fs.readFileSync(statePath), stateBefore, `${testCase.name} must not mutate state`);
    assert.deepEqual(readOrNull(renderPath), renderBefore, `${testCase.name} must not mutate the render`);
    noPartialFiles(repo, testCase.name);
  }
});

test("create-stream rejects credential-shaped content without echoing the value", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const secret = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const spec = makeSpec(repo);
  spec.nextAction = `Continue after rotating ${secret}.`;
  const specPath = specPathFor(repo, spec);
  const stateBefore = fs.readFileSync(statePath);

  const result = inProcess(statePath, createFlags(repo, specPath));
  assert.equal(result.status, "fail");
  assert.deepEqual(codesOf(result), ["CREATE_SPEC_SECRET_CONTENT"]);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(secret), false, "the credential value must never be echoed");
  assert.equal(serialized.includes("ABCDEFGHIJKLMNOP"), false, "no credential fragment may be echoed");
  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "a secret-bearing spec must not mutate state");
  noPartialFiles(repo, "a secret-bearing spec");
});

// ---------------------------------------------------------------------------
// Claim/evidence and normal-pipeline semantic rejections

test("create-stream requires an evidenced claim and never invents session identity", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const cases = [
    {
      name: "RUNNING without named work",
      spec: () => ({ ...makeSpec(repo), state: "RUNNING", running: [] }),
    },
    {
      name: "PLANNED with named running work",
      spec: () => ({ ...makeSpec(repo), state: "PLANNED", running: ["something is running"] }),
    },
    {
      name: "ACTIVE owner without a sessionId",
      spec: () => {
        const s = makeSpec(repo);
        s.owners = { ...s.owners, qa: { sessionId: null, status: "ACTIVE", writable: false } };
        return s;
      },
    },
  ];

  for (const testCase of cases) {
    const statePath = statePathFor(repo, `claim-${testCase.name.replace(/\W+/g, "-")}.json`);
    const specPath = specPathFor(repo, testCase.spec(), "claim-spec.json");
    const stateBefore = fs.readFileSync(statePath);

    const result = inProcess(statePath, createFlags(repo, specPath));
    assert.equal(result.status, "fail", `${testCase.name} must fail`);
    assert.deepEqual(codesOf(result), ["CREATE_SPEC_CLAIM_INCONSISTENT"], testCase.name);
    assert.deepEqual(fs.readFileSync(statePath), stateBefore, `${testCase.name} must not mutate state`);
  }
});

test("create-stream rejects unknown or contradictory Git identity through the normal verifier", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const cases = [
    {
      name: "unknown candidate sha",
      git: { worktree: null, branch: "b", baseSha: repo.baseSha, candidateSha: "0".repeat(40), integrationSha: null, changedPaths: ["candidate.txt"], remoteObservation: null },
      code: "GIT_SHA_UNKNOWN",
    },
    {
      name: "broken base -> candidate ancestry",
      git: { worktree: null, branch: "b", baseSha: repo.otherSha, candidateSha: repo.candidateSha, integrationSha: null, changedPaths: ["candidate.txt"], remoteObservation: null },
      code: "GIT_ANCESTRY",
    },
    {
      name: "changedPaths that do not match the diff",
      git: { worktree: null, branch: "b", baseSha: repo.baseSha, candidateSha: repo.candidateSha, integrationSha: null, changedPaths: ["candidate.txt", "extra.txt"], remoteObservation: null },
      code: "CHANGED_PATHS_MISMATCH",
    },
  ];

  for (const testCase of cases) {
    const statePath = statePathFor(repo, `git-${testCase.code}.json`);
    const specPath = specPathFor(repo, makeSpec(repo, { git: testCase.git }), "git-spec.json");
    const stateBefore = fs.readFileSync(statePath);

    const result = inProcess(statePath, createFlags(repo, specPath));
    assert.equal(result.status, "fail", `${testCase.name} must fail`);
    assert.deepEqual(codesOf(result), ["TRANSITION_RESULT_INVALID"], testCase.name);
    assert.ok(result.errors[0].message.includes(testCase.code), `${testCase.name} must name ${testCase.code}: ${result.errors[0].message}`);
    assert.deepEqual(fs.readFileSync(statePath), stateBefore, `${testCase.name} must not mutate state`);
  }
});

test("a HIGH spec cannot bypass the existing approval and dependency rules", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const execution = makeSpec(repo, {
    riskTier: "HIGH",
    approval: {
      required: true,
      presentedReady: false,
      granted: false,
      operatorIdentity: null,
      approvedAt: null,
      boundary: null,
      approvedActions: [],
      requiredObservationIds: [],
      execution: { performed: true, actionsPerformed: ["restart the shared runtime"], evidence: null },
    },
  });

  const statePath = statePathFor(repo, "high-state.json");
  const specPath = specPathFor(repo, execution, "high-spec.json");
  const stateBefore = fs.readFileSync(statePath);

  const result = inProcess(statePath, createFlags(repo, specPath));
  assert.equal(result.status, "fail", "a HIGH stream executed without approval must be rejected");
  assert.deepEqual(codesOf(result), ["TRANSITION_RESULT_INVALID"]);
  assert.ok(result.errors[0].message.includes("HIGH_EXECUTION_WITHOUT_APPROVAL"), result.errors[0].message);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "the rejected HIGH spec must not mutate state");
  noPartialFiles(repo, "a HIGH spec without approval");
});

test("a PLANNED record cannot own a dirty worktree, and an ACTIVE lease still blocks PLANNED", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const dirty = createCleanRepo();
  t.after(() => cleanupRepo(dirty));
  fs.writeFileSync(path.join(dirty, "untracked-work.txt"), "in progress\n");

  // Real production path: create-stream runs the created record through the
  // verifier, so a PLANNED record with a dirty owned worktree fails closed.
  const statePath = statePathFor(repo, "planned-dirty-state.json");
  const specPath = specPathFor(
    repo,
    makeSpec(repo, {
      state: "PLANNED",
      running: [],
      git: { worktree: dirty, branch: "work/dirty", baseSha: repo.baseSha, candidateSha: repo.candidateSha, integrationSha: null, changedPaths: ["candidate.txt"], remoteObservation: null },
    }),
    "planned-dirty-spec.json",
  );
  const stateBefore = fs.readFileSync(statePath);
  const result = inProcess(statePath, createFlags(repo, specPath));
  assert.equal(result.status, "fail", "PLANNED + dirty worktree must fail closed");
  assert.deepEqual(codesOf(result), ["TRANSITION_RESULT_INVALID"]);
  assert.ok(result.errors[0].message.includes("PLANNED_WITH_DIRTY_WORKTREE"), result.errors[0].message);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore);
  noPartialFiles(repo, "PLANNED plus a dirty worktree");

  // The same invariant on the final document: a PLANNED stream that names an
  // ACTIVE lease is rejected even though create-stream itself never writes leases.
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.streams[0].state = "PLANNED";
    d.streams[0].running = [];
    d.streams[0].owners = {
      planner: { sessionId: null, status: "NONE", writable: false },
      executor: { sessionId: null, status: "NONE", writable: false },
      qa: { sessionId: null, status: "NONE", writable: false },
      auditor: { sessionId: null, status: "NONE", writable: false },
    };
    d.leases = [{ id: "lease-x", streamId: "ORD-1", worktree: null, role: "executor", sessionId: "ses-x", state: "ACTIVE", revision: 1, updatedAt: "2026-09-15T00:00:00Z", expiresAt: null }];
  });
  const leasePath = writeStateDoc(repo, "planned-lease-state.json", doc);
  const leaseVerify = runCli(VERIFY_CLI, ["--state", leasePath], { cwd: repo.dir });
  assert.equal(leaseVerify.status, 1);
  assert.ok(errorCodes(leaseVerify).includes("PLANNED_WITH_LIVE_LEASE"), JSON.stringify(errorCodes(leaseVerify)));
});

// ---------------------------------------------------------------------------
// CLI usage contract

test("create-stream usage errors exit 2 and non-applicable flags fail closed", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const specPath = specPathFor(repo, makeSpec(repo));

  const missingSpec = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(missingSpec.status, 2);
  assert.deepEqual(errorCodes(missingSpec), ["USAGE_MISSING_STREAM_SPEC"]);

  const duplicateSpec = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream-spec", specPath, "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(duplicateSpec.status, 2);
  assert.deepEqual(errorCodes(duplicateSpec), ["USAGE_DUPLICATE_FLAG"]);

  const duplicateRevision = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--expect-revision", "2", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(duplicateRevision.status, 2);
  assert.deepEqual(errorCodes(duplicateRevision), ["USAGE_DUPLICATE_FLAG"]);

  const prohibited = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha, "--manifest", "x.json"],
    { cwd: repo.dir },
  );
  assert.equal(prohibited.status, 2);
  assert.deepEqual(errorCodes(prohibited), ["USAGE_UNKNOWN_FLAG"]);

  // --stream is a known flag but names an existing stream: not applicable here.
  const notApplicable = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream", "ORD-1", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(notApplicable.status, 1);
  assert.deepEqual(errorCodes(notApplicable), ["TRANSITION_FLAG_NOT_APPLICABLE"]);

  assert.equal(readJson(statePath).streams.length, 1, "no usage error may mutate the state");
  noPartialFiles(repo, "the usage-error matrix");
});

// ---------------------------------------------------------------------------
// Atomicity under injected faults and concurrency

test("injected faults and lock contention leave state, render, and receipt byte-identical", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));
  const receiptsDir = path.join(repo.dir, "docs", "plans", "receipts");
  const specPath = specPathFor(repo, makeSpec(repo), "fault-spec-base.json");

  const first = inProcess(statePath, createFlags(repo, specPath, { "expect-revision": "1" }));
  assert.equal(first.status, "ok", JSON.stringify(first.errors));
  const stateBefore = fs.readFileSync(statePath);
  const renderBefore = fs.readFileSync(renderPath);
  assert.equal(fs.existsSync(receiptsDir), false, "create-stream mints no receipt at all");

  // A fault run needs a fresh id: the duplicate-id gate runs during apply, so a
  // reused spec would be rejected before the injected fault could be reached.
  let nextId = 0;
  const freshSpec = () => {
    nextId += 1;
    return specPathFor(repo, makeSpec(repo, { id: `NEW-FAULT-${nextId}` }), `fault-spec-${nextId}.json`);
  };

  try {
    // Lock contention is produced by holding the lock in this process, exactly
    // as a concurrent creator would.
    const lockPath = path.join(repo.dir, ".git", "atlas-workflow.lock");
    fs.writeFileSync(lockPath, `${JSON.stringify({ ownerPid: process.pid, transition: "test-holder" })}\n`);
    const contention = inProcess(statePath, createFlags(repo, freshSpec(), { "expect-revision": "2" }));
    assert.equal(contention.status, "fail");
    assert.deepEqual(codesOf(contention), ["LOCK_CONTENTION"]);
    assert.deepEqual(fs.readFileSync(statePath), stateBefore, "lock contention must not mutate state");
    assert.deepEqual(fs.readFileSync(renderPath), renderBefore, "lock contention must not mutate the render");
    fs.unlinkSync(lockPath);

    for (const fault of ["AFTER_LOCK", "STAGE_STATE", "STAGE_RENDER", "VERIFY_RENDERED"]) {
      process.env.ATLAS_WORKFLOW_FAULT = fault;
      const result = inProcess(statePath, createFlags(repo, freshSpec(), { "expect-revision": "2" }));
      assert.equal(result.status, "fail", `${fault} must fail`);
      assert.deepEqual(codesOf(result), ["FAULT_INJECTED"], fault);
      assert.deepEqual(fs.readFileSync(statePath), stateBefore, `${fault} must not change state bytes`);
      assert.deepEqual(fs.readFileSync(renderPath), renderBefore, `${fault} must not change render bytes`);
    }

    // STAGE_RECEIPT is unreachable for create-stream: the transition mints no
    // receipt, so the injected fault is never reached and the create completes.
    process.env.ATLAS_WORKFLOW_FAULT = "STAGE_RECEIPT";
    const receiptStage = inProcess(statePath, createFlags(repo, freshSpec(), { "expect-revision": "2" }));
    assert.equal(receiptStage.status, "ok", `STAGE_RECEIPT must be unreachable for create-stream: ${JSON.stringify(receiptStage.errors)}`);
    assert.equal(receiptStage.artifacts.length, 1, "only the render is published");
    assert.equal(receiptStage.artifacts[0].path, RENDER_REL);
    assert.equal(receiptStage.summary.receiptPath, null, "create-stream never mints a receipt");
    assert.equal(fs.existsSync(receiptsDir), false, "no receipt file may appear");
  } finally {
    delete process.env.ATLAS_WORKFLOW_FAULT;
  }
  noPartialFiles(repo, "the fault-injection matrix");
});

test("two concurrent creators yield one winner and one typed loser with no partial files", async (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const specPath = specPathFor(repo, makeSpec(repo));
  const args = ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha];

  const spawnCreator = () =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [TRANSITION_CLI, ...args], {
        env: { ...process.env, ATLAS_WORKFLOW_LOCK_HOLD_MS: "900" },
        windowsHide: true,
      });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => {
        let json = null;
        try {
          json = JSON.parse(out);
        } catch {
          json = null;
        }
        resolve({ code, json, out });
      });
    });

  const results = await Promise.all([spawnCreator(), spawnCreator()]);
  const winners = results.filter((r) => r.json && r.json.status === "ok");
  const losers = results.filter((r) => r.json && r.json.status === "fail");
  assert.equal(winners.length, 1, JSON.stringify(results.map((r) => r.out)));
  assert.equal(losers.length, 1, JSON.stringify(results.map((r) => r.out)));
  const loserCodes = (losers[0].json.errors || []).map((e) => e.code);
  assert.ok(
    loserCodes.includes("LOCK_CONTENTION") || loserCodes.includes("TRANSITION_STALE_REVISION"),
    `the loser must carry a typed contention/CAS error, got ${JSON.stringify(loserCodes)}`,
  );

  const doc = readJson(statePath);
  assert.equal(doc.registry.revision, 2, "exactly one create-stream may commit");
  assert.equal(doc.streams.filter((s) => s.id === "NEW-1").length, 1);
  assert.equal(fs.existsSync(path.join(repo.dir, ".git", "atlas-workflow.lock")), false, "the winner released its lock");
  noPartialFiles(repo, "the concurrency control");
});

// ---------------------------------------------------------------------------
// The created stream is visible through the canonical registry only

test("the created stream is read through the canonical registry with no second list", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = statePathFor(repo);
  const specPath = specPathFor(repo, makeSpec(repo));

  const created = runCli(
    TRANSITION_CLI,
    ["--state", statePath, "--transition", "create-stream", "--expect-revision", "1", "--stream-spec", specPath, "--observed-origin-main", repo.integrationSha],
    { cwd: repo.dir },
  );
  assert.equal(created.status, 0, created.stdout + created.stderr);

  const doc = readJson(statePath);
  const snapshot = registerSnapshot(doc);
  assert.ok(snapshot.byId.has("NEW-1"), "the register snapshot must include the created stream");
  assert.equal(snapshot.byId.get("NEW-1").state, "REVIEW_REQUIRED");
  assert.equal(snapshot.byId.size, doc.streams.length, "the snapshot is derived from streams[], not a private list");

  const commonDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc04-common-"));
  t.after(() => fs.rmSync(commonDir, { recursive: true, force: true }));
  const status = runCli(STATUS_CLI, ["--state", statePath, "--json", "--common-dir", commonDir], { cwd: repo.dir });
  assert.equal(status.status, 0, status.stdout + status.stderr);
  assert.equal(status.json.summary.registerRevision, doc.registry.revision);
  const nextActionScopes = status.json.nextActions.map((entry) => entry.scope);
  assert.ok(nextActionScopes.includes("NEW-1"), "workflow:status must surface the created stream's next action");
});
