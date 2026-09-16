// WF-TRANSITION-TERMINAL-RECONCILE-C09 - the three terminal/reconcile
// transitions, the artifact-pin refresh, the register revision windows, the
// RUNNING live-evidence rule's repair-read, and the create-stream atomic lease,
// exercised through the real production CLI and the real engine over disposable
// repositories.
//
// Every rejection asserts byte-identical state AND render, so a refused
// transition can never leave partial mutation behind. Synthetic documents are
// admissible here because the input contract IS a JSON document and the
// production verifier/renderer run over them unchanged; the real register
// repair (revisions 218-227) is driven separately by the packet's R2.4 sequence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  TRANSITION_CLI,
  VERIFY_CLI,
  RENDER_CLI,
  REPO_ROOT,
  getSharedRepo,
  createTempRepo,
  cleanupRepo,
  runCli,
  stateDocFromFixture,
  writeStateDoc,
  makeReceipt,
  writeReceipt,
  errorCodes,
  copyWorkflowToTemp,
  sha256,
} from "./harness.mjs";
import { runTransition, isSubMultiset, listTransitions } from "../lib/transition.mjs";
import { observabilityPaths, writeHeartbeat, buildHeartbeat } from "../lib/observability.mjs";
import { runningWithoutLiveEvidence } from "../lib/verify.mjs";

const RENDER_REL = "docs/plans/atlas-active-delivery-streams.generated.md";
const ISO = "2026-09-16T00:00:00.000Z";
const T0 = Date.parse(ISO);
const WINDOW_MS = 5 * 60 * 1000;

function codesOf(report) {
  if (report && Array.isArray(report.errors)) return report.errors.map((error) => error.code);
  if (report && report.json && Array.isArray(report.json.errors)) return report.json.errors.map((error) => error.code);
  return [];
}

function readOrNull(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function renderPathFor(repo) {
  return path.join(repo.dir, ...RENDER_REL.split("/"));
}

function commonDirFor(repo) {
  return path.join(repo.dir, ".git");
}

/** A RUNNING document whose only defect can be the missing live evidence. */
function runningDoc(repo, mutate) {
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    if (mutate) mutate(d);
  });
  return doc;
}

function decisionDoc(repo, mutate) {
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    const target = d.streams[0];
    target.state = "DECISION_REQUIRED";
    target.awaited = ["operator/planner decision"];
    target.running = [];
    target.nextAction = "Record the decision.";
    const replacement = JSON.parse(JSON.stringify(d.streams[0]));
    replacement.id = "ORD-2";
    replacement.state = "INTEGRATED";
    replacement.awaited = [];
    replacement.running = [];
    replacement.nextAction = "Closed as the replacement.";
    d.streams.push(replacement);
    if (mutate) mutate(d);
  });
  return doc;
}

function resolution(overrides = {}) {
  return {
    disposition: "SUPERSEDED",
    resolver: "planner-cycle-owner",
    text: "Superseded by the replacement stream.",
    resolvedAt: ISO,
    supersededBy: "ORD-2",
    ...overrides,
  };
}

/** The fixture as committed: RUNNING with its own ACTIVE lease, so it is
 * verifier-clean and every transition may read it. */
function cleanRunningDoc(repo) {
  return stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
  });
}

/** A document with no RUNNING declaration, so it is verifier-clean and every
 * transition (not only the repair-read) may read it. */
function reconcileDoc(repo, mutate) {
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "REVIEW_REQUIRED";
    d.streams[0].running = [];
    if (mutate) mutate(d);
  });
  return doc;
}

function heartbeatStore(commonDir, entries) {
  const paths = observabilityPaths(commonDir);
  for (const entry of entries) {
    writeHeartbeat(
      paths,
      buildHeartbeat(
        {
          sessionId: entry.sessionId,
          role: "executor",
          stream: entry.stream,
          status: "ACTIVE",
          updatedAt: entry.updatedAt,
        },
        { now: entry.updatedAt },
      ),
    );
  }
  return paths;
}

function run(statePath, transition, args, options = {}) {
  return runCli(TRANSITION_CLI, ["--state", statePath, "--transition", transition, ...args], {
    cwd: options.cwd,
    env: options.env,
  });
}

function inProcess(repo, statePath, transition, flags) {
  return runTransition({ statePath, transitionName: transition, flags, now: ISO });
}

function assertNoMutation(statePath, renderPath, action) {
  const stateBefore = fs.readFileSync(statePath);
  const renderBefore = readOrNull(renderPath);
  const report = action();
  // `run` returns the CLI process result: the JSON report carries the verdict,
  // the process status carries the exit code.
  const json = report.json;
  assert.ok(json, `expected a JSON report, got: ${report.stdout}${report.stderr}`);
  assert.equal(json.status, "fail", `expected a typed refusal, got ${JSON.stringify(json.errors)}`);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "a refused transition must not mutate state");
  assert.deepEqual(readOrNull(renderPath), renderBefore, "a refused transition must not mutate the render");
  return json;
}

// ---------------------------------------------------------------------------
// Section 3.3 / Section 3.5 / Section 5 rows 1-7 - abandon-stream

test("row 1: abandon-stream repairs a RUNNING stream with no lease and no heartbeat into a clean PLANNED record", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "abandon-state.json", runningDoc(repo));
  const renderPath = renderPathFor(repo);

  const result = run(statePath, "abandon-stream", [
    "--stream", "ORD-1",
    "--expect-revision", "1",
    "--reason", "the declaring work is gone",
    "--next-action", "Re-plan the abandoned work",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const stream = doc.streams[0];
  assert.equal(stream.state, "PLANNED");
  assert.deepEqual(stream.running, []);
  assert.deepEqual(stream.awaited, []);
  assert.equal(stream.nextAction, "Re-plan the abandoned work");
  assert.equal(doc.registry.revision, 2);

  // The heartbeat evidence the refusal/acceptance relied on is disclosed.
  assert.equal(result.json.summary.heartbeatEvidence.recordsNamingStream, 0);
  assert.equal(result.json.summary.heartbeatEvidence.freshestAgeMs, null);
  assert.equal(result.json.summary.heartbeatEvidence.activeWindowMs, WINDOW_MS);
  assert.equal(result.json.summary.heartbeatEvidence.unreadableFiles, 0);

  // Candidate verifier-clean and rendered bytes published with the state.
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.deepEqual(verified.json.errors, []);
  const check = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", renderPath], { cwd: repo.dir });
  assert.equal(check.status, 0, check.stdout + check.stderr);
});

