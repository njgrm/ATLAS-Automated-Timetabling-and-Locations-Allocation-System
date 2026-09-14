// A2 — atomic, validated delivery-cycle state transitions.
//
// The engine is exercised in-process for the negative/CAS/lock/fault matrix (it
// is the same code the CLI calls), while the true CLI process contract is proven
// by the end-to-end lifecycle, the usage errors, and the concurrent-writer test.
// A shared read-only repository and Git memo keep every read-only fact resolved
// once (A6); dedicated repositories are used only where a test writes locks or
// asserts a pristine directory.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  TRANSITION_CLI,
  VERIFY_CLI,
  getSharedRepo,
  createTempRepo,
  cleanupRepo,
  runCli,
  stateDocFromFixture,
  writeStateDoc,
  verifyInProcess,
} from "./harness.mjs";
import { runTransition } from "../lib/transition.mjs";
import { lockPathFor } from "../lib/lock.mjs";
import { createGitMemo } from "../lib/git.mjs";

const memo = createGitMemo();

function codes(result) {
  return (result.json && result.json.errors ? result.json.errors : []).map((e) => e.code);
}

function reportCodes(report) {
  return (report.errors || []).map((e) => e.code);
}

function baseDoc(repo) {
  return stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.streams[0].state = "RUNNING";
    d.streams[0].running = ["executor implementation session"];
    d.streams[0].review.auditRequired = true;
    d.streams[0].git = {
      worktree: null,
      branch: "work/x",
      baseSha: null,
      candidateSha: null,
      integrationSha: null,
      changedPaths: [],
      remoteObservation: null,
    };
  });
}

function inProcess(statePath, transitionName, flags) {
  return runTransition({ statePath, transitionName, flags, gitMemo: memo });
}

function transition(statePath, args, options = {}) {
  return runCli(TRANSITION_CLI, ["--state", statePath, ...args], { cwd: options.cwd, env: options.env });
}

function readOrNull(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function spawnTransition(statePath, args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TRANSITION_CLI, "--state", statePath, ...args], {
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      out += d;
    });
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

// ---------------------------------------------------------------------------

test("a full closure lifecycle reaches a stable state with one observation and no fix-up commit", () => {
  const repo = getSharedRepo();
  const statePath = writeStateDoc(repo, "state-lifecycle.json", baseDoc(repo));
  const renderPath = path.join(repo.dir, "docs", "plans", "atlas-active-delivery-streams.generated.md");
  const receiptPath = path.join(repo.dir, "docs", "plans", "receipts", "cycle.json");

  const returned = transition(statePath, [
    "--transition", "record-executor-return",
    "--stream", "ORD-1",
    "--expect-revision", "1",
    "--base", repo.baseSha,
    "--candidate", repo.candidateSha,
  ]);
  assert.equal(returned.status, 0, returned.stdout + returned.stderr);
  assert.equal(returned.json.status, "ok");
  let doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.streams[0].state, "REVIEW_REQUIRED");
  assert.deepEqual(doc.streams[0].git.changedPaths, ["candidate.txt"]);
  assert.equal(doc.registry.revision, 2);
  assert.ok(fs.existsSync(renderPath), "the renderer output must be published with the state");

  const qa = transition(statePath, [
    "--transition", "record-qa-result",
    "--stream", "ORD-1",
    "--expect-revision", "2",
    "--qa-verdict", "ACCEPT_READY",
    "--qa-session", "ses-qa-1",
    "--gates", "5/5/0/0/0",
  ]);
  assert.equal(qa.status, 0, qa.stdout + qa.stderr);
  doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.streams[0].state, "ACCEPT_READY");

  const integrated = transition(statePath, [
    "--transition", "record-integration",
    "--stream", "ORD-1",
    "--expect-revision", "3",
    "--integration", repo.integrationSha,
  ]);
  assert.equal(integrated.status, 0, integrated.stdout + integrated.stderr);
  doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.streams[0].state, "INTEGRATED");

  const audited = transition(statePath, [
    "--transition", "record-audit",
    "--stream", "ORD-1",
    "--expect-revision", "4",
    "--auditor-verdict", "AUDIT_CLEAR",
    "--auditor-session", "ses-aud-1",
  ]);
  assert.equal(audited.status, 0, audited.stdout + audited.stderr);

  const closed = transition(statePath, [
    "--transition", "close-cycle",
    "--stream", "ORD-1",
    "--expect-revision", "5",
    "--receipt", "docs/plans/receipts/cycle.json",
  ]);
  assert.equal(closed.status, 0, closed.stdout + closed.stderr);
  assert.ok(fs.existsSync(receiptPath), "the closure receipt must be published atomically");
  doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.streams[0].state, "COMPLETE");
  assert.equal(doc.streams[0].closure.receipt.path, "docs/plans/receipts/cycle.json");

  // The observation is a snapshot of a named ref, not the containing commit.
  const observed = transition(statePath, [
    "--transition", "record-remote-observation",
    "--stream", "ORD-1",
    "--expect-revision", "6",
    "--ref", "refs/remotes/origin/main",
    "--observed-sha", repo.integrationSha,
  ]);
  assert.equal(observed.status, 0, observed.stdout + observed.stderr);
  doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.streams[0].git.remoteObservation.sha, repo.integrationSha);
  assert.equal(doc.streams[0].git.remoteObservation.kind, "REMOTE_TRACKING_REF");

  // Stable: the committed state is verifier-clean and needs no further commit.
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.deepEqual(verified.json.errors, []);
  assert.equal(verifyInProcess(statePath).ok, true);
});

