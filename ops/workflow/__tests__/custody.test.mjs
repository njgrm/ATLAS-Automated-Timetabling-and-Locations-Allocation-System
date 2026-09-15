// WF-C03 (B3) — exclusive browser custody lease matrix.
//
// The lib functions are the exact machinery the CLI calls; the CLI race row at
// the bottom proves the exclusive, lock-serialized cross-process contract.
//
// Every mutant asserts BOTH a typed failure code AND byte-identical lease state,
// so "fail closed with zero mutation" is proven, not asserted in prose.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  CUSTODY_CLI,
  getSharedRepo,
  fixtureRaw,
  repoSubstitutions,
  substitute,
  writeState,
  sha256,
} from "./harness.mjs";
import { observabilityPaths, OBSERVABILITY_ROOT } from "../lib/observability.mjs";
import {
  acquire,
  renew,
  transferRequest,
  transferAck,
  release,
  recover,
  recordLogin,
  readLease,
  summarizeLease,
  effectiveState,
  recoveryInstructions,
  profileKey,
  custodyFilePath,
  DEFAULT_ORIGIN,
  DEFAULT_PROFILE,
} from "../lib/custody.mjs";

const T0 = "2026-09-15T00:00:00.000Z";
const T0_PLUS_10M = "2026-09-15T00:10:00.000Z";
const T0_PLUS_2H = "2026-09-15T02:00:00.000Z";

function mkPaths(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-custody-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return observabilityPaths(dir);
}

function owner(paths, over = {}) {
  return acquire({
    paths,
    sessionId: "ses_owner",
    role: "executor",
    stream: "WF-C03",
    loginBudget: 0,
    cleanupOwner: "ses_owner",
    now: T0,
    ...over,
  });
}

/** Byte-identical proof for "the rejected operation mutated nothing". */
function assertNoWrite(paths, fn) {
  const file = custodyFilePath(paths, DEFAULT_PROFILE);
  const before = fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
  let thrown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  const after = fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
  assert.equal(after, before, "a rejected custody operation must not change the lease bytes");
  return thrown;
}

// `assertNoWrite` needs the paths; wrap them so every mutant is mutation-proof.
function expectCode(paths, fn, code) {
  const thrown = assertNoWrite(paths, fn);
  assert.ok(thrown, `expected ${code} to be thrown`);
  assert.equal(thrown.code, code, `expected ${code}, got ${thrown.code}: ${thrown.message}`);
  return thrown;
}

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}

function runCliAsync(scriptPath, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { cwd, windowsHide: true });
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
      resolve({ code, json, raw: out });
    });
  });
}

// ---- Positive controls -----------------------------------------------------

test("acquire binds session/role/stream/profile/origin/budget/cleanup and revision 1", (t) => {
  const paths = mkPaths(t);
  const { lease, previousState } = owner(paths);
  assert.equal(previousState, null);
  assert.equal(lease.revision, 1);
  assert.equal(lease.state, "ACTIVE");
  assert.equal(lease.sessionId, "ses_owner");
  assert.equal(lease.role, "executor");
  assert.equal(lease.stream, "WF-C03");
  assert.equal(lease.profile, DEFAULT_PROFILE);
  assert.equal(lease.origin, DEFAULT_ORIGIN);
  assert.equal(lease.loginBudget, 0);
  assert.equal(lease.loginsPerformed, 0);
  assert.equal(lease.cleanupOwner, "ses_owner");
  assert.equal(lease.cleanupStatus, "PENDING");
  assert.equal(lease.issuedAt, T0);
  assert.equal(lease.expiresAt, "2026-09-15T01:30:00.000Z");
  const stored = readLease(paths, DEFAULT_PROFILE);
  assert.equal(stored.leaseId, lease.leaseId);
  assert.deepEqual(
    lease.history.map((h) => h.op),
    ["acquire"],
  );
});

