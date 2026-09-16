// WF-C10 sections 3.1-3.3 and 3.10 - the HIGH gate writers.
//
// `record-approval`, `record-execution`, and `withdraw-approval` are exercised
// through the real production CLI and the real engine over disposable
// repositories. Every refusal asserts byte-identical state AND render, so a
// refused transition can never leave partial mutation behind. The live register
// is never touched: every fixture is a document under os.tmpdir().
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
  stateDocFromFixture,
  writeStateDoc,
  sha256,
} from "./harness.mjs";

const ISO = "2026-09-17T00:00:00.000Z";
const RENDER_REL = "docs/plans/atlas-active-delivery-streams.generated.md";
const PACKET_REL = "docs/prompts/wfc10-high-approval-packet.md";
const PACKET_BODY = "# HIGH approval packet fixture\nNo directive pins are declared on this line.\n";
const ACTION = "perform the approved action";

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

function run(statePath, transition, args, options = {}) {
  return runCli(TRANSITION_CLI, ["--state", statePath, "--transition", transition, ...args], { cwd: options.cwd });
}

/** A clean HIGH_APPROVAL_REQUIRED document: `approval.required` true, ungranted. */
function highDoc(repo, mutate) {
  const doc = stateDocFromFixture("pass-high-prepared.json", repo, (d) => {
    d.registry.revision = 1;
    const stream = d.streams[0];
    stream.approval.presentedReady = false;
    stream.approval.requiredObservationIds = [];
    stream.observations = [];
    if (mutate) mutate(d);
  });
  return doc;
}

function plainDoc(repo) {
  return stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.leases = [];
    // Not RUNNING: the document must be verifier-clean so the refusal under
    // test is the only failure present.
    d.streams[0].state = "REVIEW_REQUIRED";
    d.streams[0].running = [];
  });
}

function writePacket(repo, body = PACKET_BODY) {
  const abs = path.join(repo.dir, ...PACKET_REL.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return { rel: PACKET_REL, abs, sha: sha256(fs.readFileSync(abs)) };
}

function grantPayload(packet, overrides = {}) {
  return [
    "--packet-path", overrides.packetPath === undefined ? packet.rel : overrides.packetPath,
    "--packet-sha256", overrides.packetSha === undefined ? packet.sha : overrides.packetSha,
    "--operator-identity", "operator-owner",
    "--boundary", "the reviewed HIGH boundary",
    "--approved-actions", JSON.stringify([ACTION]),
    "--now", ISO,
  ];
}

function grantArgs(packet, overrides = {}) {
  return ["--stream", "HIGH-1", "--expect-revision", "1", ...grantPayload(packet, overrides)];
}

/** Publish the render once so a later refusal can be compared byte-for-byte. */
function publishRender(repo, statePath) {
  const result = runCli(RENDER_CLI, ["--state", statePath, "--output", renderPathFor(repo)], { cwd: repo.dir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

function assertNoMutation(statePath, renderPath, action) {
  const stateBefore = fs.readFileSync(statePath);
  const renderBefore = readOrNull(renderPath);
  const report = action();
  const json = report.json;
  assert.ok(json, `expected a JSON report, got: ${report.stdout}${report.stderr}`);
  assert.equal(json.status, "fail", `expected a typed refusal, got ${JSON.stringify(json.errors)}`);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore, "a refused transition must not mutate state");
  assert.deepEqual(readOrNull(renderPath), renderBefore, "a refused transition must not mutate the render");
  return json;
}

function assertClean(repo, statePath) {
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.deepEqual(verified.json.errors, []);
  const check = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", renderPathFor(repo)], { cwd: repo.dir });
  assert.equal(check.status, 0, check.stdout + check.stderr);
}

// ---------------------------------------------------------------------------
// row 1-2 - a complete grant and its idempotent replay

test("row 1: record-approval grants a HIGH stream against its reviewed packet pin and verifies clean", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-grant-state.json", highDoc(repo));

  const result = run(statePath, "record-approval", grantArgs(packet));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const doc = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const stream = doc.streams[0];
  assert.equal(stream.state, "HIGH_APPROVAL_REQUIRED", "record-approval must not change the state");
  assert.equal(stream.approval.granted, true);
  assert.equal(stream.approval.operatorIdentity, "operator-owner");
  assert.equal(stream.approval.approvedAt, ISO, "approvedAt is tool-owned");
  assert.equal(stream.approval.boundary, "the reviewed HIGH boundary");
  assert.deepEqual(stream.approval.approvedActions, [ACTION]);
  assert.equal(stream.approval.presentedReady, false, "record-approval must not set presentedReady");
  assert.deepEqual(stream.approval.requiredObservationIds, []);
  assert.equal(stream.approval.execution, null, "the grant must not fabricate an execution");
  assert.equal(stream.awaited.length, 1, "record-approval leaves awaited untouched");
  assert.equal(doc.registry.revision, 2);

  assertClean(repo, statePath);
});

test("row 2: record-approval replay is refused and leaves state and render byte-identical", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-replay-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);

  const first = run(statePath, "record-approval", grantArgs(packet));
  assert.equal(first.status, 0, first.stdout + first.stderr);
  publishRender(repo, statePath);

  const replay = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-approval", ["--stream", "HIGH-1", "--expect-revision", "2", ...grantPayload(packet)]),
  );
  assert.deepEqual(codesOf(replay), ["TRANSITION_APPROVAL_ALREADY_GRANTED"]);
});