test("a stale expected revision fails without touching state, render, or receipt", () => {
  const repo = getSharedRepo();
  const statePath = writeStateDoc(repo, "state-stale.json", baseDoc(repo));
  const renderPath = path.join(repo.dir, "docs", "plans", "atlas-active-delivery-streams.generated.md");
  const stateBefore = fs.readFileSync(statePath);
  const renderBefore = readOrNull(renderPath);

  const result = inProcess(statePath, "record-executor-return", {
    stream: "ORD-1",
    "expect-revision": "99",
    base: repo.baseSha,
    candidate: repo.candidateSha,
  });
  assert.equal(result.status, "fail");
  assert.deepEqual(reportCodes(result), ["TRANSITION_STALE_REVISION"]);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore);
  assert.deepEqual(readOrNull(renderPath), renderBefore, "the render output must be untouched on failure");
});

test("an invalid transition for the current state fails closed", () => {
  const repo = getSharedRepo();
  const statePath = writeStateDoc(repo, "state-invalid.json", baseDoc(repo));
  const before = fs.readFileSync(statePath);
  const result = inProcess(statePath, "record-qa-result", {
    stream: "ORD-1",
    "expect-revision": "1",
    "qa-verdict": "ACCEPT_READY",
    "qa-session": "ses-qa-1",
    gates: "5/5/0/0/0",
  });
  assert.equal(result.status, "fail");
  assert.deepEqual(reportCodes(result), ["TRANSITION_INVALID_STATE"]);
  assert.deepEqual(fs.readFileSync(statePath), before);
});

test("an ambiguous stream selection fails closed", () => {
  const repo = getSharedRepo();
  const doc = baseDoc(repo);
  const second = JSON.parse(JSON.stringify(doc.streams[0]));
  second.id = "ORD-2";
  doc.streams.push(second);
  const statePath = writeStateDoc(repo, "state-ambiguous.json", doc);
  const result = inProcess(statePath, "record-executor-return", { "expect-revision": "1", base: repo.baseSha, candidate: repo.candidateSha });
  assert.equal(result.status, "fail");
  assert.deepEqual(reportCodes(result), ["TRANSITION_STREAM_AMBIGUOUS"]);
});

test("a live lock produces typed contention and no writes", () => {
  const repo = createTempRepo();
  try {
    const statePath = writeStateDoc(repo, "state.json", baseDoc(repo));
    const before = fs.readFileSync(statePath);
    const lockPath = path.join(repo.dir, ".git", "atlas-workflow.lock");
    fs.writeFileSync(lockPath, `${JSON.stringify({ ownerPid: process.pid, transition: "test-holder" })}\n`);

    const result = inProcess(statePath, "record-executor-return", { stream: "ORD-1", "expect-revision": "1", base: repo.baseSha, candidate: repo.candidateSha });
    assert.equal(result.status, "fail");
    assert.deepEqual(reportCodes(result), ["LOCK_CONTENTION"]);
    assert.deepEqual(fs.readFileSync(statePath), before);
    assert.equal(fs.existsSync(lockPath), true, "a live lock must never be deleted");
  } finally {
    cleanupRepo(repo.dir);
  }
});