test("renew advances the revision and extends expiry for the owner only", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  const renewed = renew({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, now: T0_PLUS_10M });
  assert.equal(renewed.lease.revision, 2);
  assert.equal(renewed.lease.renewedAt, T0_PLUS_10M);
  assert.equal(renewed.lease.expiresAt, "2026-09-15T01:40:00.000Z");
  assert.deepEqual(
    renewed.lease.history.map((h) => h.op),
    ["acquire", "renew"],
  );
});

test("transfer requires the target's acknowledgement and moves the lease in two steps", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  const requested = transferRequest({
    paths,
    leaseId: lease.leaseId,
    sessionId: "ses_owner",
    expectedRevision: 1,
    toSessionId: "ses_next",
    toRole: "qa",
    now: T0_PLUS_10M,
  });
  assert.equal(requested.lease.revision, 2);
  assert.equal(requested.lease.sessionId, "ses_owner", "the from-owner still holds until the target acks");
  assert.deepEqual(requested.lease.transfer, {
    toSessionId: "ses_next",
    toRole: "qa",
    requestedAt: T0_PLUS_10M,
    fromAck: true,
    toAck: false,
  });

  // Mutants on the in-progress transfer: wrong ack-er and a duplicate request.
  expectCode(
    paths,
    () => transferAck({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 2, now: T0_PLUS_10M }),
    "CUSTODY_WRONG_OWNER",
  );
  expectCode(
    paths,
    () =>
      transferRequest({
        paths,
        leaseId: lease.leaseId,
        sessionId: "ses_owner",
        expectedRevision: 2,
        toSessionId: "ses_other",
        toRole: "qa",
        now: T0_PLUS_10M,
      }),
    "CUSTODY_TRANSFER_IN_PROGRESS",
  );

  const acked = transferAck({ paths, leaseId: lease.leaseId, sessionId: "ses_next", expectedRevision: 2, now: T0_PLUS_10M });
  assert.equal(acked.lease.sessionId, "ses_next");
  assert.equal(acked.lease.role, "qa");
  assert.equal(acked.lease.transfer, null);
  assert.equal(acked.lease.revision, 3);

  // The former owner is no longer privileged.
  expectCode(
    paths,
    () => renew({ paths, leaseId: acked.lease.leaseId, sessionId: "ses_owner", expectedRevision: 3, now: T0_PLUS_10M }),
    "CUSTODY_WRONG_OWNER",
  );
});

test("a transfer-ack without a prior request fails closed", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  expectCode(
    paths,
    () => transferAck({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, now: T0_PLUS_10M }),
    "CUSTODY_NO_TRANSFER",
  );
});

test("release requires a complete-cleanup acknowledgement and records it", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  expectCode(
    paths,
    () => release({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, now: T0_PLUS_10M }),
    "CUSTODY_CLEANUP_INCOMPLETE",
  );
  const released = release({
    paths,
    leaseId: lease.leaseId,
    sessionId: "ses_owner",
    expectedRevision: 1,
    cleanupComplete: true,
    now: T0_PLUS_10M,
  });
  assert.equal(released.lease.state, "RELEASED");
  assert.equal(released.lease.cleanupStatus, "COMPLETE");
  assert.equal(released.lease.endedAt, T0_PLUS_10M);
  assert.equal(effectiveState(released.lease, Date.parse(T0_PLUS_2H)), "RELEASED");
  expectCode(
    paths,
    () => release({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 2, cleanupComplete: true, now: T0_PLUS_10M }),
    "CUSTODY_ALREADY_RELEASED",
  );
});

test("a released profile can be re-acquired with fresh authorization", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  release({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, cleanupComplete: true, now: T0_PLUS_10M });
  const again = owner(paths, { sessionId: "ses_second", now: T0_PLUS_2H });
  assert.equal(again.previousState, "RELEASED");
  assert.equal(again.lease.revision, 1);
  assert.equal(again.lease.sessionId, "ses_second");
});

// ---- Mutants ---------------------------------------------------------------

