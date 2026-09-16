// WF-C05 W1 — lifecycle-traversal acceptance for every transition and record
// class.
//
// This suite is the mechanical guard that a newly introduced transition, or a
// record class that can be created but never carried to closure, cannot ship
// tested only at creation. It enumerates the production transition catalog and
// fails naming any transition absent from the traversal coverage map, then drives
// one `create-stream`-created record through the complete lifecycle — executor
// return, both correction rounds, both QA rounds, a lease, coordination,
// integration observation refresh, audit, closure receipt, and a post-closure
// remote observation — in a disposable repository.
//
// The freshness contract requires a correction round to be resolved by an
// ACCEPT_READY round, so a first CORRECTION_REQUIRED result needs a second
// recorded correction before the cycle can be accepted. The traversal therefore
// records two correction rounds (the WF-C05 packet's lifecycle bullet names one;
// a single correction round can never reach a verifier-clean COMPLETE without
// violating POST_CORRECTION_FRESH_QA_MISSING).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TRANSITION_CLI,
  VERIFY_CLI,
  RENDER_CLI,
  createTempRepo,
  cleanupRepo,
  git,
  runCli,
  readJson,
  writeStateDoc,
  stateDocFromFixture,
  sha256,
} from "./harness.mjs";
import { listTransitions } from "../lib/transition.mjs";

const RENDER_REL = "docs/plans/atlas-active-delivery-streams.generated.md";
const RECEIPT_REL = "docs/plans/receipts/wf-c05-traversal.json";
const ISO = "2026-09-16T00:00:00.000Z";

// The transition -> traversal step that exercises it. `listTransitions()` is the
// production catalog; a transition missing from this map fails the suite.
const TRAVERSAL_COVERAGE = {
  "create-stream": "create the NEW-1 record",
  "record-executor-return": "record the executor REVIEW_REQUIRED return",
  "record-correction": "record correction rounds 1 and 2",
  "record-qa-result": "record QA round 1 CORRECTION_REQUIRED and round 2 ACCEPT_READY",
  "coordination-update": "move CYCLE_ACTIVE then MANUAL before integration",
  "record-integration": "integrate with --observed-remote",
  "record-audit": "record the AUDIT_CLEAR wave audit",
  "close-cycle": "close the cycle and pin the receipt",
  "record-remote-observation": "record the post-closure remote observation",
  "lease-update": "create and release the executor lease",
  "abandon-stream": "abandon the orphaned RUNNING record NEW-3 (the liveness defect must be repaired before the final verification)",
  "reconcile-stream": "reconcile the COMPLETE NEW-1 residue",
  "resolve-decision": "resolve the DECISION_REQUIRED NEW-2 record",
  "refresh-artifact-pin": "refresh the invalidated NEW-1 artifact pin",
};

export function uncoveredTransitions(coverage) {
  return listTransitions().filter((name) => !Object.prototype.hasOwnProperty.call(coverage, name));
}

function commitFile(dir, name, body) {
  fs.writeFileSync(path.join(dir, name), body);
  git(dir, ["add", name]);
  git(dir, [
    "-c",
    "user.name=WF-C05 Traversal",
    "-c",
    "user.email=wfc05@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    name,
  ]);
  return git(dir, ["rev-parse", "HEAD"]);
}

// The created-stream spec: a schema-complete 1.2.0 record cloned from the
// ordinary fixture.
function lifecycleSpec(repo) {
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
    executor: { sessionId: "ses-traversal-executor", status: "ACTIVE", writable: false },
    qa: { sessionId: null, status: "NONE", writable: false },
    auditor: { sessionId: null, status: "NONE", writable: false },
  };
  spec.review = { qaVerdict: null, qaSessionId: null, auditorVerdict: null, auditorSessionId: null, auditRequired: true, qaRounds: [] };
  spec.gates = {
    total: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    unperformed: 0,
    plan: { MANDATORY_SOURCE: 0, MANDATORY_LIVE: 0, DEFERRED_EXTERNAL: 0 },
    classes: {
      MANDATORY_SOURCE: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
      MANDATORY_LIVE: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
      DEFERRED_EXTERNAL: { total: 0, passed: 0, failed: 0, blocked: 0, unperformed: 0 },
    },
  };
  spec.git = {
    worktree: null,
    branch: "work/new-1",
    baseSha: repo.baseSha,
    candidateSha: repo.candidateSha,
    integrationSha: null,
    changedPaths: ["candidate.txt"],
    remoteObservation: null,
  };
  return spec;
}