// ---------------------------------------------------------------------------
// row 3-7 - the grant refusals

test("row 3: record-approval without a packet pin is refused with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-nopin-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);
  publishRender(repo, statePath);

  const base = ["--stream", "HIGH-1", "--expect-revision", "1", "--operator-identity", "op", "--boundary", "b", "--approved-actions", JSON.stringify([ACTION])];
  const noPath = assertNoMutation(statePath, renderPath, () => run(statePath, "record-approval", [...base, "--packet-sha256", packet.sha]));
  assert.deepEqual(codesOf(noPath), ["TRANSITION_APPROVAL_PACKET_REQUIRED"]);

  const noSha = assertNoMutation(statePath, renderPath, () => run(statePath, "record-approval", [...base, "--packet-path", packet.rel]));
  assert.deepEqual(codesOf(noSha), ["TRANSITION_APPROVAL_PACKET_REQUIRED"]);
});

test("row 4: record-approval refuses an escaping or absent packet path with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-path-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);
  publishRender(repo, statePath);

  const cases = [
    "../outside-the-repo.md",
    "docs/plans/does-not-exist.md",
    path.join(repo.dir, "docs", "prompts", "wfc10-high-approval-packet.md"),
    "C:/Windows/win.ini",
  ];
  for (const candidate of cases) {
    const report = assertNoMutation(statePath, renderPath, () =>
      run(statePath, "record-approval", grantArgs(packet, { packetPath: candidate })),
    );
    assert.deepEqual(codesOf(report), ["TRANSITION_APPROVAL_PACKET_UNRESOLVED"], `packet path ${candidate}`);
  }
});

test("row 5: record-approval refuses a resolving path with the wrong digest, zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-hash-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);
  publishRender(repo, statePath);

  const wrong = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-approval", grantArgs(packet, { packetSha: "0".repeat(64) })),
  );
  assert.deepEqual(codesOf(wrong), ["TRANSITION_APPROVAL_PACKET_HASH_MISMATCH"]);

  // A digest that is not 64-hex cannot be a pin at all and is refused earlier.
  const malformed = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-approval", grantArgs(packet, { packetSha: "not-a-digest" })),
  );
  assert.deepEqual(codesOf(malformed), ["TRANSITION_APPROVAL_PACKET_SHA_INVALID"]);

  // The digest is the LF-normalized hash: a CRLF copy of the same document
  // still matches. That is the checkout-stability contract of section 3.7.
  const crlfAbs = path.join(repo.dir, "docs", "prompts", "wfc10-crlf-packet.md");
  fs.writeFileSync(crlfAbs, PACKET_BODY.replace(/\n/g, "\r\n"));
  const crlf = run(statePath, "record-approval", grantArgs(packet, { packetPath: "docs/prompts/wfc10-crlf-packet.md", packetSha: sha256(Buffer.from(PACKET_BODY, "utf8")) }));
  assert.equal(crlf.status, 0, crlf.stdout + crlf.stderr);
});

test("row 6: record-approval on a stream that does not require approval is refused", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-notrequired-state.json", plainDoc(repo));
  const renderPath = renderPathFor(repo);
  publishRender(repo, statePath);

  const report = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-approval", [
      "--stream", "ORD-1",
      "--expect-revision", "1",
      "--packet-path", packet.rel,
      "--packet-sha256", packet.sha,
      "--operator-identity", "op",
      "--boundary", "b",
      "--approved-actions", JSON.stringify([ACTION]),
    ]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_APPROVAL_NOT_REQUIRED"]);
});