test("double-acquire fails closed while the profile is held", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  const err = expectCode(paths, () => owner(paths, { sessionId: "ses_rival" }), "CUSTODY_HELD");
  assert.equal(err.detail.leaseId, lease.leaseId);
  assert.equal(err.detail.state, "ACTIVE");
});

test("expiry yields STALE_UNCONFIRMED and never auto-frees the profile", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);

  assert.equal(effectiveState(lease, Date.parse(T0_PLUS_10M)), "ACTIVE");
  assert.equal(effectiveState(lease, Date.parse(T0_PLUS_2H)), "STALE_UNCONFIRMED");
  assert.equal(summarizeLease(lease, Date.parse(T0_PLUS_2H)).expired, true);

  // An expiry-auto-release attempt is the mutant: acquire must NOT succeed.
  const err = expectCode(paths, () => owner(paths, { sessionId: "ses_rival", now: T0_PLUS_2H }), "CUSTODY_HELD");
  assert.equal(err.detail.state, "STALE_UNCONFIRMED");

  // The expired lease also cannot be renewed or transferred, but the recorded
  // owner may still release it and an operator may still recover it.
  expectCode(paths, () => renew({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, now: T0_PLUS_2H }), "CUSTODY_NOT_ACTIVE");
  const instructions = recoveryInstructions(summarizeLease(lease, Date.parse(T0_PLUS_2H)));
  assert.match(instructions, /NOT free/);
  assert.match(instructions, /recover --confirm/);
});

test("stale renew and stale release are revision-CAS guarded", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  expectCode(paths, () => renew({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 99, now: T0_PLUS_10M }), "CUSTODY_STALE_REVISION");
  expectCode(
    paths,
    () => release({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 7, cleanupComplete: true, now: T0_PLUS_10M }),
    "CUSTODY_STALE_REVISION",
  );
  // A missing revision is not silently treated as "current".
  expectCode(paths, () => renew({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", now: T0_PLUS_10M }), "CUSTODY_STALE_REVISION");
});

test("wrong owner cannot renew, transfer, release, or consume a login", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths, { loginBudget: 1, loginAuthorized: true, expectedAuditDelta: "one LOCAL_LOGIN_SUCCESS row" });
  expectCode(paths, () => renew({ paths, leaseId: lease.leaseId, sessionId: "ses_rival", expectedRevision: 1, now: T0_PLUS_10M }), "CUSTODY_WRONG_OWNER");
  expectCode(
    paths,
    () =>
      transferRequest({
        paths,
        leaseId: lease.leaseId,
        sessionId: "ses_rival",
        expectedRevision: 1,
        toSessionId: "ses_x",
        toRole: "qa",
        now: T0_PLUS_10M,
      }),
    "CUSTODY_WRONG_OWNER",
  );
  expectCode(
    paths,
    () => release({ paths, leaseId: lease.leaseId, sessionId: "ses_rival", expectedRevision: 1, cleanupComplete: true, now: T0_PLUS_10M }),
    "CUSTODY_WRONG_OWNER",
  );
  expectCode(paths, () => recordLogin({ paths, leaseId: lease.leaseId, sessionId: "ses_rival", expectedRevision: 1, now: T0_PLUS_10M }), "CUSTODY_WRONG_OWNER");
});

test("wrong or non-https origin fails closed unless explicitly overridden", (t) => {
  const paths = mkPaths(t);
  expectCode(paths, () => owner(paths, { origin: "https://evil.example" }), "CUSTODY_ORIGIN_INVALID");
  expectCode(paths, () => owner(paths, { origin: "http://njgrm.buru-degree.ts.net", allowOriginOverride: true }), "CUSTODY_ORIGIN_INVALID");
  expectCode(paths, () => owner(paths, { origin: "" }), "CUSTODY_ORIGIN_REQUIRED");

  // An explicit override is the only way to authorize another origin.
  const { lease } = owner(paths, { origin: "https://staging.example", allowOriginOverride: true });
  assert.equal(lease.origin, "https://staging.example");
});

