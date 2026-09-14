import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  VERIFY_CLI,
  RENDER_CLI,
  createTempRepo,
  cleanupRepo,
  fixtureRaw,
  repoSubstitutions,
  substitute,
  writeState,
  runCli,
  errorCodes,
  sha256,
} from "./harness.mjs";

function materializedState(repo, fixtureName, outName) {
  return writeState(repo, outName, substitute(fixtureRaw(fixtureName), repoSubstitutions(repo)));
}

// A pre-COMPLETE, ACCEPT_READY form that the verifier accepts and that the
// receipt minter can unambiguously select.
function integrationReadyState(repo) {
  const doc = JSON.parse(substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  doc.streams[0].state = "INTEGRATION_READY";
  doc.streams[0].gates = { total: 2, passed: 2, failed: 0, blocked: 0, unperformed: 0 };
  doc.streams[0].review = {
    qaVerdict: "ACCEPT_READY",
    qaSessionId: "sess-qa-mint",
    auditorVerdict: "AUDIT_CLEAR",
    auditorSessionId: "sess-aud-mint",
    auditRequired: false,
  };
  return writeState(repo, "mint-state.json", `${JSON.stringify(doc, null, 2)}\n`);
}

test("verify without --state exits 2 and does not consume a decoy default", (t) => {
  const decoyDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc01-decoy-"));
  t.after(() => fs.rmSync(decoyDir, { recursive: true, force: true }));
  const decoyPath = path.join(decoyDir, "docs", "plans", "atlas-delivery-cycles.json");
  fs.mkdirSync(path.dirname(decoyPath), { recursive: true });
  fs.writeFileSync(decoyPath, "{\"contractVersion\":\"decoy\"}\n");
  const decoyShaBefore = sha256(fs.readFileSync(decoyPath));

  const result = runCli(VERIFY_CLI, [], { cwd: decoyDir });
  assert.equal(result.status, 2);
  assert.equal(result.json.status, "fail");
  assert.deepEqual(errorCodes(result), ["USAGE_MISSING_STATE"]);
  assert.equal(result.json.summary.statePath, null);
  assert.equal(sha256(fs.readFileSync(decoyPath)), decoyShaBefore, "the decoy must not be read or rewritten");
});

test("verify with an unknown flag exits 2", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = materializedState(repo, "pass-ordinary.json", "state.json");
  const result = runCli(VERIFY_CLI, ["--state", statePath, "--manifest", "x.json"], { cwd: repo.dir });
  assert.equal(result.status, 2);
  assert.deepEqual(errorCodes(result), ["USAGE_UNKNOWN_FLAG"]);
});

test("verify with --state but no value exits 2", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const result = runCli(VERIFY_CLI, ["--state"], { cwd: repo.dir });
  assert.equal(result.status, 2);
  assert.deepEqual(errorCodes(result), ["USAGE_MISSING_VALUE_STATE"]);
});

test("render without --output exits 2 and writes nothing", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = materializedState(repo, "pass-ordinary.json", "state.json");
  const result = runCli(RENDER_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 2);
  assert.deepEqual(errorCodes(result), ["USAGE_MISSING_OUTPUT"]);
});

test("receipt mint on a valid state records the exact state bytes", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = integrationReadyState(repo);
  const receiptPath = path.join(repo.dir, "receipts", "mint.json");

  const result = runCli(VERIFY_CLI, ["--state", statePath, "--receipt", receiptPath], { cwd: repo.dir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.ok(fs.existsSync(receiptPath), "receipt file must be created");

  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(receipt.status, "ok");
  assert.equal(receipt.streamId, "ORD-1");
  assert.equal(receipt.stateSha256, sha256(fs.readFileSync(statePath)));
  assert.deepEqual(Object.keys(receipt).sort(), [
    "generatedAt",
    "receiptVersion",
    "statePath",
    "stateSha256",
    "status",
    "streamId",
    "verified",
  ]);
});

test("receipt is never created when the state fails validation", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = materializedState(repo, "fail-gates-arithmetic.json", "state.json");
  const receiptPath = path.join(repo.dir, "receipt-fail.json");

  const result = runCli(VERIFY_CLI, ["--state", statePath, "--receipt", receiptPath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.ok(errorCodes(result).includes("GATES_ARITHMETIC"));
  assert.equal(fs.existsSync(receiptPath), false, "no receipt may be written on failure");
});

test("receipt minting refuses an ambiguous stream selection", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = materializedState(repo, "pass-ordinary.json", "state.json");
  const receiptPath = path.join(repo.dir, "receipt-ambiguous.json");

  const result = runCli(VERIFY_CLI, ["--state", statePath, "--receipt", receiptPath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["RECEIPT_STREAM_AMBIGUOUS"]);
  assert.equal(fs.existsSync(receiptPath), false);
});

test("receipt minting refuses an unknown --stream id", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = integrationReadyState(repo);
  const receiptPath = path.join(repo.dir, "receipt-unknown.json");

  const result = runCli(VERIFY_CLI, ["--state", statePath, "--receipt", receiptPath, "--stream", "NOPE"], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["RECEIPT_STREAM_UNKNOWN"]);
  assert.equal(fs.existsSync(receiptPath), false);
});

test("receipt minting accepts an explicit --stream id", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = integrationReadyState(repo);
  const receiptPath = path.join(repo.dir, "receipt-explicit.json");

  const result = runCli(VERIFY_CLI, ["--state", statePath, "--receipt", receiptPath, "--stream", "ORD-1"], { cwd: repo.dir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(fs.existsSync(receiptPath));
});

test("renderer refuses an invalid state without writing or touching the output", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = materializedState(repo, "fail-gates-arithmetic.json", "state.json");
  const outputPath = path.join(repo.dir, "register.md");
  fs.writeFileSync(outputPath, "SENTINEL\n");
  const before = sha256(fs.readFileSync(outputPath));

  const result = runCli(RENDER_CLI, ["--state", statePath, "--output", outputPath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.equal(result.json.status, "fail");
  assert.ok(errorCodes(result).includes("GATES_ARITHMETIC"));
  assert.equal(sha256(fs.readFileSync(outputPath)), before, "existing output must be left untouched");
});

test("renderer creates the output on a valid state and reports pinned artifacts", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = materializedState(repo, "pass-ordinary.json", "state.json");
  const outputPath = path.join(repo.dir, "nested", "register.md");

  const result = runCli(RENDER_CLI, ["--state", statePath, "--output", outputPath], { cwd: repo.dir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(fs.existsSync(outputPath));
  assert.equal(result.json.status, "ok");
  assert.deepEqual(Object.keys(result.json).sort(), ["artifacts", "errors", "nextActions", "status", "summary"]);
  assert.equal(result.json.summary.streams.total, 1);
  assert.equal(result.json.summary.stateSha256, sha256(fs.readFileSync(statePath)));
});

test("verify on an unreadable state file exits 1", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const result = runCli(VERIFY_CLI, ["--state", path.join(repo.dir, "does-not-exist.json")], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["STATE_UNREADABLE"]);
});

test("verify on an unparseable state file exits 1", (t) => {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const statePath = writeState(repo, "broken.json", "{not json\n");
  const result = runCli(VERIFY_CLI, ["--state", statePath], { cwd: repo.dir });
  assert.equal(result.status, 1);
  assert.deepEqual(errorCodes(result), ["STATE_PARSE_FAILED"]);
});