test("a live external process holding an EMPTY lock is never reclaimed", () => {
  const repo = createTempRepo();
  try {
    const statePath = writeStateDoc(repo, "state.json", baseDoc(repo));
    const renderPath = path.join(repo.dir, "docs", "plans", "atlas-active-delivery-streams.generated.md");
    const stateBefore = fs.readFileSync(statePath);
    const renderBefore = readOrNull(renderPath);
    const lockPath = path.join(repo.dir, ".git", "atlas-workflow.lock");
    // The exact artifact a pre-correction writer could publish during its
    // non-atomic creation gap: a visible lock with no owner record.
    fs.writeFileSync(lockPath, "");

    const result = inProcess(statePath, "record-executor-return", { stream: "ORD-1", "expect-revision": "1", base: repo.baseSha, candidate: repo.candidateSha });
    assert.equal(result.status, "fail");
    assert.deepEqual(reportCodes(result), ["LOCK_UNREADABLE"]);
    assert.deepEqual(fs.readFileSync(statePath), stateBefore, "no state mutation");
    assert.deepEqual(readOrNull(renderPath), renderBefore, "no render mutation");
    assert.equal(fs.existsSync(lockPath), true, "the empty lock must survive");
    assert.equal(fs.readFileSync(lockPath, "utf8"), "", "and keep its exact bytes");
  } finally {
    cleanupRepo(repo.dir);
  }
});

test("a lock whose owning process is provably absent is reclaimed", () => {
  const repo = getSharedRepo();
  const statePath = writeStateDoc(repo, "state-absent-lock.json", baseDoc(repo));
  const lockPath = lockPathFor(repo.dir);
  // A pid that cannot exist proves the owner is absent.
  fs.writeFileSync(lockPath, `${JSON.stringify({ ownerPid: 2147480000, transition: "dead-owner" })}\n`);

  const result = inProcess(statePath, "record-executor-return", { stream: "ORD-1", "expect-revision": "1", base: repo.baseSha, candidate: repo.candidateSha });
  assert.equal(result.status, "ok", JSON.stringify(result.errors));
  assert.equal(fs.existsSync(lockPath), false, "the reclaiming writer must remove its own lock");
});

test("a mid-write failure leaves state, render, and receipt byte-identical", () => {
  const repo = createTempRepo();
  try {
    const statePath = writeStateDoc(repo, "state.json", baseDoc(repo));
    const first = inProcess(statePath, "record-executor-return", { stream: "ORD-1", "expect-revision": "1", base: repo.baseSha, candidate: repo.candidateSha });
    assert.equal(first.status, "ok", JSON.stringify(first.errors));
    const renderPath = path.join(repo.dir, "docs", "plans", "atlas-active-delivery-streams.generated.md");
    const stateBefore = fs.readFileSync(statePath);
    const renderBefore = fs.readFileSync(renderPath);

    try {
      for (const fault of ["STAGE_STATE", "STAGE_RENDER", "VERIFY_RENDERED"]) {
        process.env.ATLAS_WORKFLOW_FAULT = fault;
        const result = inProcess(statePath, "record-qa-result", {
          stream: "ORD-1",
          "expect-revision": "2",
          "qa-verdict": "ACCEPT_READY",
          "qa-session": "s",
          gates: "5/5/0/0/0",
        });
        assert.equal(result.status, "fail", `${fault} must fail`);
        assert.deepEqual(reportCodes(result), ["FAULT_INJECTED"]);
        assert.deepEqual(fs.readFileSync(statePath), stateBefore, `${fault} must not change state bytes`);
        assert.deepEqual(fs.readFileSync(renderPath), renderBefore, `${fault} must not change render bytes`);
      }
    } finally {
      delete process.env.ATLAS_WORKFLOW_FAULT;
    }

    assert.deepEqual(walk(repo.dir, (name) => name.includes(".tmp") || name.includes(".stage")), [], "no partial files may remain");
  } finally {
    cleanupRepo(repo.dir);
  }
});

