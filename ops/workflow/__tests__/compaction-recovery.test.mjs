// WF-C03 (B4) — compaction and permission observations, and recovery from the
// minimal checkpoint plus machine state rather than from chat memory.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CHECKPOINT_CLI, REPO_ROOT, runCli } from "./harness.mjs";
import { observabilityPaths, readHeartbeat, recordEvent } from "../lib/observability.mjs";

const SID = "ses_wfc03_compaction";
const NOW = "2026-09-15T00:00:00.000Z";
const LATER = "2026-09-15T00:10:00.000Z";
const STATE = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");

const HEARTBEAT_KEYS = [
  "branch",
  "expiresAt",
  "firstSeenAt",
  "head",
  "host",
  "lastAtomicAction",
  "lastEventAt",
  "lastEventType",
  "leaseId",
  "nextAction",
  "processId",
  "revision",
  "role",
  "schema",
  "sessionId",
  "status",
  "stream",
  "transitions",
  "updatedAt",
  "worktree",
];

function mkPaths(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-compaction-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return observabilityPaths(dir);
}

test("session.compacted is recorded as a sanitized transition and preserves identity", (t) => {
  const paths = mkPaths(t);
  recordEvent(
    paths,
    { type: "session.created", properties: { info: { id: SID } } },
    {
      now: NOW,
      role: "executor",
      stream: "WF-C01",
      worktree: "E:\\ATLAS-worktrees\\example",
      branch: "work/example",
      head: "a".repeat(40),
      leaseId: "lease-example",
      processId: process.pid,
    },
  );
  const before = readHeartbeat(paths, SID);

  const applied = recordEvent(paths, { type: "session.compacted", properties: { sessionID: SID } }, { now: LATER, role: "executor", stream: "WF-C01" });
  assert.equal(applied.changed, true);

  const after = readHeartbeat(paths, SID);
  for (const field of ["sessionId", "role", "stream", "worktree", "branch", "head", "leaseId"]) {
    assert.equal(after[field], before[field], `${field} must survive compaction`);
  }
  assert.equal(after.lastEventType, "session.compacted");
  assert.equal(after.updatedAt, LATER);
  assert.equal(after.revision, before.revision + 1);
  assert.ok(
    after.transitions.some((transition) => transition.type === "session.compacted"),
    "the compaction must be visible in the sanitized transition list",
  );
  assert.equal(after.status, "ACTIVE");
});

test("permission events are recorded as local transitions and grant no authority", (t) => {
  const paths = mkPaths(t);
  recordEvent(paths, { type: "session.created", properties: { info: { id: SID } } }, { now: NOW, role: "executor", stream: "WF-C01", processId: process.pid });
  const before = readHeartbeat(paths, SID);

  recordEvent(
    paths,
    { type: "permission.asked", properties: { sessionID: SID, id: "req-1", permission: "bash", patterns: ["*"], always: ["*"] } },
    { now: LATER },
  );
  recordEvent(paths, { type: "permission.replied", properties: { sessionID: SID, response: "always", remember: true } }, { now: LATER });

  const record = readHeartbeat(paths, SID);
  assert.deepEqual(Object.keys(record).sort(), HEARTBEAT_KEYS, "permission payloads must not widen the record allowlist");
  const serialized = JSON.stringify(record);
  // The sanitized transition list legitimately names the event type; what must
  // never survive is the payload that could express a grant or a remembered rule.
  for (const forbidden of ['"always"', "remember", '"patterns"', "granted", '"response"', "req-1"]) {
    assert.equal(serialized.includes(forbidden), false, `a permission payload must never be stored: ${forbidden}`);
  }
  assert.ok(record.transitions.some((transition) => transition.type === "permission.asked"));
  assert.ok(record.transitions.some((transition) => transition.type === "permission.replied"));
  assert.equal(record.status, before.status, "a permission reply must not change session status");
});

test("the minimal checkpoint recovers the stream identity from machine state", () => {
  const register = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const stream = register.streams.find((s) => s.id === "WF-C01");
  assert.ok(stream, "WF-C01 must exist in the committed register");

  const result = runCli(CHECKPOINT_CLI, ["--state", STATE, "--stream", "WF-C01", "--role", "executor", "--directive", "a".repeat(64)], {
    cwd: REPO_ROOT,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  const checkpoint = result.json.summary.checkpoint;

  assert.equal(checkpoint.checkpointVersion, "1.0.0");
  assert.equal(checkpoint.streamId, "WF-C01");
  assert.equal(checkpoint.state, stream.state);
  assert.equal(checkpoint.revision, String(register.registry.revision));
  assert.equal(checkpoint.directiveHash, "a".repeat(64));
  assert.equal(checkpoint.worktree, stream.git.worktree);
  assert.equal(checkpoint.branch, stream.git.branch);
  assert.equal(checkpoint.candidateSha, stream.git.candidateSha);
  assert.equal(checkpoint.nextAtomicAction, stream.nextAction);
  assert.ok(Buffer.byteLength(JSON.stringify(checkpoint), "utf8") <= 2048, "a checkpoint must stay minimal");
  assert.equal(/sk-|Bearer |BEGIN |password=/.test(JSON.stringify(checkpoint)), false, "a checkpoint never carries secrets");
});

test("the checkpoint CLI refuses an unknown stream without writing", () => {
  const result = runCli(CHECKPOINT_CLI, ["--state", STATE, "--stream", "NO-SUCH-STREAM"], { cwd: REPO_ROOT });
  assert.equal(result.status, 1);
  assert.equal(result.json.errors[0].code, "CHECKPOINT_STREAM_UNKNOWN");
});

test("a compacted session recovers its stream from the heartbeat plus the checkpoint", (t) => {
  const paths = mkPaths(t);
  recordEvent(
    paths,
    { type: "session.created", properties: { info: { id: SID } } },
    { now: NOW, role: "executor", stream: "WF-C01", processId: process.pid },
  );
  recordEvent(paths, { type: "session.compacted", properties: { sessionID: SID } }, { now: LATER });

  const heartbeat = readHeartbeat(paths, SID);
  const result = runCli(CHECKPOINT_CLI, ["--state", STATE, "--stream", heartbeat.stream, "--role", heartbeat.role], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const register = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const stream = register.streams.find((s) => s.id === heartbeat.stream);
  assert.equal(result.json.summary.checkpoint.streamId, heartbeat.stream);
  assert.equal(result.json.summary.checkpoint.state, stream.state);
  assert.equal(result.json.summary.checkpoint.nextAtomicAction, stream.nextAction);
});