test("row 1 control: with the repairable set emptied the identical call fails TRANSITION_STATE_INVALID with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const tree = copyWorkflowToTemp();
  t.after(() => fs.rmSync(tree.dir, { recursive: true, force: true }));
  const statePath = writeStateDoc(repo, "abandon-mutant-state.json", runningDoc(repo));
  const renderPath = renderPathFor(repo);

  // Mutate ONLY the engine-level closed repair set: the current document then
  // carries a non-tolerated error and is strictly refused. This proves the
  // repair-read is the load-bearing rule, not a vacuous helper.
  const verifyLibPath = tree.transitionCli.replace(/transition\.mjs$/, path.join("lib", "verify.mjs"));
  const source = fs.readFileSync(verifyLibPath, "utf8");
  const anchor = 'export const REPAIRABLE_ERROR_CODES = new Set([RUNNING_WITHOUT_LIVE_EVIDENCE, "ARTIFACT_HASH_MISMATCH"]);';
  assert.ok(source.includes(anchor), "the repairable-set declaration anchor must exist");
  fs.writeFileSync(verifyLibPath, source.replace(anchor, "export const REPAIRABLE_ERROR_CODES = new Set();"));

  const stateBefore = fs.readFileSync(statePath);
  const mutant = runCli(
    tree.transitionCli,
    ["--state", statePath, "--transition", "abandon-stream", "--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"],
    { cwd: repo.dir },
  );
  assert.equal(mutant.status, 1, mutant.stdout + mutant.stderr);
  assert.deepEqual(codesOf(mutant), ["TRANSITION_STATE_INVALID"]);
  assert.match(mutant.json.errors[0].message, /RUNNING_WITHOUT_LIVE_EVIDENCE/);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "the refused mutant must not mutate state");
  assert.equal(readOrNull(renderPath), null, "the refused mutant must not publish a render");
});

test("row 2: abandon-stream fails closed on an ACTIVE lease", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = runningDoc(repo, (d) => {
    d.leases = [{ id: "lease-ord-1", streamId: "ORD-1", worktree: null, role: "executor", sessionId: "ses-x", state: "ACTIVE", revision: 1, updatedAt: ISO, expiresAt: null }];
  });
  const statePath = writeStateDoc(repo, "abandon-lease-state.json", doc);
  const report = assertNoMutation(statePath, renderPathFor(repo), () =>
    run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_ABANDON_ACTIVE_LEASE"]);
});

test("row 3+4: a fresh heartbeat blocks the abandon, a stale one permits it, and widening the window flips it back", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "abandon-heartbeat-state.json", runningDoc(repo));
  heartbeatStore(commonDirFor(repo), [{ sessionId: "ses-wf-c09", stream: "ORD-1", updatedAt: ISO }]);

  // Fresh (age 0 <= window): refused.
  const fresh = run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan", "--now", ISO]);
  assert.equal(fresh.status, 1);
  assert.deepEqual(codesOf(fresh), ["TRANSITION_ABANDON_FRESH_HEARTBEAT"]);
  assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).registry.revision, 1, "the refusal must not mutate state");

  // Stale beyond the window (positive control for the row above): accepted, and
  // the evidence is disclosed.
  const staleNow = new Date(T0 + WINDOW_MS + 1).toISOString();
  const stale = run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan", "--now", staleNow]);
  assert.equal(stale.status, 0, stale.stdout + stale.stderr);
  assert.equal(stale.json.summary.heartbeatEvidence.recordsNamingStream, 1);
  assert.equal(stale.json.summary.heartbeatEvidence.freshestAgeMs, WINDOW_MS + 1);
  assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0].state, "PLANNED");
});

test("row 4 control: a stale heartbeat is admitted, and widening the window flips it back to a refusal", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "abandon-window-state.json", runningDoc(repo));
  heartbeatStore(commonDirFor(repo), [{ sessionId: "ses-wf-c09", stream: "ORD-1", updatedAt: ISO }]);

  // Aged window + 1ms: outside the default window, so the abandon is admitted.
  const staleNow = new Date(T0 + WINDOW_MS + 1).toISOString();
  const admitted = run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan", "--now", staleNow]);
  assert.equal(admitted.status, 0, admitted.stdout + admitted.stderr);
  assert.equal(admitted.json.summary.heartbeatEvidence.freshestAgeMs, WINDOW_MS + 1);
  assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0].state, "PLANNED");

  // The same store, the same clock, a widened window: the same heartbeat is now
  // inside the window and the abandon fails closed.
  const secondPath = writeStateDoc(repo, "abandon-window-state-2.json", runningDoc(repo));
  const widened = run(secondPath, "abandon-stream", [
    "--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan",
    "--now", staleNow, "--active-window-ms", String(WINDOW_MS * 2),
  ]);
  assert.equal(widened.status, 1);
  assert.deepEqual(codesOf(widened), ["TRANSITION_ABANDON_FRESH_HEARTBEAT"]);
  assert.equal(widened.json.errors[0].message.includes("inside the"), true);
  assert.equal(JSON.parse(fs.readFileSync(secondPath, "utf8")).registry.revision, 1, "the refusal must not mutate state");
});

test("row 5+6+7: abandon-stream rejects an unknown stream, a COMPLETE from-state, and a stale revision with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "abandon-reject-state.json", runningDoc(repo));
  const renderPath = renderPathFor(repo);

  const unknown = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "abandon-stream", ["--stream", "NOPE", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"]),
  );
  assert.deepEqual(codesOf(unknown), ["TRANSITION_STREAM_UNKNOWN"]);

  // A COMPLETE record can only be verifier-clean with a real closure receipt,
  // so the row builds one through the same receipt contract the engine uses and
  // then proves the from-state refusal on a clean current document.
  const completeRel = "receipt-c09-complete.json";
  const completeDoc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "COMPLETE";
    d.streams[0].awaited = [];
    d.streams[0].running = [];
    d.streams[0].nextAction = null;
    d.streams[0].gates = {
      total: 4, passed: 4, failed: 0, blocked: 0, unperformed: 0,
      plan: { MANDATORY_SOURCE: 4, MANDATORY_LIVE: 0, DEFERRED_EXTERNAL: 0 },
      classes: {
        MANDATORY_SOURCE: { total: 4, passed: 4, failed: 0, blocked: 0, unperformed: 0 },
        MANDATORY_LIVE: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
        DEFERRED_EXTERNAL: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
      },
    };
    d.streams[0].review = {
      qaVerdict: "ACCEPT_READY",
      qaSessionId: "ses-complete-qa",
      auditorVerdict: null,
      auditorSessionId: null,
      auditRequired: false,
      qaRounds: [{ round: 1, verdict: "ACCEPT_READY", sessionId: "ses-complete-qa" }],
    };
    d.streams[0].closure = { receipt: { path: completeRel, sha256: "0".repeat(64) } };
  });
  const completePath = writeStateDoc(repo, "abandon-complete-state.json", completeDoc);
  const receipt = makeReceipt({
    statePathAsGiven: "abandon-complete-state.json",
    stateBytes: fs.readFileSync(completePath),
    streamId: "ORD-1",
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: null,
    gates: { total: 4, passed: 4, failed: 0, blocked: 0, unperformed: 0 },
  });
  const receiptSha = writeReceipt(repo, completeRel, receipt);
  const finalDoc = JSON.parse(fs.readFileSync(completePath, "utf8"));
  finalDoc.streams[0].closure.receipt.sha256 = receiptSha;
  fs.writeFileSync(completePath, `${JSON.stringify(finalDoc, null, 2)}\n`);
  assert.equal(codesOf(runCli(VERIFY_CLI, ["--state", completePath], { cwd: repo.dir })).length, 0, "the COMPLETE probe document must be verifier-clean");

  const invalid = assertNoMutation(completePath, renderPath, () =>
    run(completePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"]),
  );
  assert.deepEqual(codesOf(invalid), ["TRANSITION_INVALID_STATE"]);
  assert.match(invalid.errors[0].message, /COMPLETE/);

  const stale = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "99", "--reason", "gone", "--next-action", "re-plan"]),
  );
  assert.deepEqual(codesOf(stale), ["TRANSITION_STALE_REVISION"]);
});