test("row 7: record-approval from a terminal state is refused", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  for (const terminal of ["CLOSED", "SUPERSEDED"]) {
    const doc = highDoc(repo, (d) => {
      d.streams[0].state = terminal;
      d.streams[0].nextAction = null;
      d.streams[0].awaited = [];
    });
    const statePath = writeStateDoc(repo, `high-terminal-${terminal}.json`, doc);
    const renderPath = renderPathFor(repo);
    publishRender(repo, statePath);
    const report = assertNoMutation(statePath, renderPath, () => run(statePath, "record-approval", grantArgs(packet)));
    assert.deepEqual(codesOf(report), ["TRANSITION_APPROVAL_STATE_FORBIDDEN"], `${terminal}`);
  }
});

// ---------------------------------------------------------------------------
// row 8-11 - recording the execution

test("row 8: record-execution before any grant is refused with zero mutation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeStateDoc(repo, "exec-nogrant-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);
  publishRender(repo, statePath);

  const report = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-execution", ["--stream", "HIGH-1", "--expect-revision", "1", "--actions-performed", JSON.stringify([ACTION]), "--outcome", "done"]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_EXECUTION_WITHOUT_APPROVAL"]);
});

test("row 9: record-execution with an action outside approvedActions is refused", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "exec-outside-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);
  const granted = run(statePath, "record-approval", grantArgs(packet));
  assert.equal(granted.status, 0, granted.stdout + granted.stderr);
  publishRender(repo, statePath);

  const report = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-execution", ["--stream", "HIGH-1", "--expect-revision", "2", "--actions-performed", JSON.stringify(["an unapproved action"]), "--outcome", "done"]),
  );
  assert.deepEqual(codesOf(report), ["TRANSITION_EXECUTION_OUTSIDE_APPROVAL"]);
});

test("row 10: record-execution after a complete grant records the outcome and preserves the grant", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "exec-ok-state.json", highDoc(repo));

  const granted = run(statePath, "record-approval", grantArgs(packet));
  assert.equal(granted.status, 0, granted.stdout + granted.stderr);
  const executed = run(statePath, "record-execution", [
    "--stream", "HIGH-1",
    "--expect-revision", "2",
    "--actions-performed", JSON.stringify([ACTION]),
    "--outcome", "the approved action completed",
    "--by", "executor-owner",
    "--now", ISO,
  ]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);

  const stream = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];
  assert.equal(stream.state, "HIGH_APPROVAL_REQUIRED", "record-execution must not change the state");
  assert.deepEqual(stream.approval.execution, {
    performed: true,
    actionsPerformed: [ACTION],
    evidence: null,
    outcome: "the approved action completed",
    executedAt: ISO,
    recordedBy: "executor-owner",
  });
  // The granted fields and the rest of the stream are untouched.
  assert.equal(stream.approval.granted, true);
  assert.equal(stream.approval.operatorIdentity, "operator-owner");
  assert.equal(stream.approval.boundary, "the reviewed HIGH boundary");
  assert.deepEqual(stream.approval.approvedActions, [ACTION]);
  assertClean(repo, statePath);
});

test("row 11: record-execution replay is refused and leaves state and render byte-identical", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "exec-replay-state.json", highDoc(repo));
  const renderPath = renderPathFor(repo);
  assert.equal(run(statePath, "record-approval", grantArgs(packet)).status, 0);
  const args = ["--stream", "HIGH-1", "--expect-revision", "2", "--actions-performed", JSON.stringify([ACTION]), "--outcome", "done"];
  assert.equal(run(statePath, "record-execution", args).status, 0);
  publishRender(repo, statePath);

  const replay = assertNoMutation(statePath, renderPath, () =>
    run(statePath, "record-execution", ["--stream", "HIGH-1", "--expect-revision", "3", "--actions-performed", JSON.stringify([ACTION]), "--outcome", "again"]),
  );
  assert.deepEqual(codesOf(replay), ["TRANSITION_EXECUTION_ALREADY_RECORDED"]);
});

// ---------------------------------------------------------------------------
// row 12-13 - withdraw-approval

function withdrawalDoc(repo, mutate) {
  return highDoc(repo, (d) => {
    const template = JSON.parse(JSON.stringify(d.streams[0]));
    template.id = "HIGH-2";
    template.state = "PLANNED";
    template.nextAction = "Await the replacement's decision.";
    template.awaited = [];
    d.streams.push(template);
    if (mutate) mutate(d);
  });
}