test("missing or incomplete login authorization fails closed", (t) => {
  const paths = mkPaths(t);
  expectCode(paths, () => owner(paths, { loginBudget: 1 }), "CUSTODY_LOGIN_AUTHORIZATION_MISSING");
  expectCode(paths, () => owner(paths, { loginBudget: 1, loginAuthorized: true }), "CUSTODY_LOGIN_AUTHORIZATION_MISSING");
  expectCode(paths, () => owner(paths, { loginBudget: undefined }), "CUSTODY_LOGIN_AUTHORIZATION_MISSING");
  expectCode(
    paths,
    () => acquire({ paths, sessionId: "ses_owner", role: "executor", stream: "WF-C03", loginBudget: 0, now: T0 }),
    "CUSTODY_CLEANUP_OWNER_MISSING",
  );
});

test("an exhausted login budget refuses a further login", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths, { loginBudget: 1, loginAuthorized: true, expectedAuditDelta: "one LOCAL_LOGIN_SUCCESS row" });
  const used = recordLogin({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, now: T0_PLUS_10M });
  assert.equal(used.lease.loginsPerformed, 1);
  assert.equal(used.lease.revision, 2);
  assert.equal(summarizeLease(used.lease, Date.parse(T0_PLUS_10M)).loginsRemaining, 0);
  expectCode(paths, () => recordLogin({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 2, now: T0_PLUS_10M }), "CUSTODY_LOGIN_BUDGET_EXHAUSTED");
});

test("a zero-budget lease can never log in", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  expectCode(paths, () => recordLogin({ paths, leaseId: lease.leaseId, sessionId: "ses_owner", expectedRevision: 1, now: T0_PLUS_10M }), "CUSTODY_LOGIN_AUTHORIZATION_MISSING");
});

test("operator recovery is explicit, gated, and recorded", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  expectCode(paths, () => recover({ paths, profile: DEFAULT_PROFILE, leaseId: lease.leaseId, expectedRevision: 1, operator: "op", reason: "r" }), "CUSTODY_RECOVERY_CONFIRMATION_REQUIRED");
  expectCode(paths, () => recover({ paths, profile: DEFAULT_PROFILE, leaseId: lease.leaseId, expectedRevision: 1, operator: "", reason: "r", confirm: true }), "CUSTODY_RECOVERY_OPERATOR_REQUIRED");
  expectCode(paths, () => recover({ paths, profile: DEFAULT_PROFILE, leaseId: lease.leaseId, expectedRevision: 1, operator: "op", reason: "", confirm: true }), "CUSTODY_RECOVERY_REASON_REQUIRED");
  const recovered = recover({
    paths,
    profile: DEFAULT_PROFILE,
    leaseId: lease.leaseId,
    expectedRevision: 1,
    operator: "operator: njgro",
    reason: "interrupted session, custody confirmed abandoned",
    confirm: true,
    now: T0_PLUS_2H,
  });
  assert.equal(recovered.lease.state, "RELEASED");
  assert.equal(recovered.lease.recoveredBy, "operator: njgro");
  assert.match(recovered.lease.recoverReason, /interrupted session/);
});

test("mutating an unknown profile fails closed", (t) => {
  const paths = mkPaths(t);
  expectCode(paths, () => renew({ paths, profile: "C:\\no\\such\\profile", leaseId: "lease-x", sessionId: "ses_owner", expectedRevision: 1, now: T0 }), "CUSTODY_UNKNOWN_LEASE");
});