// ---------------------------------------------------------------------------
// Section 3.2 / Section 5 rows 8-13 - resolve-decision

test("row 8: resolve-decision records the resolution, clears awaited, and renders deterministically", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "resolve-state.json", decisionDoc(repo));
  const renderPath = renderPathFor(repo);

  const result = run(statePath, "resolve-decision", [
    "--stream", "ORD-1",
    "--expect-revision", "1",
    "--disposition", "SUPERSEDED",
    "--resolver", "planner-cycle-owner",
    "--resolution", "Superseded by the replacement stream.",
    "--superseded-by", "ORD-2",
    "--next-action", "Nothing further is owed by this stream",
    "--now", ISO,
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const stream = doc.streams.find((s) => s.id === "ORD-1");
  assert.equal(stream.state, "SUPERSEDED");
  assert.deepEqual(stream.awaited, []);
  assert.deepEqual(stream.running, []);
  assert.equal(stream.nextAction, "Nothing further is owed by this stream");
  assert.deepEqual(stream.resolution, {
    disposition: "SUPERSEDED",
    resolver: "planner-cycle-owner",
    text: "Superseded by the replacement stream.",
    resolvedAt: ISO,
    supersededBy: "ORD-2",
  });
  // Every other field of the resolved record is untouched.
  const original = stateDocFromFixture("pass-ordinary.json", repo).streams[0];
  assert.equal(stream.git.baseSha, original.git.baseSha);
  assert.equal(stream.gates.total, original.gates.total);
  assert.deepEqual(stream.review, original.review);
  assert.deepEqual(stream.corrections, original.corrections);
  assert.equal(stream.blocker.kind, original.blocker.kind);
  assert.equal(stream.closure, null);
  assert.deepEqual(doc.leases, [], "resolve-decision never touches leases[]");

  const check = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", renderPath], { cwd: repo.dir });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const markdown = fs.readFileSync(renderPath, "utf8");
  assert.match(markdown, /## Resolutions/);
  assert.match(markdown, /planner-cycle-owner/);
  assert.match(markdown, /ORD-2/);
});

test("row 9: resolve-decision rejects an unknown stream, a RUNNING from-state, and a stale revision", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const renderPath = renderPathFor(repo);
  const statePath = writeStateDoc(repo, "resolve-reject-state.json", decisionDoc(repo));
  const base = ["--disposition", "CLOSED", "--resolver", "planner-cycle-owner", "--resolution", "Closed without a replacement.", "--next-action", "Closed"];

  const unknown = assertNoMutation(statePath, renderPath, () => run(statePath, "resolve-decision", ["--stream", "NOPE", "--expect-revision", "1", ...base]));
  assert.deepEqual(codesOf(unknown), ["TRANSITION_STREAM_UNKNOWN"]);

  const runningPath = writeStateDoc(repo, "resolve-running-state.json", cleanRunningDoc(repo));
  const invalid = assertNoMutation(runningPath, renderPath, () => run(runningPath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", ...base]));
  assert.deepEqual(codesOf(invalid), ["TRANSITION_INVALID_STATE"]);

  const stale = assertNoMutation(statePath, renderPath, () => run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "99", ...base]));
  assert.deepEqual(codesOf(stale), ["TRANSITION_STALE_REVISION"]);
});

test("row 10-13: the superseded-by contract is enforced in both directions", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const renderPath = renderPathFor(repo);
  const mk = (name, mutate) => writeStateDoc(repo, name, decisionDoc(repo, mutate));
  const statePath = mk("resolve-rules-state.json");

  const required = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "SUPERSEDED", "--resolver", "planner-cycle-owner", "--resolution", "text", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(required), ["TRANSITION_SUPERSEDED_BY_REQUIRED"]);

  const badDisposition = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "MAYBE", "--resolver", "planner-cycle-owner", "--resolution", "text", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(badDisposition), ["TRANSITION_DISPOSITION_INVALID"]);

  const unknownReplacement = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "SUPERSEDED", "--resolver", "planner-cycle-owner", "--resolution", "text", "--superseded-by", "NOPE", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(unknownReplacement), ["TRANSITION_SUPERSEDED_BY_UNKNOWN"]);

  const selfReplacement = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "SUPERSEDED", "--resolver", "planner-cycle-owner", "--resolution", "text", "--superseded-by", "ORD-1", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(selfReplacement), ["TRANSITION_SUPERSEDED_BY_SELF"]);

  const deadPath = mk("resolve-dead-state.json", (d) => {
    d.streams.find((s) => s.id === "ORD-2").state = "CLOSED";
  });
  const deadReplacement = assertNoMutation(deadPath, renderPath, () =>
    run(deadPath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "SUPERSEDED", "--resolver", "planner-cycle-owner", "--resolution", "text", "--superseded-by", "ORD-2", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(deadReplacement), ["TRANSITION_SUPERSEDED_BY_DEAD"]);

  const notApplicable = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "CLOSED", "--resolver", "planner-cycle-owner", "--resolution", "text", "--superseded-by", "ORD-2", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(notApplicable), ["TRANSITION_SUPERSEDED_BY_NOT_APPLICABLE"]);

  // Row 13: CLOSED records supersededBy null and verifies clean.
  const closed = run(statePath, "resolve-decision", ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "CLOSED", "--resolver", "planner-cycle-owner", "--resolution", "Closed with no replacement.", "--next-action", "Closed"]);
  assert.equal(closed.status, 0, closed.stdout + closed.stderr);
  const resolved = JSON.parse(fs.readFileSync(statePath, "utf8")).streams.find((s) => s.id === "ORD-1");
  assert.equal(resolved.state, "CLOSED");
  assert.equal(resolved.resolution.supersededBy, null);
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.deepEqual(verified.json.errors, []);
});

// ---------------------------------------------------------------------------
// Section 3.1 / Section 5 rows 14-18 - reconcile-stream