test("three concurrent writers produce exactly one commit and typed losers", async () => {
  const repo = createTempRepo();
  try {
    const statePath = writeStateDoc(repo, "state.json", baseDoc(repo));
    const args = [
      "--transition", "record-executor-return",
      "--stream", "ORD-1",
      "--expect-revision", "1",
      "--base", repo.baseSha,
      "--candidate", repo.candidateSha,
    ];
    const writers = await Promise.all([
      spawnTransition(statePath, args, { ATLAS_WORKFLOW_LOCK_HOLD_MS: "700" }),
      spawnTransition(statePath, args, { ATLAS_WORKFLOW_LOCK_HOLD_MS: "700" }),
      spawnTransition(statePath, args, { ATLAS_WORKFLOW_LOCK_HOLD_MS: "700" }),
    ]);
    const winners = writers.filter((r) => r.json && r.json.status === "ok");
    const losers = writers.filter((r) => r.json && r.json.status === "fail");
    assert.equal(winners.length, 1, JSON.stringify(writers.map((r) => r.out)));
    assert.equal(losers.length, 2, JSON.stringify(writers.map((r) => r.out)));
    for (const loser of losers) {
      const loserCodes = (loser.json.errors || []).map((e) => e.code);
      // A loser may only ever observe a complete live record or a stale
      // revision. An unreadable/partial lock is impossible under atomic
      // publication, so it is deliberately not an accepted loser outcome.
      assert.ok(
        loserCodes.includes("LOCK_CONTENTION") || loserCodes.includes("TRANSITION_STALE_REVISION"),
        `loser must carry a typed contention/CAS error, got ${JSON.stringify(loserCodes)}`,
      );
    }

    const doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.equal(doc.registry.revision, 2, "exactly one transition may commit");
    assert.equal(doc.streams[0].state, "REVIEW_REQUIRED");
    assert.deepEqual(walk(repo.dir, (name) => name.includes(".tmp") || name.includes(".stage")), []);
  } finally {
    cleanupRepo(repo.dir);
  }
});

test("lease-update records a valid lease change and rejects invalid input", () => {
  const repo = getSharedRepo();
  const statePath = writeStateDoc(repo, "state-lease.json", baseDoc(repo));

  const created = inProcess(statePath, "lease-update", { stream: "ORD-1", "expect-revision": "1", "lease-id": "L1", "lease-state": "ACTIVE", "lease-role": "executor", "lease-session": "s1" });
  assert.equal(created.status, "ok", JSON.stringify(created.errors));
  let doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.leases.length, 1);
  assert.equal(doc.leases[0].streamId, "ORD-1");
  assert.equal(doc.leases[0].state, "ACTIVE");
  assert.equal(doc.leases[0].sessionId, "s1");
  assert.equal(doc.leases[0].revision, 1);
  assert.equal(doc.registry.revision, 2);

  const moved = inProcess(statePath, "lease-update", { stream: "ORD-1", "expect-revision": "2", "lease-id": "L1", "lease-state": "STALE_UNCONFIRMED", "lease-role": "executor" });
  assert.equal(moved.status, "ok", JSON.stringify(moved.errors));
  doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(doc.leases[0].state, "STALE_UNCONFIRMED");
  assert.equal(doc.leases[0].revision, 2);
  assert.equal(doc.registry.revision, 3);

  const beforeInvalid = fs.readFileSync(statePath);
  const badState = inProcess(statePath, "lease-update", { stream: "ORD-1", "expect-revision": "3", "lease-id": "L1", "lease-state": "BOGUS", "lease-role": "executor" });
  assert.equal(badState.status, "fail");
  assert.deepEqual(reportCodes(badState), ["TRANSITION_LEASE_STATE_INVALID"]);
  assert.deepEqual(fs.readFileSync(statePath), beforeInvalid, "an invalid lease state must not mutate state");

  const badRole = inProcess(statePath, "lease-update", { stream: "ORD-1", "expect-revision": "3", "lease-id": "L1", "lease-state": "IDLE", "lease-role": "root" });
  assert.deepEqual(reportCodes(badRole), ["TRANSITION_LEASE_ROLE_INVALID"]);

  // A lease owned by another stream cannot be updated through this stream.
  const twoStreams = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const second = JSON.parse(JSON.stringify(twoStreams.streams[0]));
  second.id = "ORD-2";
  twoStreams.streams.push(second);
  const secondPath = writeStateDoc(repo, "state-lease-two.json", twoStreams);
  const mismatch = inProcess(secondPath, "lease-update", { stream: "ORD-2", "expect-revision": String(twoStreams.registry.revision), "lease-id": "L1", "lease-state": "IDLE", "lease-role": "executor" });
  assert.deepEqual(reportCodes(mismatch), ["TRANSITION_LEASE_STREAM_MISMATCH"]);
});

test("usage errors exit 2 and an unknown transition exits 1", () => {
  const repo = getSharedRepo();
  const statePath = writeStateDoc(repo, "state-usage.json", baseDoc(repo));
  const missingRevision = transition(statePath, ["--transition", "record-executor-return", "--stream", "ORD-1", "--candidate", repo.candidateSha]);
  assert.equal(missingRevision.status, 2);
  assert.deepEqual(codes(missingRevision), ["USAGE_MISSING_EXPECT_REVISION"]);

  const unknownTransition = transition(statePath, ["--transition", "not-a-transition", "--expect-revision", "1"]);
  assert.equal(unknownTransition.status, 1);
  assert.deepEqual(codes(unknownTransition), ["TRANSITION_UNKNOWN"]);
});
