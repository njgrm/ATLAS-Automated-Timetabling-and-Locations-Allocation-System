// A3 — real stream/worktree lease and active-work detection.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSharedRepo, createCleanRepo, cleanupRepo, stateDocFromFixture, verifyInProcess } from "./harness.mjs";

const ISO = "2026-09-14T10:00:00+08:00";

function lease(overrides = {}) {
  return {
    id: "lease-1",
    streamId: "ORD-1",
    worktree: null,
    role: "executor",
    sessionId: null,
    state: "ACTIVE",
    revision: 1,
    updatedAt: ISO,
    expiresAt: null,
    ...overrides,
  };
}

function stateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wfc02-state-"));
}

function verifyDoc(doc) {
  const dir = stateDir();
  try {
    const statePath = path.join(dir, "state.json");
    fs.writeFileSync(statePath, `${JSON.stringify(doc, null, 2)}\n`);
    return verifyInProcess(statePath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function plannedDoc(repo, mutate) {
  return stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.streams[0].state = "PLANNED";
    d.streams[0].running = [];
    d.streams[0].git.worktree = null;
    if (mutate) mutate(d);
  });
}

function codes(result) {
  return result.errors.map((e) => e.code);
}

// The exact regression revealed by TT-SOURCE-FRESHNESS-C04: a dirty owned
// worktree plus a live lease while the register still says PLANNED/no running.
test("dirty owned worktree + live lease + PLANNED/running[] fails verification", () => {
  const dirty = createCleanRepo();
  try {
    fs.writeFileSync(path.join(dirty, "uncommitted.txt"), "work in progress\n");
    const doc = plannedDoc(getSharedRepo(), (d) => {
      d.streams[0].git.worktree = dirty;
      d.leases = [lease({ worktree: dirty })];
    });
    const result = verifyDoc(doc);
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("PLANNED_WITH_LIVE_LEASE"), JSON.stringify(codes(result)));
    assert.ok(codes(result).includes("PLANNED_WITH_DIRTY_WORKTREE"), JSON.stringify(codes(result)));
  } finally {
    cleanupRepo(dirty);
  }
});

test("a clean worktree with no lease is not treated as activity", () => {
  const clean = createCleanRepo();
  try {
    const doc = plannedDoc(getSharedRepo(), (d) => {
      d.streams[0].git.worktree = clean;
      d.leases = [];
    });
    const result = verifyDoc(doc);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
  } finally {
    cleanupRepo(clean);
  }
});

test("a clean worktree with a live lease still blocks a PLANNED declaration", () => {
  const clean = createCleanRepo();
  try {
    const doc = plannedDoc(getSharedRepo(), (d) => {
      d.streams[0].git.worktree = clean;
      d.leases = [lease({ worktree: clean })];
    });
    const result = verifyDoc(doc);
    assert.equal(result.ok, false);
    assert.deepEqual(codes(result), ["PLANNED_WITH_LIVE_LEASE"]);
  } finally {
    cleanupRepo(clean);
  }
});

test("an expired-but-unconfirmed ACTIVE lease never frees custody", () => {
  const clean = createCleanRepo();
  try {
    const doc = plannedDoc(getSharedRepo(), (d) => {
      d.streams[0].git.worktree = clean;
      d.leases = [lease({ worktree: clean, expiresAt: "2026-01-01T00:00:00+08:00" })];
    });
    const result = verifyDoc(doc);
    assert.equal(result.ok, false, "expiry alone must not release an ACTIVE lease");
    assert.ok(codes(result).includes("PLANNED_WITH_LIVE_LEASE"), JSON.stringify(codes(result)));
  } finally {
    cleanupRepo(clean);
  }
});

test("duplicate lease ids and unknown stream references fail closed", () => {
  const repo = getSharedRepo();
  const duplicate = plannedDoc(repo, (d) => {
    d.leases = [lease(), lease()];
  });
  const dupResult = verifyDoc(duplicate);
  assert.ok(codes(dupResult).includes("DUPLICATE_LEASE_ID"), JSON.stringify(codes(dupResult)));

  const unknown = plannedDoc(repo, (d) => {
    d.leases = [lease({ streamId: "NOT-A-STREAM" })];
  });
  const unknownResult = verifyDoc(unknown);
  assert.ok(codes(unknownResult).includes("LEASE_UNKNOWN_STREAM"), JSON.stringify(codes(unknownResult)));
});

test("a COMPLETE stream cannot retain a live lease", () => {
  const repo = getSharedRepo();
  const doc = stateDocFromFixture("pass-audited-wave.json", repo, (d) => {
    d.leases = [lease({ streamId: "WAVE-1", state: "ACTIVE" })];
  });
  // The fixture references a receipt; strip the closure so only the lease rule
  // is under test.
  doc.streams[0].closure = null;
  doc.streams[0].state = "COMPLETE";
  doc.streams[0].review = {
    qaVerdict: "ACCEPT_READY",
    qaSessionId: "q",
    auditorVerdict: "AUDIT_CLEAR",
    auditorSessionId: "a",
    auditRequired: true,
    qaRounds: [{ round: 1, verdict: "ACCEPT_READY", sessionId: "q" }],
  };
  const result = verifyDoc(doc);
  assert.ok(codes(result).includes("COMPLETE_WITH_LIVE_LEASE"), JSON.stringify(codes(result)));
});
