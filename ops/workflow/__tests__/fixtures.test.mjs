import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FIXTURES_DIR,
  getSharedRepo,
  fixtureRaw,
  repoSubstitutions,
  substitute,
  writeState,
  makeReceipt,
  writeReceipt,
  verifyInProcess,
} from "./harness.mjs";

const EXPECTED = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf8"));

// Fixtures whose closure receipt is materialized by the harness before the run.
const RECEIPT_FIXTURES = {
  "pass-audited-wave.json": {
    receiptRel: "receipt-pass-audited-wave.json",
    streamId: "WAVE-1",
    gates: { total: 5, passed: 5, failed: 0, blocked: 0, unperformed: 0 },
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: "AUDIT_CLEAR",
  },
  "fail-complete-stale-corrections.json": {
    receiptRel: "receipt-stale-corrections.json",
    streamId: "PC-1",
    gates: { total: 6, passed: 6, failed: 0, blocked: 0, unperformed: 0 },
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: "AUDIT_CLEAR",
  },
  "fail-receipt-stale.json": {
    receiptRel: "receipt-stale.json",
    streamId: "RS-1",
    // Deliberately stale on purpose: the stream declares 5/5, the receipt attests 6/6.
    gates: { total: 6, passed: 6, failed: 0, blocked: 0, unperformed: 0 },
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: null,
  },
  "fail-receipt-readiness-live.json": {
    receiptRel: "receipt-readiness-live.json",
    streamId: "RR-1",
    gates: { total: 5, passed: 5, failed: 0, blocked: 0, unperformed: 0 },
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: null,
    // A 1.1.0 receipt that attests live readiness for a source-only stream.
    receiptVersion: "1.1.0",
    readiness: "LIVE_ACCEPTED",
  },
};

function prepareFixture(name, repo) {
  const raw = fixtureRaw(name);
  const subs = repoSubstitutions(repo);
  if (!raw.includes("{{RECEIPT_SHA}}")) {
    return { statePath: writeState(repo, `state-${name}`, substitute(raw, subs)) };
  }
  const spec = RECEIPT_FIXTURES[name];
  assert.ok(spec, `no receipt spec registered for ${name}`);
  const stateRel = `state-${name}`;
  const statePath = writeState(repo, stateRel, substitute(raw, { ...subs, RECEIPT_SHA: "0".repeat(64) }));
  const receipt = makeReceipt({
    statePathAsGiven: stateRel,
    stateBytes: fs.readFileSync(statePath, "utf8"),
    streamId: spec.streamId,
    qaVerdict: spec.qaVerdict,
    auditorVerdict: spec.auditorVerdict,
    gates: spec.gates,
    receiptVersion: spec.receiptVersion,
    readiness: spec.readiness,
  });
  const receiptSha = writeReceipt(repo, spec.receiptRel, receipt);
  fs.writeFileSync(statePath, substitute(raw, { ...subs, RECEIPT_SHA: receiptSha }));
  return { statePath };
}

test("fixture index covers every fixture file", () => {
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith(".json") && name !== "expected.json")
    .sort();
  assert.deepEqual(files, Object.keys(EXPECTED).sort());
});

// Every fixture is validated in-process through the production engine, against a
// single shared disposable repository (A6). The CLI process contract is covered
// separately by cli.test.mjs.
for (const [name, expectation] of Object.entries(EXPECTED)) {
  test(`fixture ${name} expects ${expectation.expect}`, () => {
    const repo = getSharedRepo();
    const { statePath } = prepareFixture(name, repo);
    const result = verifyInProcess(statePath);
    if (expectation.expect === "pass") {
      assert.equal(result.ok, true, `expected a clean verification: ${JSON.stringify(result.errors)}`);
      assert.deepEqual(result.errors, []);
    } else {
      assert.equal(result.ok, false, `expected verification to fail for ${name}`);
      const codes = result.errors.map((e) => e.code);
      assert.ok(codes.includes(expectation.code), `expected ${expectation.code} in ${JSON.stringify(codes)}`);
    }
  });
}

