// WF-C03 (B6) — renderer drift and post-review byte-change controls.
//
// These controls bind "the reviewed bytes are the accepted bytes": a one-byte
// change to the rendered register, or a byte change to a pinned closure-receipt
// artifact, must fail closed with no write.
//
// Post-review identity changes already have committed, purpose-built coverage
// through `ops/workflow/__fixtures__` (driven by `fixtures.test.mjs` and
// `expected.json`); this file re-runs those exact fixtures through the production
// engine and asserts the mapped code so the mapping is load-bearing here too:
//   fail-stale-candidate.json     -> GIT_ANCESTRY            (changed candidate SHA)
//   fail-candidate-unknown.json   -> GIT_SHA_UNKNOWN         (unknown candidate SHA)
//   fail-changed-paths.json       -> CHANGED_PATHS_MISMATCH  (missing reviewed path)
//   fail-changed-paths-extra.json -> CHANGED_PATHS_MISMATCH  (extra path)
//   fail-receipt-missing.json     -> COMPLETE_MISSING_RECEIPT
//   fail-receipt-stale.json       -> RECEIPT_STALE           (receipt-backed; materialized by fixtures.test.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RENDER_CLI,
  REPO_ROOT,
  errorCodes,
  fixtureRaw,
  getSharedRepo,
  makeReceipt,
  repoSubstitutions,
  runCli,
  sha256,
  substitute,
  verifyInProcess,
  writeReceipt,
  writeState,
} from "./harness.mjs";

const STATE = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");
const GENERATED = path.join(REPO_ROOT, "docs", "plans", "atlas-active-delivery-streams.generated.md");

const POST_REVIEW_MAP = {
  "fail-stale-candidate.json": "GIT_ANCESTRY",
  "fail-candidate-unknown.json": "GIT_SHA_UNKNOWN",
  "fail-changed-paths.json": "CHANGED_PATHS_MISMATCH",
  "fail-changed-paths-extra.json": "CHANGED_PATHS_MISMATCH",
  "fail-receipt-missing.json": "COMPLETE_MISSING_RECEIPT",
};

test("the committed generated register already matches the deterministic render", () => {
  const result = runCli(RENDER_CLI, ["--check", "--state", STATE, "--output", GENERATED], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(errorCodes(result), []);
});

test("a one-byte change to a rendered register fails --check without writing", (t) => {
  const repo = getSharedRepo();
  const statePath = writeState(repo, "render-drift-state.json", substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-render-"));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const outputPath = path.join(outDir, "register.md");

  const written = runCli(RENDER_CLI, ["--state", statePath, "--output", outputPath], { cwd: repo.dir });
  assert.equal(written.status, 0, written.stdout + written.stderr);

  const bytes = fs.readFileSync(outputPath);
  assert.ok(bytes.length > 10);
  const index = bytes.length - 2; // the byte immediately before the trailing newline
  bytes[index] = bytes[index] === 0x41 ? 0x42 : 0x41;
  fs.writeFileSync(outputPath, bytes);
  const mutatedSha = sha256(fs.readFileSync(outputPath));

  const checked = runCli(RENDER_CLI, ["--check", "--state", statePath, "--output", outputPath], { cwd: repo.dir });
  assert.equal(checked.status, 1);
  assert.deepEqual(errorCodes(checked), ["RENDER_CHECK_MISMATCH"]);
  assert.equal(sha256(fs.readFileSync(outputPath)), mutatedSha, "--check must never repair or rewrite the output");
});

test("post-review identity changes fail closed for the mapped fixtures", (t) => {
  const repo = getSharedRepo();
  const observed = {};
  for (const [fixture, expectedCode] of Object.entries(POST_REVIEW_MAP)) {
    const statePath = writeState(repo, `postreview-${fixture}`, substitute(fixtureRaw(fixture), repoSubstitutions(repo)));
    const result = verifyInProcess(statePath);
    assert.equal(result.ok, false, `${fixture} must fail closed`);
    const codes = result.errors.map((e) => e.code);
    assert.ok(codes.includes(expectedCode), `${fixture} must report ${expectedCode}, got ${JSON.stringify(codes)}`);
    observed[fixture] = codes;
  }
  assert.equal(Object.keys(observed).length, Object.keys(POST_REVIEW_MAP).length);
});

test("mutating the closure receipt bytes after review fails closed", (t) => {
  const repo = getSharedRepo();
  const raw = fixtureRaw("pass-audited-wave.json");
  const stateRel = "postreview-receipt-state.json";
  // The fixture pins its own receipt path; the harness (as in fixtures.test.mjs)
  // materializes the receipt there and substitutes its hash into the state.
  const receiptRel = "receipt-pass-audited-wave.json";
  const statePath = writeState(repo, stateRel, substitute(raw, { ...repoSubstitutions(repo), RECEIPT_SHA: "0".repeat(64) }));
  const receipt = makeReceipt({
    statePathAsGiven: stateRel,
    stateBytes: fs.readFileSync(statePath, "utf8"),
    streamId: "WAVE-1",
    qaVerdict: "ACCEPT_READY",
    auditorVerdict: "AUDIT_CLEAR",
    gates: { total: 5, passed: 5, failed: 0, blocked: 0, unperformed: 0 },
  });
  const receiptSha = writeReceipt(repo, receiptRel, receipt);
  fs.writeFileSync(statePath, substitute(raw, { ...repoSubstitutions(repo), RECEIPT_SHA: receiptSha }));
  assert.equal(verifyInProcess(statePath).ok, true, "the receipt-backed document must verify before mutation");

  const receiptPath = path.join(repo.dir, receiptRel);
  const bytes = fs.readFileSync(receiptPath);
  bytes[bytes.length - 2] = bytes[bytes.length - 2] === 0x7d ? 0x20 : 0x7d;
  fs.writeFileSync(receiptPath, bytes);

  const after = verifyInProcess(statePath);
  assert.equal(after.ok, false, "a mutated receipt pin must fail closed");
  assert.deepEqual(
    after.errors.map((e) => e.code),
    ["RECEIPT_INVALID"],
    "a byte-mutated receipt must be rejected as invalid",
  );
});