test("row 12: withdraw-approval reaches each allowed target and verifies clean", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const cases = [
    { target: "INTEGRATION_READY", extra: [] },
    { target: "PLANNED", extra: [] },
    { target: "CLOSED", extra: [] },
    { target: "SUPERSEDED", extra: ["--replacement", "HIGH-2"] },
  ];
  for (const testCase of cases) {
    const statePath = writeStateDoc(repo, `withdraw-${testCase.target}.json`, withdrawalDoc(repo));
    const report = run(statePath, "withdraw-approval", [
      "--stream", "HIGH-1",
      "--expect-revision", "1",
      "--to-state", testCase.target,
      "--reason", "the operator withdrew the pending approval",
      "--next-action", "Re-plan the withdrawn work",
      ...testCase.extra,
    ]);
    assert.equal(report.status, 0, `${testCase.target}: ${report.stdout}${report.stderr}`);
    const stream = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];
    assert.equal(stream.state, testCase.target);
    assert.equal(stream.approval.presentedReady, false, "presentedReady is cleared");
    assert.deepEqual(stream.approval.requiredObservationIds, [], "requiredObservationIds is cleared");
    if (testCase.target !== "CLOSED" && testCase.target !== "SUPERSEDED") {
      assertClean(repo, statePath);
    }
  }
});

test("row 13: withdraw-approval refuses an invalid target, a wrong from-state, and a granted stream", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  // Invalid target.
  const targetPath = writeStateDoc(repo, "withdraw-bad-target.json", withdrawalDoc(repo));
  const targetRender = renderPathFor(repo);
  publishRender(repo, targetPath);
  const invalid = assertNoMutation(targetPath, targetRender, () =>
    run(targetPath, "withdraw-approval", ["--stream", "HIGH-1", "--expect-revision", "1", "--to-state", "RUNNING", "--reason", "r", "--next-action", "n"]),
  );
  assert.deepEqual(codesOf(invalid), ["TRANSITION_WITHDRAW_TARGET_INVALID"]);

  // Wrong from-state.
  const runningPath = writeStateDoc(repo, "withdraw-wrong-state.json", plainDoc(repo));
  const runningRender = renderPathFor(repo);
  publishRender(repo, runningPath);
  const wrongState = assertNoMutation(runningPath, runningRender, () =>
    run(runningPath, "withdraw-approval", ["--stream", "ORD-1", "--expect-revision", "1", "--to-state", "PLANNED", "--reason", "r", "--next-action", "n"]),
  );
  assert.deepEqual(codesOf(wrongState), ["TRANSITION_WITHDRAW_STATE_FORBIDDEN"]);

  // A granted stream is executed, never withdrawn.
  const packet = writePacket(repo);
  const grantedPath = writeStateDoc(repo, "withdraw-granted.json", withdrawalDoc(repo));
  assert.equal(run(grantedPath, "record-approval", grantArgs(packet)).status, 0);
  publishRender(repo, grantedPath);
  const granted = assertNoMutation(grantedPath, renderPathFor(repo), () =>
    run(grantedPath, "withdraw-approval", ["--stream", "HIGH-1", "--expect-revision", "2", "--to-state", "PLANNED", "--reason", "r", "--next-action", "n"]),
  );
  assert.deepEqual(codesOf(granted), ["TRANSITION_APPROVAL_ALREADY_GRANTED"]);

  // A SUPERSEDED withdrawal must name a replacement.
  const missingReplacement = assertNoMutation(targetPath, targetRender, () =>
    run(targetPath, "withdraw-approval", ["--stream", "HIGH-1", "--expect-revision", "1", "--to-state", "SUPERSEDED", "--reason", "r", "--next-action", "n"]),
  );
  assert.deepEqual(codesOf(missingReplacement), ["TRANSITION_WITHDRAW_REPLACEMENT_REQUIRED"]);
});

// ---------------------------------------------------------------------------
// row 14 and 33 - stale revision on every new transition, and render determinism

test("row 14 and 33: a stale revision on every new transition is refused byte-identically", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-stale-state.json", withdrawalDoc(repo));
  const renderPath = renderPathFor(repo);
  assert.equal(run(statePath, "record-approval", grantArgs(packet)).status, 0);
  publishRender(repo, statePath);

  const cases = [
    ["record-approval", ["--stream", "HIGH-2", "--expect-revision", "99", ...grantPayload(packet)]],
    ["record-execution", ["--stream", "HIGH-1", "--expect-revision", "99", "--actions-performed", JSON.stringify([ACTION]), "--outcome", "done"]],
    ["withdraw-approval", ["--stream", "HIGH-2", "--expect-revision", "99", "--to-state", "PLANNED", "--reason", "r", "--next-action", "n"]],
  ];
  for (const [transition, args] of cases) {
    const report = assertNoMutation(statePath, renderPath, () => run(statePath, transition, args));
    assert.deepEqual(codesOf(report), ["TRANSITION_STALE_REVISION"], transition);
  }
});

