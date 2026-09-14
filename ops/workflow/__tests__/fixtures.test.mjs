import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FIXTURES_DIR,
  VERIFY_CLI,
  createTempRepo,
  cleanupRepo,
  fixtureRaw,
  repoSubstitutions,
  substitute,
  writeState,
  makeReceipt,
  writeReceipt,
  runCli,
  errorCodes,
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
};

function prepareFixture(name, repo) {
  const raw = fixtureRaw(name);
  const subs = repoSubstitutions(repo);
  if (!raw.includes("{{RECEIPT_SHA}}")) {
    const statePath = writeState(repo, `state-${name}`, substitute(raw, subs));
    return { statePath };
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

for (const [name, expectation] of Object.entries(EXPECTED)) {
  test(`fixture ${name} expects ${expectation.expect}`, (t) => {
    const repo = createTempRepo();
    t.after(() => cleanupRepo(repo.dir));
    const { statePath } = prepareFixture(name, repo);
    const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });

    if (expectation.expect === "pass") {
      assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stdout}${result.stderr}`);
      assert.equal(result.json.status, "ok");
      assert.deepEqual(result.json.errors, []);
    } else {
      assert.notEqual(result.status, 0, `expected nonzero exit, got 0: ${result.stdout}`);
      assert.equal(result.json.status, "fail");
      assert.ok(
        errorCodes(result).includes(expectation.code),
        `expected ${expectation.code} in ${JSON.stringify(errorCodes(result))}`,
      );
    }
  });
}

test("positive fixtures expose no error codes at all", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  for (const name of ["pass-ordinary.json", "pass-audited-wave.json", "pass-high-prepared.json"]) {
    const { statePath } = prepareFixture(name, repo);
    const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
    assert.equal(result.status, 0, `${name} should pass: ${result.stdout}`);
    assert.deepEqual(errorCodes(result), [], `${name} should report no codes`);
  }
});

test("changed-path fixtures isolate the mismatch direction", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));

  const missing = runCli(VERIFY_CLI, ["--state", prepareFixture("fail-changed-paths.json", repo).statePath], { cwd: repo.dir });
  const missingError = missing.json.errors.find((e) => e.code === "CHANGED_PATHS_MISMATCH");
  assert.ok(missingError, "expected CHANGED_PATHS_MISMATCH for the missing path");
  assert.match(missingError.message, /missing: \[candidate\.txt\]/);
  assert.match(missingError.message, /extra: \[\]/);

  const extra = runCli(VERIFY_CLI, ["--state", prepareFixture("fail-changed-paths-extra.json", repo).statePath], { cwd: repo.dir });
  const extraError = extra.json.errors.find((e) => e.code === "CHANGED_PATHS_MISMATCH");
  assert.ok(extraError, "expected CHANGED_PATHS_MISMATCH for the extra path");
  assert.match(extraError.message, /missing: \[\]/);
  assert.match(extraError.message, /extra: \[extra\.txt\]/);
});