test("row 14: reconcile-stream clears a stale blocker on a terminal record without touching anything else", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  // The INTEGRATED terminal shape is used here so no closure receipt is
  // involved; the real COMPLETE `TL-DIAGNOSTICS-LOADING-C06` shape is exercised
  // by register repair step 5 against the live document.
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "INTEGRATED";
    d.streams[0].blocker = { kind: "NONE", detail: "", safeWorkRemaining: true, safeWorkItems: ["read-only preflight", "packet correction"] };
  });
  const statePath = writeStateDoc(repo, "reconcile-blocker-state.json", doc);
  const untouched = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];

  const result = run(statePath, "reconcile-stream", [
    "--stream", "ORD-1",
    "--expect-revision", "1",
    "--blocker-safe-work-remaining", "false",
    "--blocker-safe-work-items", "[]",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const stream = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];
  assert.equal(stream.state, "INTEGRATED", "reconcile-stream never changes state");
  assert.equal(stream.blocker.safeWorkRemaining, false);
  assert.deepEqual(stream.blocker.safeWorkItems, []);
  for (const key of ["git", "gates", "review", "corrections", "successors", "requires", "owners", "approval", "observations", "artifacts", "closure", "objective", "riskTier", "kind"]) {
    assert.deepEqual(stream[key], untouched[key], `${key} must be byte-identical after reconcile-stream`);
  }
});

test("row 15: reconcile-stream replaces a stale forward-looking nextAction on terminal records", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const completeDoc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "INTEGRATED";
    d.streams[0].awaited = ["stale awaited text"];
  });
  const completePath = writeStateDoc(repo, "reconcile-complete-state.json", completeDoc);
  const completeBefore = JSON.parse(fs.readFileSync(completePath, "utf8")).streams[0];
  const complete = run(completePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--next-action", "Await integration verification.", "--awaited", "[]"]);
  assert.equal(complete.status, 0, complete.stdout + complete.stderr);
  const completeAfter = JSON.parse(fs.readFileSync(completePath, "utf8")).streams[0];
  assert.equal(completeAfter.state, "INTEGRATED");
  assert.equal(completeAfter.nextAction, "Await integration verification.");
  assert.deepEqual(completeAfter.awaited, []);
  assert.deepEqual(completeAfter.gates, completeBefore.gates);
  assert.deepEqual(completeAfter.git, completeBefore.git);
  assert.equal(completeAfter.closure, null);

  const reviewedDoc = JSON.parse(JSON.stringify(completeDoc));
  reviewedDoc.streams[0].state = "REVIEW_REQUIRED";
  reviewedDoc.streams[0].nextAction = "stale forward-looking text";
  reviewedDoc.streams[0].awaited = [];
  const reviewedPath = writeStateDoc(repo, "reconcile-reviewed-state.json", reviewedDoc);
  const reviewed = run(reviewedPath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--next-action", "Dispatch fresh QA over the corrected tree."]);
  assert.equal(reviewed.status, 0, reviewed.stdout + reviewed.stderr);
  const reviewedAfter = JSON.parse(fs.readFileSync(reviewedPath, "utf8")).streams[0];
  assert.equal(reviewedAfter.state, "REVIEW_REQUIRED");
  assert.equal(reviewedAfter.nextAction, "Dispatch fresh QA over the corrected tree.");
  assert.deepEqual(reviewedAfter.review, completeBefore.review);
});

test("row 16: reconcile-stream refuses RUNNING", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "reconcile-running-state.json", cleanRunningDoc(repo));
  const report = assertNoMutation(statePath, renderPathFor(repo), () =>
    run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--next-action", "x"]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_INVALID_STATE"]);
  assert.match(report.errors[0].message, /reconcile-stream requires one of/);
});

test("row 17: reconcile-stream refuses an inconsistent blocker combination and a non-strict boolean", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "REVIEW_REQUIRED";
    d.streams[0].running = [];
  });
  const statePath = writeStateDoc(repo, "reconcile-invalid-state.json", doc);
  const renderPath = renderPathFor(repo);

  const inconsistent = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--blocker-safe-work-remaining", "false", "--blocker-safe-work-items", '["still open"]']),
  );
  assert.deepEqual(codesOf(inconsistent), ["TRANSITION_BLOCKER_INCONSISTENT"]);

  for (const bad of ["1", "0", "yes", "", "TRUE"]) {
    const flag = assertNoMutation(statePath, renderPath, () =>
      run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--blocker-safe-work-remaining", bad]),
    );
    assert.deepEqual(codesOf(flag), ["TRANSITION_BLOCKER_FLAG_INVALID"], `--blocker-safe-work-remaining "${bad}" must be rejected`);
  }
});

test("row 17 control: reconcile-stream surfaces the verifier's blocker mismatch as TRANSITION_RESULT_INVALID", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "BLOCKED";
    d.streams[0].running = [];
    d.streams[0].blocker = { kind: "DEPENDENCY", detail: "", safeWorkRemaining: false, safeWorkItems: [] };
  });
  const statePath = writeStateDoc(repo, "reconcile-kind-state.json", doc);
  const report = assertNoMutation(statePath, renderPathFor(repo), () =>
    run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--blocker-kind", "NONE"]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_RESULT_INVALID"]);
  assert.match(report.errors[0].message, /BLOCKER_KIND_MISMATCH/);
});

test("row 18: reconcile-stream refuses a no-op, an unknown stream, an invalid from-state, and a stale revision", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "reconcile-noop-state.json", reconcileDoc(repo));
  const renderPath = renderPathFor(repo);

  const noChanges = assertNoMutation(statePath, renderPath, () => run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1"]));
  assert.deepEqual(codesOf(noChanges), ["TRANSITION_RECONCILE_NO_CHANGES"]);

  const unknown = assertNoMutation(statePath, renderPath, () => run(statePath, "reconcile-stream", ["--stream", "NOPE", "--expect-revision", "1", "--next-action", "x"]));
  assert.deepEqual(codesOf(unknown), ["TRANSITION_STREAM_UNKNOWN"]);

  const runningPath = writeStateDoc(repo, "reconcile-invalid-state-runner.json", cleanRunningDoc(repo));
  const running = assertNoMutation(runningPath, renderPath, () => run(runningPath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--next-action", "x"]));
  assert.deepEqual(codesOf(running), ["TRANSITION_INVALID_STATE"]);

  const stale = assertNoMutation(statePath, renderPath, () => run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "99", "--next-action", "x"]));
  assert.deepEqual(codesOf(stale), ["TRANSITION_STALE_REVISION"]);
});

// ---------------------------------------------------------------------------
// R2.5 / R1 Sec.5 row 20 - repair-read narrowing and monotonicity

test("row 20: an unrelated current defect still fails TRANSITION_STATE_INVALID for abandon-stream", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = runningDoc(repo, (d) => {
    d.streams[0].gates.passed += 1; // GATES_ARITHMETIC, an unrelated defect
  });
  const statePath = writeStateDoc(repo, "abandon-unrelated-state.json", doc);
  const report = assertNoMutation(statePath, renderPathFor(repo), () =>
    run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_STATE_INVALID"]);
  assert.match(report.errors[0].message, /GATES_ARITHMETIC/);
});