test("positive fixtures expose no error codes at all", () => {
  const repo = getSharedRepo();
  for (const name of ["pass-ordinary.json", "pass-audited-wave.json", "pass-high-prepared.json"]) {
    const { statePath } = prepareFixture(name, repo);
    const result = verifyInProcess(statePath);
    assert.equal(result.ok, true, `${name} should pass: ${JSON.stringify(result.errors)}`);
    assert.deepEqual(result.errors, [], `${name} should report no codes`);
  }
});

test("the corrected counterpart of the stale-corrections fixture verifies clean", () => {
  const repo = getSharedRepo();
  const stateRel = "corrected-stale-state.json";
  const receiptRel = "receipt-stale-corrections.json";
  const source = () => substitute(fixtureRaw("fail-complete-stale-corrections.json"), { ...repoSubstitutions(repo), RECEIPT_SHA: "0".repeat(64) });
  const statePath = writeState(repo, stateRel, source());

  // The corrected document: the post-correction QA session is fresh and the
  // disclosed CORRECTION_REQUIRED round keeps its recorded correction.
  const corrected = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const stream = corrected.streams[0];
  stream.corrections[1].qaSessionId = "sess-qa-fresh";
  stream.review.qaSessionId = "sess-qa-fresh";
  stream.review.qaRounds = [
    { round: 1, verdict: "CORRECTION_REQUIRED", sessionId: "sess-qa-reused" },
    { round: 2, verdict: "ACCEPT_READY", sessionId: "sess-qa-fresh" },
  ];
  fs.writeFileSync(statePath, `${JSON.stringify(corrected, null, 2)}\n`);

  // A receipt that attests the corrected facts, pinned into the final document.
  const receipt = makeReceipt({
    statePathAsGiven: stateRel,
    stateBytes: fs.readFileSync(statePath, "utf8"),
    streamId: "PC-1",
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: "AUDIT_CLEAR",
    gates: { total: 6, passed: 6, failed: 0, blocked: 0, unperformed: 0 },
  });
  const receiptSha = writeReceipt(repo, receiptRel, receipt);
  const finalDoc = JSON.parse(substitute(fixtureRaw("fail-complete-stale-corrections.json"), { ...repoSubstitutions(repo), RECEIPT_SHA: receiptSha }));
  const finalStream = finalDoc.streams[0];
  finalStream.corrections[1].qaSessionId = "sess-qa-fresh";
  finalStream.review.qaSessionId = "sess-qa-fresh";
  finalStream.review.qaRounds = [
    { round: 1, verdict: "CORRECTION_REQUIRED", sessionId: "sess-qa-reused" },
    { round: 2, verdict: "ACCEPT_READY", sessionId: "sess-qa-fresh" },
  ];
  fs.writeFileSync(statePath, `${JSON.stringify(finalDoc, null, 2)}\n`);

  const result = verifyInProcess(statePath);
  assert.equal(result.ok, true, `the corrected counterpart must verify clean: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
});

test("changed-path fixtures isolate the mismatch direction", () => {
  const repo = getSharedRepo();

  const missing = verifyInProcess(prepareFixture("fail-changed-paths.json", repo).statePath);
  const missingError = missing.errors.find((e) => e.code === "CHANGED_PATHS_MISMATCH");
  assert.ok(missingError, "expected CHANGED_PATHS_MISMATCH for the missing path");
  assert.match(missingError.message, /missing: \[candidate\.txt\]/);
  assert.match(missingError.message, /extra: \[\]/);

  const extra = verifyInProcess(prepareFixture("fail-changed-paths-extra.json", repo).statePath);
  const extraError = extra.errors.find((e) => e.code === "CHANGED_PATHS_MISMATCH");
  assert.ok(extraError, "expected CHANGED_PATHS_MISMATCH for the extra path");
  assert.match(extraError.message, /missing: \[\]/);
  assert.match(extraError.message, /extra: \[extra\.txt\]/);
});