// ---------------------------------------------------------------------------
// row 30 - A5 `record-executor-return --base <dispatch tip>`

function commitFile(dir, name, body) {
  fs.writeFileSync(path.join(dir, name), body);
  git(dir, ["add", name]);
  git(dir, ["-c", "user.name=WF-C10 Fixture", "-c", "user.email=wfc10@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", name]);
  return git(dir, ["rev-parse", "HEAD"]);
}

test("row 30: an explicit --base different from the spec's git.baseSha is honoured and recorded", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const explicitBase = commitFile(repo.dir, "explicit-base.txt", "explicit base\n");
  const explicitCandidate = commitFile(repo.dir, "explicit-candidate.txt", "explicit candidate\n");
  const doc = stateDocFromFixture("pass-ordinary.json", repo, (d) => {
    d.registry.revision = 1;
    d.streams[0].git.baseSha = repo.baseSha;
    d.streams[0].git.candidateSha = repo.candidateSha;
    d.streams[0].git.changedPaths = ["candidate.txt"];
  });
  const statePath = writeStateDoc(repo, "executor-base-state.json", doc);
  assert.notEqual(explicitBase, repo.baseSha);

  const withBase = run(statePath, "record-executor-return", [
    "--stream", "ORD-1",
    "--expect-revision", "1",
    "--base", explicitBase,
    "--candidate", explicitCandidate,
  ]);
  assert.equal(withBase.status, 0, withBase.stdout + withBase.stderr);
  const stream = JSON.parse(fs.readFileSync(statePath, "utf8")).streams[0];
  assert.equal(stream.state, "REVIEW_REQUIRED");
  assert.equal(stream.git.baseSha, explicitBase, "the explicit --base is recorded, not the spec's value");
  assert.equal(stream.git.candidateSha, explicitCandidate);
  assert.deepEqual(stream.git.changedPaths, ["explicit-candidate.txt"]);

  // Control: without --base the spec's own baseSha is used, so the flag is
  // genuinely load-bearing rather than ignored.
  const controlPath = writeStateDoc(repo, "executor-base-control.json", doc);
  const withoutBase = run(controlPath, "record-executor-return", ["--stream", "ORD-1", "--expect-revision", "1", "--candidate", repo.candidateSha]);
  assert.equal(withoutBase.status, 0, withoutBase.stdout + withoutBase.stderr);
  const control = JSON.parse(fs.readFileSync(controlPath, "utf8")).streams[0];
  assert.equal(control.git.baseSha, repo.baseSha);
});

// ---------------------------------------------------------------------------
// The verifier rules the sanctioned path must never trip

test("the sanctioned path never trips HIGH_EXECUTION_WITHOUT_APPROVAL, HIGH_BOUNDARY_EXCEEDED, or HIGH_APPROVAL_INCOMPLETE", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const packet = writePacket(repo);
  const statePath = writeStateDoc(repo, "high-rules-state.json", highDoc(repo));
  assert.equal(run(statePath, "record-approval", grantArgs(packet)).status, 0);
  assert.equal(
    run(statePath, "record-execution", ["--stream", "HIGH-1", "--expect-revision", "2", "--actions-performed", JSON.stringify([ACTION]), "--outcome", "done"]).status,
    0,
  );
  const verified = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  const codes = verified.json.errors.map((error) => error.code);
  for (const forbidden of ["HIGH_EXECUTION_WITHOUT_APPROVAL", "HIGH_BOUNDARY_EXCEEDED", "HIGH_APPROVAL_INCOMPLETE", "HIGH_DEPENDENCY_MISSING"]) {
    assert.equal(codes.includes(forbidden), false, `${forbidden} must stay unreachable from the sanctioned path`);
  }

  // The verifier's HIGH_BOUNDARY_EXCEEDED stays reachable for a hand-crafted
  // document: the control is real, not vacuous.
  const handcrafted = JSON.parse(fs.readFileSync(statePath, "utf8"));
  handcrafted.streams[0].approval.execution.actionsPerformed = ["an unapproved action"];
  const tamperedPath = writeStateDoc(repo, "high-tampered.json", handcrafted);
  const tampered = runCli(VERIFY_CLI, ["--state", tamperedPath], { cwd: repo.dir });
  assert.equal(tampered.status, 1);
  assert.ok(tampered.json.errors.map((error) => error.code).includes("HIGH_BOUNDARY_EXCEEDED"));
});