test("row 20: monotone repair admits reducing and equal-count repairs and refuses an introduced defect", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = runningDoc(repo, (d) => {
    const second = JSON.parse(JSON.stringify(d.streams[0]));
    second.id = "ORD-2";
    d.streams.push(second);
  });
  const statePath = writeStateDoc(repo, "abandon-two-defects-state.json", doc);
  const renderPath = renderPathFor(repo);
  const defects = () =>
    [...runningWithoutLiveEvidence(JSON.parse(fs.readFileSync(statePath, "utf8")), { heartbeats: [], nowMs: T0, activeWindowMs: WINDOW_MS })].sort();
  assert.deepEqual(
    [...runningWithoutLiveEvidence(doc, { heartbeats: [], nowMs: T0, activeWindowMs: WINDOW_MS })].sort(),
    ["ORD-1", "ORD-2"],
  );

  // Reducing: {ORD-1, ORD-2} -> {ORD-2}. Admitted, and the register stays red
  // because one repairable defect remains.
  const first = run(statePath, "abandon-stream", ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "Re-plan the abandoned work"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.deepEqual(defects(), ["ORD-2"]);
  assert.equal(
    runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir }).status,
    1,
    "the repaired document remains red until the repairable count reaches zero",
  );

  // Equal count on an already-defective document: admitted, and it publishes the
  // document unchanged in that respect. Nothing is hidden: the defect neither
  // disappears nor grows, and the verifier stays red.
  const equal = run(statePath, "reconcile-stream", ["--stream", "ORD-1", "--expect-revision", "2", "--next-action", "Re-plan the abandoned work"]);
  assert.equal(equal.status, 0, equal.stdout + equal.stderr);
  assert.deepEqual(defects(), ["ORD-2"]);
  assert.equal(runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir }).status, 1);

  // Introduction: a RUNNING create-stream with no lease would ADD a liveness
  // defect the current document does not have. Refused, zero mutation.
  const specPath = writeSpec(repo, runningSpec(repo), "row20-create-spec.json");
  const introduced = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "create-stream", ["--stream-spec", specPath, "--observed-origin-main", repo.candidateSha, "--expect-revision", "3"]),
  );
  assert.deepEqual(codesOf(introduced), ["TRANSITION_REPAIR_NOT_MONOTONE"]);
  assert.match(introduced.errors[0].message, /RUNNING_WITHOUT_LIVE_EVIDENCE/);

  // The comparison is the guard's real behaviour, not a vacuous shell.
  assert.equal(isSubMultiset([], ["a"]), true);
  assert.equal(isSubMultiset(["a"], ["a"]), true, "an equal multiset is admitted on an already-defective document");
  assert.equal(isSubMultiset(["a", "a"], ["a"]), false, "a doubled count must not be admitted");
  assert.equal(isSubMultiset(["b"], ["a"]), false, "an introduced tuple must not be admitted");
  assert.equal(isSubMultiset([], []), true, "a clean current document admits a clean candidate");

  // Fully reducing the last defect reaches a clean document.
  const second = run(statePath, "abandon-stream", ["--stream", "ORD-2", "--expect-revision", "3", "--reason", "gone", "--next-action", "Re-plan the abandoned work"]);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
});

// ---------------------------------------------------------------------------
// create-stream atomic lease (Section 3.4)

function runningSpec(repo, mutate) {
  const spec = JSON.parse(JSON.stringify(stateDocFromFixture("pass-ordinary.json", repo).streams[0]));
  spec.id = "NEW-1";
  spec.kind = "STREAM";
  spec.riskTier = "MEDIUM";
  spec.state = "RUNNING";
  spec.nextAction = "Implement the bounded change.";
  spec.awaited = [];
  spec.running = ["executor implementation session"];
  spec.owners = {
    planner: { sessionId: null, status: "NONE", writable: false },
    executor: { sessionId: "ses-fixture-executor", status: "ACTIVE", writable: false },
    qa: { sessionId: null, status: "NONE", writable: false },
    auditor: { sessionId: null, status: "NONE", writable: false },
  };
  spec.git = { worktree: null, branch: "work/new-1", baseSha: repo.baseSha, candidateSha: repo.candidateSha, integrationSha: null, changedPaths: ["candidate.txt"], remoteObservation: null };
  spec.gates = {
    total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0,
    plan: { MANDATORY_SOURCE: 0, MANDATORY_LIVE: 0, DEFERRED_EXTERNAL: 0 },
    classes: {
      MANDATORY_SOURCE: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
      MANDATORY_LIVE: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
      DEFERRED_EXTERNAL: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
    },
  };
  spec.review = { qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null, auditRequired: false, qaRounds: [] };
  spec.closure = null;
  spec.resolution = null;
  const withLease = mutate ? mutate(spec) : spec;
  return withLease;
}

