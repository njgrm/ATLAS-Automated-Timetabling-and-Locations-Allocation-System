// A5 — minimal, redaction-safe compaction checkpoint contract.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CHECKPOINT_FIELDS,
  CHECKPOINT_VERSION,
  MAX_CHECKPOINT_BYTES,
  MAX_FORBIDDEN_BOUNDARIES,
  MAX_STRING_LENGTH,
  buildCheckpoint,
  checkpointFromState,
  parseCheckpoint,
  serializeCheckpoint,
} from "../lib/checkpoint.mjs";
import { FIXTURES_DIR, CHECKPOINT_CLI, REPO_ROOT, runCli } from "./harness.mjs";

function validInput(overrides = {}) {
  return {
    streamId: "WF-C02",
    role: "executor",
    worktree: "E:/ATLAS-worktrees/workflow-hardening-c02",
    branch: "work/workflow-hardening-c02",
    baseSha: "84dd537bb2a2c045b8518c35b3a5372142e0080c",
    candidateSha: null,
    integrationSha: null,
    state: "RUNNING",
    revision: "3",
    leaseId: "lease-1",
    directiveHash: "5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5",
    lastCompletedGate: "workflow:test 62/62",
    nextAtomicAction: "commit the bounded candidate",
    forbiddenBoundaries: ["atlas-server/**", "databases"],
    pendingApproval: null,
    ...overrides,
  };
}

test("the checkpoint carries exactly the allowlisted fields and drops unknown input", () => {
  const checkpoint = buildCheckpoint(validInput({ rawTranscript: "secret tool output", credentials: "nope" }));
  assert.deepEqual(Object.keys(checkpoint), ["checkpointVersion", ...CHECKPOINT_FIELDS]);
  assert.equal(checkpoint.checkpointVersion, CHECKPOINT_VERSION);
  assert.equal(Object.prototype.hasOwnProperty.call(checkpoint, "rawTranscript"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(checkpoint, "credentials"), false);
});

test("a checkpoint round-trips through its serialized form", () => {
  const checkpoint = buildCheckpoint(validInput());
  const text = serializeCheckpoint(checkpoint);
  assert.deepEqual(parseCheckpoint(text), checkpoint);
});

test("credential-shaped values are rejected", () => {
  const cases = [
    { field: "nextAtomicAction", value: "use sk-TESTONLYnotarealkey0001" },
    { field: "nextAtomicAction", value: "Authorization: Bearer TESTONLYnotarealtoken1" },
    { field: "nextAtomicAction", value: "-----BEGIN PRIVATE KEY-----" },
    { field: "nextAtomicAction", value: "password=TESTONLYnotarealpassword" },
    { field: "nextAtomicAction", value: "api_key: TESTONLYnotarealvalue" },
    { field: "nextAtomicAction", value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.TESTONLYnotarealsig" },
  ];
  for (const { field, value } of cases) {
    assert.throws(
      () => buildCheckpoint(validInput({ [field]: value })),
      (err) => err && err.code === "CHECKPOINT_SECRET_DETECTED",
      `${value} must be rejected`,
    );
  }
});

test("oversize values and boundary lists are rejected", () => {
  assert.throws(
    () => buildCheckpoint(validInput({ nextAtomicAction: "x".repeat(MAX_STRING_LENGTH + 1) })),
    (err) => err && err.code === "CHECKPOINT_FIELD_TOO_LONG",
  );
  assert.throws(
    () => buildCheckpoint(validInput({ forbiddenBoundaries: Array.from({ length: MAX_FORBIDDEN_BOUNDARIES + 1 }, (_, i) => `b${i}`) })),
    (err) => err && err.code === "CHECKPOINT_TOO_MANY_BOUNDARIES",
  );
});

test("the total checkpoint size stays bounded", () => {
  const long = "y".repeat(MAX_STRING_LENGTH);
  let err = null;
  try {
    buildCheckpoint(validInput({ worktree: long, branch: long, lastCompletedGate: long, nextAtomicAction: long, directiveHash: long }));
  } catch (caught) {
    err = caught;
  }
  assert.ok(err, "an over-limit checkpoint must not be accepted");
  assert.equal(err.code, "CHECKPOINT_TOO_LARGE");
  assert.ok(Buffer.byteLength(JSON.stringify(buildCheckpoint(validInput())), "utf8") < MAX_CHECKPOINT_BYTES);
});

test("role and revision are validated", () => {
  assert.throws(() => buildCheckpoint(validInput({ role: "root" })), (err) => err && err.code === "CHECKPOINT_ROLE_INVALID");
  assert.throws(() => buildCheckpoint(validInput({ revision: "one" })), (err) => err && err.code === "CHECKPOINT_REVISION_INVALID");
});

test("an unsupported checkpoint version fails closed on parse", () => {
  assert.throws(
    () => parseCheckpoint(JSON.stringify({ checkpointVersion: "9.9.9", streamId: "x" })),
    (err) => err && err.code === "CHECKPOINT_VERSION_UNSUPPORTED",
  );
});

test("checkpointFromState derives identity from the authoritative state document", () => {
  const doc = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "pass-ordinary.json"), "utf8"));
  const checkpoint = checkpointFromState(doc, "ORD-1", { role: "planner", leaseId: "lease-9", directiveHash: "abc" });
  assert.equal(checkpoint.streamId, "ORD-1");
  assert.equal(checkpoint.role, "planner");
  assert.equal(checkpoint.state, "RUNNING");
  assert.equal(checkpoint.revision, String(doc.registry.revision));
  assert.equal(checkpoint.nextAtomicAction, doc.streams[0].nextAction);
  assert.equal(checkpoint.leaseId, "lease-9");
  assert.throws(() => checkpointFromState(doc, "MISSING"), (err) => err && err.code === "CHECKPOINT_STREAM_UNKNOWN");
});

test("the checkpoint CLI is a reachable production surface", () => {
  const fixture = path.join(FIXTURES_DIR, "pass-ordinary.json");
  const result = runCli(
    CHECKPOINT_CLI,
    ["--state", fixture, "--stream", "ORD-1", "--role", "executor", "--lease", "lease-1", "--directive", "deadbeef", "--last-gate", "workflow:test", "--boundaries", "atlas-server/**|databases"],
    { cwd: REPO_ROOT },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const checkpoint = result.json.summary.checkpoint;
  assert.equal(checkpoint.streamId, "ORD-1");
  assert.equal(checkpoint.role, "executor");
  assert.deepEqual(checkpoint.forbiddenBoundaries, ["atlas-server/**", "databases"]);

  const rejected = runCli(CHECKPOINT_CLI, ["--state", fixture, "--stream", "ORD-1", "--last-gate", "password=TESTONLYnotarealpassword"], { cwd: REPO_ROOT });
  assert.equal(rejected.status, 1);
  assert.deepEqual(
    rejected.json.errors.map((e) => e.code),
    ["CHECKPOINT_SECRET_DETECTED"],
  );
});