function readOrNull(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

// Drive the created record to ACCEPT_READY, returning the committed SHAs and the
// current revision. `steps` records the transition names exercised.
function driveToAcceptReady(repo, statePath, specPath, steps) {
  const identity = [
    "--state",
    statePath,
    "--transition",
  ];
  const run = (transition, args) => {
    const result = runCli(TRANSITION_CLI, [...identity, transition, ...args], { cwd: repo.dir });
    assert.equal(result.status, 0, `${transition} failed: ${result.stdout}${result.stderr}`);
    steps.add(transition);
    return result.json;
  };

  const created = run("create-stream", ["--expect-revision", "1", "--stream-spec", specPath, "--observed-origin-main", repo.candidateSha, "--lease-id", "lease-new-1", "--lease-role", "executor", "--lease-session", "ses-traversal-executor"]);
  assert.equal(created.summary.created, true);
  const stream = readJson(statePath).streams.find((s) => s.id === "NEW-1");
  assert.equal(stream.git.remoteObservation.sha, repo.candidateSha, "the creation observation is the pre-integration tip");

  run("record-executor-return", ["--stream", "NEW-1", "--expect-revision", "2", "--base", repo.baseSha, "--candidate", repo.candidateSha]);
  run("record-correction", ["--stream", "NEW-1", "--expect-revision", "3", "--candidate", repo.correction1Sha, "--reason", "first bounded correction"]);
  run("record-qa-result", [
    "--stream", "NEW-1",
    "--expect-revision", "4",
    "--qa-verdict", "CORRECTION_REQUIRED",
    "--qa-session", "ses-corr-qa-1",
    "--gates", "0/0/0/0/0",
    "--gates-classes", "MANDATORY_SOURCE=0/0/0/0/0,MANDATORY_LIVE=0/0/0/0/0,DEFERRED_EXTERNAL=0/0/0/0/0",
  ]);
  run("record-correction", ["--stream", "NEW-1", "--expect-revision", "5", "--candidate", repo.correction2Sha, "--reason", "second bounded correction"]);
  run("record-qa-result", [
    "--stream", "NEW-1",
    "--expect-revision", "6",
    "--qa-verdict", "ACCEPT_READY",
    "--qa-session", "ses-qa-2",
    "--gates", "1/1/0/0/0",
    "--gates-classes", "MANDATORY_SOURCE=1/1/0/0/0,MANDATORY_LIVE=0/0/0/0/0,DEFERRED_EXTERNAL=0/0/0/0/0",
    "--gates-plan", "MANDATORY_SOURCE=1,MANDATORY_LIVE=0,DEFERRED_EXTERNAL=0",
  ]);
  run("lease-update", ["--stream", "NEW-1", "--expect-revision", "7", "--lease-id", "lease-new-1", "--lease-state", "ACTIVE", "--lease-role", "executor", "--lease-session", "ses-traversal-executor"]);
  run("coordination-update", ["--expect-revision", "8", "--mode", "CYCLE_ACTIVE", "--active-cycle-id", "NEW-1", "--global-next-action", "integrate the accepted candidate"]);
  run("coordination-update", ["--expect-revision", "9", "--mode", "MANUAL"]);
  return { statePath, revision: readJson(statePath).registry.revision };
}

function fullTraversal(t) {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const correction1Sha = commitFile(repo.dir, "correction-1.txt", "correction one\n");
  const correction2Sha = commitFile(repo.dir, "correction-2.txt", "correction two\n");
  const integratedSha = commitFile(repo.dir, "integrated.txt", "integrated\n");
  const shas = { ...repo, correction1Sha, correction2Sha, integratedSha };

  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
  });
  const statePath = writeStateDoc(repo, "docs/plans/traversal-state.json", doc);
  const specPath = path.join(repo.dir, "docs", "plans", "traversal-spec.json");
  fs.writeFileSync(specPath, `${JSON.stringify(lifecycleSpec(repo), null, 2)}\n`);

  const steps = new Set();
  const { revision } = driveToAcceptReady(shas, statePath, specPath, steps);

  const run = (transition, args) => {
    steps.add(transition);
    const result = runCli(TRANSITION_CLI, ["--state", statePath, "--transition", transition, ...args], { cwd: repo.dir });
    return result;
  };

  // Failing-first: a created record integrated without refreshing the observation
  // can never reach closure. The exact code must be REMOTE_OBSERVATION_INVALID.
  const beforeFailing = fs.readFileSync(statePath);
  const renderPath = path.join(repo.dir, ...RENDER_REL.split("/"));
  const renderBefore = readOrNull(renderPath);
  const failing = run("record-integration", ["--stream", "NEW-1", "--expect-revision", String(revision), "--integration", integratedSha]);
  assert.equal(failing.status, 1, "integration without --observed-remote must fail closed");
  assert.deepEqual(
    failing.json.errors.map((e) => e.code),
    ["TRANSITION_RESULT_INVALID"],
  );
  assert.match(failing.json.errors[0].message, /REMOTE_OBSERVATION_INVALID/);
  assert.deepEqual(fs.readFileSync(statePath), beforeFailing, "the rejected integration must not mutate state");
  assert.deepEqual(readOrNull(renderPath), renderBefore, "the rejected integration must not mutate the render");

  const integrated = run("record-integration", ["--stream", "NEW-1", "--expect-revision", String(revision), "--integration", integratedSha, "--observed-remote", integratedSha]);
  assert.equal(integrated.status, 0, integrated.stdout + integrated.stderr);
  const afterIntegration = readJson(statePath);
  const integratedStream = afterIntegration.streams.find((s) => s.id === "NEW-1");
  assert.equal(integratedStream.state, "INTEGRATED");
  assert.equal(integratedStream.git.remoteObservation.sha, integratedSha, "the observation is refreshed to the integrated tip");
  let rev = revision + 1;

  // The lease must be released before closure: COMPLETE with a live lease is
  // rejected (COMPLETE_WITH_LIVE_LEASE).
  const released = run("lease-update", ["--stream", "NEW-1", "--expect-revision", String(rev), "--lease-id", "lease-new-1", "--lease-state", "RETURNED", "--lease-role", "executor"]);
  assert.equal(released.status, 0, released.stdout + released.stderr);
  rev += 1;

  const audited = run("record-audit", ["--stream", "NEW-1", "--expect-revision", String(rev), "--auditor-verdict", "AUDIT_CLEAR", "--auditor-session", "ses-audit"]);
  assert.equal(audited.status, 0, audited.stdout + audited.stderr);
  rev += 1;

  const closed = run("close-cycle", ["--stream", "NEW-1", "--expect-revision", String(rev), "--receipt", RECEIPT_REL]);
  assert.equal(closed.status, 0, closed.stdout + closed.stderr);
  const receiptPath = path.join(repo.dir, ...RECEIPT_REL.split("/"));
  assert.ok(fs.existsSync(receiptPath), "the closure receipt must be minted");
  rev += 1;

  const observed = run("record-remote-observation", ["--stream", "NEW-1", "--expect-revision", String(rev), "--ref", "refs/remotes/origin/main", "--observed-sha", integratedSha]);
  assert.equal(observed.status, 0, observed.stdout + observed.stderr);
  rev += 1;

  // ---- The terminal/reconcile transitions (C09 traversal coverage) ----
  // Two additional records are written directly with their exact production
  // shapes: an orphaned RUNNING record (its lease is already RETURNED and no
  // heartbeat names it) and a DECISION_REQUIRED record with a defined
  // replacement. The fixture's own ORD-1 ACTIVE lease is preserved, so the only
  // liveness defect the document ever carries is NEW-3's, and abandoning it is
  // what makes the final document verifier-clean.
  const terminalDoc = readJson(statePath);
  const template = stateDocFromFixture("pass-ordinary.json", repo).streams[0];
  const decision = JSON.parse(JSON.stringify(template));
  decision.id = "NEW-2";
  decision.state = "DECISION_REQUIRED";
  decision.nextAction = "Record the decision.";
  decision.awaited = ["operator/planner decision"];
  decision.running = [];
  const orphan = JSON.parse(JSON.stringify(template));
  orphan.id = "NEW-3";
  orphan.state = "RUNNING";
  orphan.nextAction = "Implement the bounded change.";
  orphan.awaited = [];
  orphan.running = ["a session that is gone"];
  terminalDoc.streams.push(decision, orphan);
  // NEW-1 gains one genuinely pinned artifact so the artifact-pin refresh has a
  // real production path to exercise; the pin is invalidated later in the
  // traversal and repaired by the transition.
  const artifactRel = "docs/plans/traversal-pinned-artifact.txt";
  const artifactAbs = path.join(repo.dir, ...artifactRel.split("/"));
  fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
  fs.writeFileSync(artifactAbs, "traversal artifact v1\n");
  terminalDoc.streams.find((s) => s.id === "NEW-1").artifacts = [{ path: artifactRel, sha256: sha256(fs.readFileSync(artifactAbs)) }];
  terminalDoc.leases.push(
    { id: "lease-new-3", streamId: "NEW-3", worktree: null, role: "executor", sessionId: "ses-gone", state: "RETURNED", revision: 2, updatedAt: ISO, expiresAt: null },
  );
  terminalDoc.registry.revision = rev;
  fs.writeFileSync(statePath, `${JSON.stringify(terminalDoc, null, 2)}\n`);

  const abandoned = run("abandon-stream", ["--stream", "NEW-3", "--expect-revision", String(rev), "--reason", "the session is gone", "--next-action", "Re-plan the abandoned work"]);
  assert.equal(abandoned.status, 0, abandoned.stdout + abandoned.stderr);
  rev += 1;

  const reconciled = run("reconcile-stream", ["--stream", "NEW-1", "--expect-revision", String(rev), "--next-action", "Closed; no further action is owed"]);
  assert.equal(reconciled.status, 0, reconciled.stdout + reconciled.stderr);
  rev += 1;

  const resolved = run("resolve-decision", [
    "--stream", "NEW-2",
    "--expect-revision", String(rev),
    "--disposition", "SUPERSEDED",
    "--resolver", "planner-cycle-owner",
    "--resolution", "Superseded by the closed traversal record.",
    "--superseded-by", "NEW-1",
    "--next-action", "Nothing further is owed by this record",
  ]);
  assert.equal(resolved.status, 0, resolved.stdout + resolved.stderr);
  rev += 1;

  // The pin is invalidated by a real byte change and refreshed through the
  // transition, leaving the document verifier-clean.
  fs.writeFileSync(artifactAbs, "traversal artifact v2\n");
  const refreshed = run("refresh-artifact-pin", [
    "--stream", "NEW-1",
    "--expect-revision", String(rev),
    "--artifact-path", artifactRel,
    "--artifact-sha256", sha256(fs.readFileSync(artifactAbs)),
    "--reason", "the traversal edit invalidated the pinned bytes",
  ]);
  assert.equal(refreshed.status, 0, refreshed.stdout + refreshed.stderr);
  rev += 1;

  return { repo, statePath, specPath, shas, steps, receiptPath, integratedSha, correction1Sha, correction2Sha };
}