function writeSpec(repo, spec, name) {
  const filePath = path.join(repo.dir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(spec, null, 2)}\n`);
  return filePath;
}

test("create-stream appends exactly one bound ACTIVE lease for a RUNNING spec", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "create-lease-state.json", cleanRunningDoc(repo));
  const specPath = writeSpec(repo, runningSpec(repo), "create-lease-spec.json");

  const result = run(statePath, "create-stream", [
    "--stream-spec", specPath,
    "--observed-origin-main", repo.candidateSha,
    "--expect-revision", "1",
    "--lease-id", "lease-new-1",
    "--lease-role", "executor",
    "--lease-session", "ses-fixture-executor",
    "--now", ISO,
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const leases = doc.leases.filter((lease) => lease.streamId === "NEW-1");
  assert.equal(leases.length, 1, "exactly one lease is bound to the created stream");
  assert.deepEqual(leases[0], {
    id: "lease-new-1",
    streamId: "NEW-1",
    worktree: null,
    role: "executor",
    sessionId: "ses-fixture-executor",
    state: "ACTIVE",
    revision: 1,
    updatedAt: ISO,
    expiresAt: null,
  });
  assert.equal(result.json.summary.boundLeaseId, "lease-new-1");
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
});

test("create-stream: lease flags require a role, and a non-RUNNING record may not carry an atomic lease", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "create-lease-reject-state.json", cleanRunningDoc(repo));
  const renderPath = renderPathFor(repo);
  const specPath = writeSpec(repo, runningSpec(repo), "create-lease-reject-spec.json");
  const identity = ["--stream-spec", specPath, "--observed-origin-main", repo.candidateSha, "--expect-revision", "1"];

  const missingRole = assertNoMutation(statePath, renderPath, () => run(statePath, "create-stream", [...identity, "--lease-id", "lease-x"]));
  assert.deepEqual(codesOf(missingRole), ["TRANSITION_LEASE_ROLE_REQUIRED"]);

  const missingId = assertNoMutation(statePath, renderPath, () => run(statePath, "create-stream", [...identity, "--lease-role", "executor"]));
  assert.deepEqual(codesOf(missingId), ["TRANSITION_LEASE_ID_REQUIRED"]);

  const plannedSpec = writeSpec(repo, runningSpec(repo, (spec) => ({ ...spec, state: "REVIEW_REQUIRED", running: [], nextAction: "Await review." })), "create-lease-planned-spec.json");
  const notRunning = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "create-stream", ["--stream-spec", plannedSpec, "--observed-origin-main", repo.candidateSha, "--expect-revision", "1", "--lease-id", "lease-x", "--lease-role", "executor"]),
  );
  assert.deepEqual(codesOf(notRunning), ["TRANSITION_CREATE_LEASE_STATE_INVALID"]);
});

test("create-stream: a RUNNING spec without lease flags fails closed with the live-evidence rule", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "create-no-lease-state.json", cleanRunningDoc(repo));
  const specPath = writeSpec(repo, runningSpec(repo), "create-no-lease-spec.json");
  const report = assertNoMutation(statePath, renderPathFor(repo), () =>
    run(statePath, "create-stream", ["--stream-spec", specPath, "--observed-origin-main", repo.candidateSha, "--expect-revision", "1"]),
  );
  // The candidate would INTRODUCE a liveness defect the clean current document
  // does not have, so the engine-level monotonicity rule refuses it.
  assert.deepEqual(codesOf(report), ["TRANSITION_REPAIR_NOT_MONOTONE"]);
  assert.match(report.errors[0].message, /RUNNING_WITHOUT_LIVE_EVIDENCE/);
});

// ---------------------------------------------------------------------------
// R2.9 - refresh-artifact-pin

const ARTIFACT_REL = "docs/plans/wfc09-pinned-artifact.txt";

function settledArtifactDoc(repo) {
  const artifactAbs = path.join(repo.dir, ...ARTIFACT_REL.split("/"));
  fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
  fs.writeFileSync(artifactAbs, "pinned artifact v1\n");
  const sha = sha256(fs.readFileSync(artifactAbs));
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "INTEGRATED";
    d.streams[0].awaited = [];
    d.streams[0].running = [];
    d.streams[0].artifacts = [{ path: ARTIFACT_REL, sha256: sha }];
  });
  return { doc, artifactAbs, sha };
}

test("refresh-artifact-pin: a stale pin is refreshed to the presented bytes and only the digest changes", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const { doc, artifactAbs, sha } = settledArtifactDoc(repo);
  const statePath = writeStateDoc(repo, "refresh-pin-state.json", doc);
  const renderPath = renderPathFor(repo);
  assert.equal(codesOf(runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir })).length, 0, "the settled probe must be clean");

  fs.writeFileSync(artifactAbs, "pinned artifact v2\n");
  const newSha = sha256(fs.readFileSync(artifactAbs));
  assert.notEqual(newSha, sha);
  const before = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];

  const result = run(statePath, "refresh-artifact-pin", [
    "--stream", "ORD-1",
    "--expect-revision", "1",
    "--artifact-path", ARTIFACT_REL,
    "--artifact-sha256", newSha,
    "--reason", "the schema/source edit invalidated the pinned bytes",
    "--by", "WF-TRANSITION-TERMINAL-RECONCILE-C09",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.summary.artifactRefresh.path, ARTIFACT_REL);
  assert.equal(result.json.summary.artifactRefresh.sha256, newSha);

  const after = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];
  assert.equal(after.artifacts.length, 1, "no artifact is added or removed");
  assert.equal(after.artifacts[0].path, before.artifacts[0].path, "the path is unchanged");
  assert.equal(after.artifacts[0].sha256, newSha);
  assert.equal(after.state, "INTEGRATED", "the state is unchanged");
  for (const key of ["git", "gates", "review", "corrections", "successors", "requires", "owners", "approval", "observations", "closure", "objective", "riskTier", "kind", "blocker"]) {
    assert.deepEqual(after[key], before[key], `${key} must be byte-identical after refresh-artifact-pin`);
  }

  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  const check = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", renderPath], { cwd: repo.dir });
  assert.equal(check.status, 0, check.stdout + check.stderr);
});

test("refresh-artifact-pin: the three guarded refusals are typed and leave state and render byte-identical", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const { doc, sha } = settledArtifactDoc(repo);
  const statePath = writeStateDoc(repo, "refresh-pin-refuse-state.json", doc);
  const renderPath = renderPathFor(repo);
  const identity = ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "refresh"];

  // Guard 1: the stream carries no entry for that path; a pin may never be created.
  const notPinned = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "refresh-artifact-pin", [...identity, "--artifact-path", "docs/plans/never-pinned.txt", "--artifact-sha256", sha]),
  );
  assert.deepEqual(codesOf(notPinned), ["TRANSITION_ARTIFACT_NOT_PINNED"]);

  // Guard 2: the presented digest does not match the working-tree bytes.
  const wrongHash = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "refresh-artifact-pin", [...identity, "--artifact-path", ARTIFACT_REL, "--artifact-sha256", "0".repeat(64)]),
  );
  assert.deepEqual(codesOf(wrongHash), ["TRANSITION_ARTIFACT_HASH_MISMATCH"]);

  // Guard 2b: a non-64-hex digest is refused before any read.
  const badDigest = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "refresh-artifact-pin", [...identity, "--artifact-path", ARTIFACT_REL, "--artifact-sha256", "not-a-digest"]),
  );
  assert.deepEqual(codesOf(badDigest), ["TRANSITION_ARTIFACT_SHA_INVALID"]);

  // Guard 3: a stream that is not settled cannot have its pin refreshed.
  const runningPath = writeStateDoc(repo, "refresh-pin-running-state.json", cleanRunningDoc(repo));
  const forbidden = assertNoMutation(runningPath, renderPath, () =>
    run(runningPath, "refresh-artifact-pin", ["--stream", "ORD-1", "--expect-revision", "1", "--artifact-path", ARTIFACT_REL, "--artifact-sha256", sha, "--reason", "refresh"]),
  );
  assert.deepEqual(codesOf(forbidden), ["TRANSITION_ARTIFACT_STATE_FORBIDDEN"]);
});

// ---------------------------------------------------------------------------
// R2.10 - register revision-window reservation

test("revision windows: a foreign transition inside a held span is refused byte-identically and the holder's own steps pass", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "window-state.json", reconcileDoc(repo));
  const renderPath = renderPathFor(repo);

  // Step 0 shape: declare the span via the symmetric lease-update path. The
  // fromRevision defaults to the current register revision.
  const declared = run(statePath, "lease-update", [
    "--window-declare", "ORD-1",
    "--window-to", "10",
    "--window-holder", "ORD-1",
    "--by", "ORD-1",
    "--expect-revision", "1",
  ]);
  assert.equal(declared.status, 0, declared.stdout + declared.stderr);
  const declaredAt = declared.json.summary.window.declared.declaredAt;
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath, "utf8")).registry.windows, [
    { streamId: "ORD-1", fromRevision: 1, toRevision: 10, holder: "ORD-1", declaredAt },
  ]);
  const check = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", renderPath], { cwd: repo.dir });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(fs.readFileSync(renderPath, "utf8"), /## Revision windows/);
  assert.match(fs.readFileSync(renderPath, "utf8"), /\| ORD-1 \| 1 \| 10 \| ORD-1 \|/);

  const specPath = writeSpec(repo, runningSpec(repo), "window-create-spec.json");
  const stateBefore = fs.readFileSync(statePath);
  const renderBefore = readOrNull(renderPath);

  // Mandatory negative fixture: a second create-stream at a revision inside the
  // held span with a --by other than the holder.
  const foreign = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "create-stream", [
      "--stream-spec", specPath,
      "--observed-origin-main", repo.candidateSha,
      "--by", "SOME-OTHER-OWNER",
      "--expect-revision", "2",
      "--lease-id", "lease-new-1",
      "--lease-role", "executor",
    ]),
  );
  assert.deepEqual(codesOf(foreign), ["TRANSITION_REVISION_WINDOW_HELD"]);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "the refusal must not mutate the state");
  assert.deepEqual(readOrNull(renderPath), renderBefore, "the refusal must not mutate the render");

  // A foreign document-scoped transition is subject to the same check.
  const foreignDoc = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "coordination-update", ["--mode", "MANUAL", "--by", "SOME-OTHER-OWNER", "--expect-revision", "2"]),
  );
  assert.deepEqual(codesOf(foreignDoc), ["TRANSITION_REVISION_WINDOW_HELD"]);

  // Self-holder control 1: --by equals the window holder.
  const selfBy = run(statePath, "create-stream", [
    "--stream-spec", specPath,
    "--observed-origin-main", repo.candidateSha,
    "--by", "ORD-1",
    "--expect-revision", "2",
    "--lease-id", "lease-new-1",
    "--lease-role", "executor",
  ]);
  assert.equal(selfBy.status, 0, selfBy.stdout + selfBy.stderr);

  // Self-holder control 2: the target stream id equals the window's streamId,
  // even when --by is not the holder.
  const selfTarget = run(statePath, "reconcile-stream", [
    "--stream", "ORD-1",
    "--by", "not-the-declared-holder",
    "--expect-revision", "3",
    "--next-action", "Reconciled by the reserved span's own stream.",
  ]);
  assert.equal(selfTarget.status, 0, selfTarget.stdout + selfTarget.stderr);

  // Explicit release: the documented remedy for a stuck holder. After it, the
  // same foreign document-scoped transition is admitted.
  const released = run(statePath, "lease-update", ["--release-window", "ORD-1", "--by", "ORD-1", "--expect-revision", "4"]);
  assert.equal(released.status, 0, released.stdout + released.stderr);
  // A missing `windows` key and `[]` both mean "no window is declared".
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath, "utf8")).registry.windows ?? [], []);
  const afterRelease = run(statePath, "coordination-update", ["--mode", "MANUAL", "--by", "SOME-OTHER-OWNER", "--expect-revision", "5"]);
  assert.equal(afterRelease.status, 0, afterRelease.stdout + afterRelease.stderr);
});

test("revision windows: a window whose holder reaches a terminal state is released in the same candidate", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "window-auto-state.json", decisionDoc(repo));
  const declared = run(statePath, "lease-update", ["--window-declare", "ORD-1", "--window-to", "10", "--by", "ORD-1", "--expect-revision", "1"]);
  assert.equal(declared.status, 0, declared.stdout + declared.stderr);

  const resolved = run(statePath, "resolve-decision", [
    "--stream", "ORD-1",
    "--expect-revision", "2",
    "--disposition", "CLOSED",
    "--resolver", "planner-cycle-owner",
    "--resolution", "Closed by the holder's own step.",
    "--next-action", "Nothing further is owed.",
    "--by", "ORD-1",
  ]);
  assert.equal(resolved.status, 0, resolved.stdout + resolved.stderr);
  const finalRegistry = JSON.parse(fs.readFileSync(statePath, "utf8")).registry;
  assert.deepEqual(finalRegistry.windows ?? [], [], "the holder reached CLOSED, so the window is released");
  assert.equal(
    Object.prototype.hasOwnProperty.call(finalRegistry, "windows"),
    false,
    "an empty window set stays lazily unmaterialized: absent and [] both mean no window",
  );
});

// ---------------------------------------------------------------------------
// Atomicity, fault injection, coverage map, and the --now plumbing

test("atomicity: injected faults leave state, render, and receipts byte-identical for all four transitions", (t) => {
  const refreshBytes = "pinned artifact refreshed\n";
  const refreshSha = sha256(Buffer.from(refreshBytes));
  const cases = [
    { name: "reconcile-stream", build: (repo) => reconcileDoc(repo), args: ["--stream", "ORD-1", "--expect-revision", "1", "--next-action", "reconciled"] },
    { name: "resolve-decision", build: (repo) => decisionDoc(repo), args: ["--stream", "ORD-1", "--expect-revision", "1", "--disposition", "CLOSED", "--resolver", "planner-cycle-owner", "--resolution", "closed", "--next-action", "closed"] },
    { name: "abandon-stream", build: (repo) => runningDoc(repo), args: ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"] },
    {
      name: "refresh-artifact-pin",
      build: (repo) => {
        const { doc, artifactAbs } = settledArtifactDoc(repo);
        fs.writeFileSync(artifactAbs, refreshBytes);
        return doc;
      },
      args: ["--stream", "ORD-1", "--expect-revision", "1", "--artifact-path", ARTIFACT_REL, "--artifact-sha256", refreshSha, "--reason", "refresh"],
    },
  ];
  for (const testCase of cases) {
    const repo = createTempRepo();
    t.after(() => cleanupRepo(repo.dir));
    const statePath = writeStateDoc(repo, `fault-${testCase.name}.json`, testCase.build(repo));
    const renderPath = renderPathFor(repo);
    for (const fault of ["AFTER_LOCK", "STAGE_STATE", "STAGE_RENDER", "VERIFY_RENDERED"]) {
      const before = fs.readFileSync(statePath);
      const renderBefore = readOrNull(renderPath);
      const report = run(statePath, testCase.name, testCase.args, { env: { ...process.env, ATLAS_WORKFLOW_FAULT: fault } });
      assert.equal(report.status, 1, `${testCase.name}/${fault} must fail`);
      assert.deepEqual(codesOf(report), ["FAULT_INJECTED"], `${testCase.name}/${fault}`);
      assert.deepEqual(fs.readFileSync(statePath), before, `${testCase.name}/${fault} must not change state bytes`);
      assert.deepEqual(readOrNull(renderPath), renderBefore, `${testCase.name}/${fault} must not change render bytes`);
    }
    // A successful transition advances the revision exactly once and publishes
    // state and render together.
    const ok = run(statePath, testCase.name, testCase.args);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).registry.revision, 2);
    assert.ok(readOrNull(renderPath), "the render must be published with the state");
    const check = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", renderPath], { cwd: repo.dir });
    assert.equal(check.status, 0, check.stdout + check.stderr);
  }
});

test("coverage: every production transition is named by the lifecycle traversal's coverage map", () => {
  // The traversal map itself lives in lifecycle-traversal.test.mjs; this asserts
  // the three new transitions are part of the production catalog the traversal
  // must cover (the traversal test fails if any is missing from its map).
  const catalog = listTransitions();
  for (const name of ["abandon-stream", "reconcile-stream", "resolve-decision", "refresh-artifact-pin"]) {
    assert.ok(catalog.includes(name), `${name} must be a production transition`);
  }
});

test("--now plumbing: the flag reaches the engine and both verifications, and malformed values are usage errors", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "now-plumbing-state.json", runningDoc(repo));
  heartbeatStore(commonDirFor(repo), [{ sessionId: "ses-wf-c09", stream: "ORD-1", updatedAt: ISO }]);
  const args = ["--stream", "ORD-1", "--expect-revision", "1", "--reason", "gone", "--next-action", "re-plan"];

  // Inside the window -> the heartbeat blocks; outside -> it does not. That is
  // the flag demonstrably reaching the rule.
  const inside = run(statePath, "abandon-stream", [...args, "--now", new Date(T0 + 1000).toISOString()]);
  assert.deepEqual(codesOf(inside), ["TRANSITION_ABANDON_FRESH_HEARTBEAT"]);
  const outside = run(statePath, "abandon-stream", [...args, "--now", new Date(T0 + WINDOW_MS + 1).toISOString()]);
  assert.equal(outside.status, 0, outside.stdout + outside.stderr);

  const malformedNow = run(statePath, "abandon-stream", [...args, "--now", "not-a-timestamp"]);
  assert.equal(malformedNow.status, 2);
  assert.deepEqual(codesOf(malformedNow), ["USAGE_INVALID_NOW"]);

  const malformedWindow = run(statePath, "abandon-stream", [...args, "--now", ISO, "--active-window-ms", "0"]);
  assert.equal(malformedWindow.status, 2);
  assert.deepEqual(codesOf(malformedWindow), ["USAGE_INVALID_ACTIVE_WINDOW"]);

  const verifyBad = runCli(VERIFY_CLI, ["--state", statePath, "--now", "nope"], { cwd: repo.dir });
  assert.equal(verifyBad.status, 2);
  const renderBad = runCli(RENDER_CLI, ["--state", statePath, "--output", path.join(repo.dir, "r.md"), "--active-window-ms", "-5"], { cwd: repo.dir });
  assert.equal(renderBad.status, 2);
});

test("fail-closed: with no resolvable repository the store is empty and RUNNING is refused", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc09-norepo-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const statePath = path.join(dir, "state.json");
  fs.writeFileSync(statePath, `${JSON.stringify(runningDoc(getSharedRepo()), null, 2)}\n`);
  const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: dir });
  assert.equal(result.status, 1);
  assert.deepEqual(codesOf(result), ["RUNNING_WITHOUT_LIVE_EVIDENCE"]);
});

test("determinism: with zero RUNNING declarations the store and clock are never consulted", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    d.streams[0].state = "REVIEW_REQUIRED";
    d.streams[0].running = [];
  });
  const statePath = writeStateDoc(repo, "determinism-state.json", doc);
  const outA = path.join(repo.dir, "now-a.md");
  const outB = path.join(repo.dir, "now-b.md");
  const first = runCli(RENDER_CLI, ["--state", statePath, "--output", outA, "--now", ISO], { cwd: repo.dir });
  const second = runCli(RENDER_CLI, ["--state", statePath, "--output", outB, "--now", "2030-01-01T00:00:00.000Z"], { cwd: repo.dir });
  assert.equal(first.status, 0, first.stdout);
  assert.equal(second.status, 0, second.stdout);
  assert.deepEqual(fs.readFileSync(outA), fs.readFileSync(outB), "the render must be byte-identical under two clocks");
});

test("scope guard: an explicit foreign --common-dir is refused while a RUNNING declaration consults the store", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const foreign = createTempRepo();
  t.after(() => cleanupRepo(foreign.dir));
  // The store is read only for a document that declares RUNNING, so the guard
  // is only reachable there; with zero RUNNING declarations the store (and this
  // flag) are never consulted.
  const statePath = writeStateDoc(repo, "scope-state.json", cleanRunningDoc(repo));
  const result = runCli(VERIFY_CLI, ["--state", statePath, "--common-dir", path.join(foreign.dir, ".git")], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(codesOf(result), ["STATE_SCOPE_MISMATCH"]);

  const idlePath = writeStateDoc(repo, "scope-idle-state.json", reconcileDoc(repo));
  const idle = runCli(VERIFY_CLI, ["--state", idlePath, "--common-dir", path.join(foreign.dir, ".git")], { cwd: repo.dir });
  assert.equal(idle.status, 0, "with zero RUNNING declarations the store is not consulted at all");
});

test("in-process: the repair-read is one engine-level rule for every transition and a non-repairable defect still refuses", () => {
  const repo = getSharedRepo();
  const stateDir = fs.mkdtempSync(path.join(repo.dir, "wfc09-inprocess-"));
  const statePath = path.join(stateDir, "state.json");
  fs.writeFileSync(statePath, `${JSON.stringify(runningDoc(repo), null, 2)}\n`);

  // The rule is not transition-name-scoped: `reconcile-stream` reads the
  // defective current document and then refuses on its own RUNNING from-state,
  // while `record-executor-return` reads the same document and REPAIRS it by
  // leaving RUNNING. Neither needs a special declaration.
  const reconcile = runTransition({
    statePath,
    transitionName: "reconcile-stream",
    flags: { stream: "ORD-1", "expect-revision": "1", "next-action": "x" },
    now: ISO,
  });
  assert.deepEqual(codesOf(reconcile), ["TRANSITION_INVALID_STATE"], "the current document is readable; the from-state is what refuses");
  const record = runTransition({
    statePath,
    transitionName: "record-executor-return",
    flags: { stream: "ORD-1", "expect-revision": "1", base: repo.baseSha, candidate: repo.candidateSha },
    now: ISO,
  });
  assert.equal(record.status, "ok", JSON.stringify(record.errors));
  assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0].state, "REVIEW_REQUIRED");

  // A current error outside the closed repairable set is never tolerated.
  const brokenPath = path.join(stateDir, "broken.json");
  const broken = runningDoc(repo);
  broken.streams[0].gates.passed += 1; // GATES_ARITHMETIC
  fs.writeFileSync(brokenPath, `${JSON.stringify(broken, null, 2)}\n`);
  const refused = runTransition({
    statePath: brokenPath,
    transitionName: "abandon-stream",
    flags: { stream: "ORD-1", "expect-revision": "1", reason: "gone", "next-action": "Re-plan the abandoned work" },
    now: ISO,
  });
  assert.deepEqual(codesOf(refused), ["TRANSITION_STATE_INVALID"]);

  fs.rmSync(stateDir, { recursive: true, force: true });
});