test("the lease file id is derived from the profile and the summary is complete", (t) => {
  const paths = mkPaths(t);
  const { lease } = owner(paths);
  assert.equal(path.basename(custodyFilePath(paths, DEFAULT_PROFILE)), `${profileKey(DEFAULT_PROFILE)}.json`);
  const summary = summarizeLease(lease, Date.parse(T0));
  assert.deepEqual(Object.keys(summary).sort(), [
    "cleanupOwner",
    "cleanupStatus",
    "endedAt",
    "expectedAuditDelta",
    "expired",
    "expiresAt",
    "issuedAt",
    "leaseId",
    "loginAuthorized",
    "loginBudget",
    "loginsPerformed",
    "loginsRemaining",
    "origin",
    "profile",
    "recoverReason",
    "recoveredBy",
    "renewedAt",
    "revision",
    "role",
    "sessionId",
    "state",
    "storedState",
    "stream",
    "transfer",
  ]);
});

// ---- CLI contract + cross-process concurrency ------------------------------

test("two concurrent CLI acquires commit exactly one lease and one typed loser", async (t) => {
  const repo = getSharedRepo();
  const statePath = writeState(repo, "custody-race-state.json", substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  const obsRoot = path.join(repo.dir, ".git", OBSERVABILITY_ROOT);
  t.after(() => {
    try {
      fs.rmSync(obsRoot, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  const args = (session) => [
    "--op",
    "acquire",
    "--state",
    statePath,
    "--session",
    session,
    "--role",
    "executor",
    "--stream",
    "ORD-1",
    "--login-budget",
    "0",
    "--cleanup-owner",
    session,
    "--now",
    T0,
  ];
  const results = await Promise.all([
    runCliAsync(CUSTODY_CLI, args("ses_race_a"), repo.dir),
    runCliAsync(CUSTODY_CLI, args("ses_race_b"), repo.dir),
  ]);

  const winners = results.filter((r) => r.code === 0);
  const losers = results.filter((r) => r.code !== 0);
  assert.equal(winners.length, 1, `exactly one winner required: ${JSON.stringify(results.map((r) => ({ code: r.code, json: r.json })))}`);
  assert.equal(losers.length, 1);
  assert.equal(losers[0].code, 1);
  const loserCode = losers[0].json.errors[0].code;
  assert.ok(
    ["CUSTODY_HELD", "LOCK_CONTENTION"].includes(loserCode),
    `the loser must carry a typed custody/lock error, got ${loserCode}`,
  );

  const leaseFile = path.join(obsRoot, "custody", `${profileKey(DEFAULT_PROFILE)}.json`);
  const lease = JSON.parse(fs.readFileSync(leaseFile, "utf8"));
  assert.equal(lease.schema, "atlas.workflow.custody/1");
  assert.equal(lease.revision, 1);
  assert.ok(["ses_race_a", "ses_race_b"].includes(lease.sessionId), "the committed lease must name the winning session");

  const files = listFiles(obsRoot);
  assert.equal(files.some((f) => f.endsWith(".tmp")), false, `no staged residue may remain: ${JSON.stringify(files)}`);
  assert.equal(files.some((f) => f.endsWith(".lock")), false, `the exclusive lock must be released: ${JSON.stringify(files)}`);
  assert.deepEqual(
    files.filter((f) => f.endsWith(".json")),
    [`custody/${path.basename(leaseFile)}`],
    "only the single committed lease may exist",
  );
});

test("the custody CLI status op reads a released lease and never writes", async (t) => {
  const repo = getSharedRepo();
  const statePath = writeState(repo, "custody-status-state.json", substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  const obsRoot = path.join(repo.dir, ".git", OBSERVABILITY_ROOT);
  t.after(() => {
    try {
      fs.rmSync(obsRoot, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  const before = listFiles(obsRoot);
  const result = await runCliAsync(CUSTODY_CLI, ["--op", "status", "--state", statePath, "--now", T0], repo.dir);
  assert.equal(result.code, 0, result.raw);
  assert.equal(result.json.status, "ok");
  assert.equal(result.json.summary.lease, null);
  assert.match(result.json.summary.recovery, /no custody lease exists/);
  assert.deepEqual(listFiles(obsRoot), before, "status must not create or change custody state");
});