test("every production transition is covered by the lifecycle traversal", () => {
  assert.deepEqual(TRAVERSAL_COVERAGE["record-audit"] !== undefined, true);
  const uncovered = uncoveredTransitions(TRAVERSAL_COVERAGE);
  assert.deepEqual(uncovered, [], `transitions missing from the traversal coverage map: ${uncovered.join(", ")}`);

  // Load-bearing control: removing a transition from the map must be detected
  // and named, otherwise the guard is vacuous.
  const mutated = { ...TRAVERSAL_COVERAGE };
  delete mutated["record-audit"];
  assert.deepEqual(uncoveredTransitions(mutated), ["record-audit"]);
});

test("one created record traverses every transition and record class to a verifier-clean closure", (t) => {
  const { repo, statePath, steps, receiptPath, integratedSha } = fullTraversal(t);
  const finalDoc = readJson(statePath);
  const stream = finalDoc.streams.find((s) => s.id === "NEW-1");

  const mappedButUnused = Object.keys(TRAVERSAL_COVERAGE).filter((name) => !steps.has(name));
  assert.deepEqual(mappedButUnused, [], `the traversal did not exercise: ${mappedButUnused.join(", ")}`);

  assert.equal(stream.state, "COMPLETE");
  assert.equal(stream.review.qaVerdict, "ACCEPT_READY");
  assert.equal(stream.review.auditorVerdict, "AUDIT_CLEAR");

  // Corrections trail: two recorded rounds, each resolved by a fresh QA session.
  assert.equal(stream.corrections.length, 2);
  assert.deepEqual(stream.corrections.map((c) => c.round), [1, 2]);
  assert.equal(stream.corrections[1].qaVerdict, "ACCEPT_READY");
  assert.equal(stream.corrections[1].qaSessionId, "ses-qa-2");
  assert.notEqual(stream.corrections[0].qaSessionId, stream.corrections[1].qaSessionId, "the post-correction QA session must be fresh");

  // QA rounds: round 1 disclosed the correction, round 2 accepted with a fresh
  // session, and the last round is the current verdict.
  assert.deepEqual(stream.review.qaRounds, [
    { round: 1, verdict: "CORRECTION_REQUIRED", sessionId: "ses-corr-qa-1" },
    { round: 2, verdict: "ACCEPT_READY", sessionId: "ses-qa-2" },
  ]);

  // The receipt pin resolves, mints 1.1.0, and attests source-only readiness.
  const receipt = readJson(receiptPath);
  assert.equal(receipt.receiptVersion, "1.1.0");
  assert.equal(receipt.verified.readiness, "SOURCE_ONLY");
  assert.equal(receipt.streamId, "NEW-1");
  assert.match(receipt.stateSha256, /^[0-9a-f]{64}$/);

  // The remote observation is the refreshed post-closure snapshot.
  assert.equal(stream.git.remoteObservation.sha, integratedSha);
  assert.equal(stream.git.remoteObservation.kind, "REMOTE_TRACKING_REF");

  // The final document verifies clean and renders.
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.deepEqual(verified.json.errors, []);
  const out = path.join(repo.dir, "rendered.md");
  const rendered = runCli(RENDER_CLI, ["--state", statePath, "--output", out], { cwd: repo.dir });
  assert.equal(rendered.status, 0, rendered.stdout + rendered.stderr);
  const markdown = fs.readFileSync(out, "utf8");
  assert.match(markdown, /NEW-1/);
  assert.match(markdown, /SOURCE_ONLY/);
});
