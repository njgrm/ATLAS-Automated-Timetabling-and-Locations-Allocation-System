// WF-C03 (B1) — atomic, bounded, restart-safe heartbeat storage.
//
// The store is a single JSON record per session written with stage-then-rename.
// These controls prove: a reader never observes a partial record, a crash between
// stage and publish leaves the prior record intact, rapid/concurrent writers
// cannot collide or interleave bytes, free-form text is credential-redacted, and
// the record shape is a closed allowlist.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  HEARTBEAT_SCHEMA,
  MAX_HEARTBEAT_BYTES,
  ObservabilityError,
  buildHeartbeat,
  listHeartbeats,
  observabilityPaths,
  readHeartbeat,
  recordEvent,
  stageHeartbeat,
  writeHeartbeat,
} from "../lib/observability.mjs";
import { discardStagedSync, writeFileAtomicSync } from "../lib/util.mjs";

const SID = "ses_wfc03_atomic";
const NOW = "2026-09-15T00:00:00.000Z";
const LATER = "2026-09-15T00:05:00.000Z";

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

function mkCommon(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-atomic-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, paths: observabilityPaths(dir) };
}

function residue(paths) {
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
      else if (entry.name.endsWith(".tmp")) out.push(full);
    }
  };
  walk(paths.root);
  return out;
}

test("a heartbeat publishes atomically and leaves no staged residue", (t) => {
  const { paths } = mkCommon(t);
  const first = writeHeartbeat(paths, buildHeartbeat({ sessionId: SID, status: "ACTIVE" }, { now: NOW }));
  assert.equal(first.schema, HEARTBEAT_SCHEMA);
  assert.deepEqual(fs.readdirSync(paths.sessionsDir), [`${SID}.json`]);

  const second = writeHeartbeat(paths, buildHeartbeat({ sessionId: SID, status: "IDLE", updatedAt: LATER }, { now: LATER }));
  assert.equal(second.status, "IDLE");
  assert.equal(readHeartbeat(paths, SID).status, "IDLE");
  assert.deepEqual(residue(paths), []);
});

test("a crash between stage and publish leaves the prior record intact", (t) => {
  const { paths } = mkCommon(t);
  writeHeartbeat(paths, buildHeartbeat({ sessionId: SID, status: "ACTIVE", nextAction: "prior" }, { now: NOW }));
  const sessionFile = paths.sessionFile(SID);
  const before = fs.readFileSync(sessionFile);

  const staged = stageHeartbeat(paths, buildHeartbeat({ sessionId: SID, status: "IDLE", nextAction: "next", updatedAt: LATER }, { now: LATER }));
  assert.ok(fs.existsSync(staged), "the staged temp must exist before publication");
  assert.deepEqual(fs.readFileSync(sessionFile), before, "the published record must not change while staged");
  assert.equal(readHeartbeat(paths, SID).nextAction, "prior");
  assert.deepEqual(
    listHeartbeats(paths).map((r) => r.sessionId),
    [SID],
    "a staged temp is never read back as a heartbeat",
  );

  // Abandon the staged bytes: the store is exactly as it was.
  discardStagedSync(staged);
  assert.equal(fs.existsSync(staged), false);
  assert.deepEqual(fs.readFileSync(sessionFile), before);
  assert.deepEqual(residue(paths), []);
});

test("a truncated or unreadable record is never returned as a heartbeat", (t) => {
  const { paths } = mkCommon(t);
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  fs.writeFileSync(paths.sessionFile(SID), `${JSON.stringify({ schema: HEARTBEAT_SCHEMA, sessionId: SID }).slice(0, 40)}`);
  assert.equal(readHeartbeat(paths, SID), null, "partial JSON must fail closed");
  assert.deepEqual(listHeartbeats(paths), []);

  fs.writeFileSync(paths.sessionFile(SID), JSON.stringify({ schema: "not.our.schema", sessionId: SID }));
  assert.equal(readHeartbeat(paths, SID), null, "a foreign schema must fail closed");
});

test("rapid successive atomic writes never collide on a staged temp path", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-burst-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "burst.txt");
  for (let i = 0; i < 250; i += 1) writeFileAtomicSync(target, `value ${i}\n`);
  assert.equal(fs.readFileSync(target, "utf8"), "value 249\n");
  assert.deepEqual(fs.readdirSync(dir), ["burst.txt"], "no staged temp may survive a burst");
});

// ---- Multi-process concurrency --------------------------------------------

const WORKER = `
const mod = await import(process.env.WF_OBS_MODULE);
const paths = mod.observabilityPaths(process.env.WF_OBS_COMMON);
const sessionId = process.env.WF_OBS_SESSION;
const rounds = Number(process.env.WF_OBS_ROUNDS);
for (let i = 0; i < rounds; i += 1) {
  const at = new Date(Date.now()).toISOString();
  mod.recordEvent(
    paths,
    { type: "session.updated", properties: { info: { id: sessionId } } },
    { now: at, role: "executor", stream: "WF-C03", processId: process.pid },
  );
}
process.stdout.write("done\\n");
`;

const MODULE_URL = new URL("../lib/observability.mjs", import.meta.url).href;
const TRANSIENT_FS = /EPERM|EACCES|EBUSY|ENOENT|UNKNOWN/;

/**
 * Start `writers` OS processes that each hammer the heartbeat store, and return
 * their exit codes plus stderr. `sessionForWriter(i)` selects the session file
 * each worker owns.
 */
function startWriters({ t, dir, writers, rounds, sessionForWriter }) {
  const workerDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-obs-workers-"));
  t.after(() => fs.rmSync(workerDir, { recursive: true, force: true }));
  const workerFile = path.join(workerDir, "writer.mjs");
  fs.writeFileSync(workerFile, WORKER);

  const children = Array.from({ length: writers }, (_, i) =>
    spawn(process.execPath, [workerFile], {
      env: {
        ...process.env,
        WF_OBS_MODULE: MODULE_URL,
        WF_OBS_COMMON: dir,
        WF_OBS_SESSION: sessionForWriter(i),
        WF_OBS_ROUNDS: String(rounds),
      },
      windowsHide: true,
    }),
  );
  const stderrs = children.map(() => "");
  children.forEach((child, i) => {
    child.stderr.on("data", (d) => {
      stderrs[i] += d;
    });
  });
  const settled = { done: false };
  const exits = Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          child.on("close", (code) => resolve(code));
        }),
    ),
  ).then((codes) => {
    settled.done = true;
    return codes;
  });
  return { children, stderrs, exits, settled };
}

test("concurrent heartbeat writers on their own session files all commit complete records", async (t) => {
  const { dir, paths } = mkCommon(t);
  const WRITERS = 4;
  const sessions = Array.from({ length: WRITERS }, (_, i) => `ses_wfc03_w${i}`);
  const storm = startWriters({ t, dir, writers: WRITERS, rounds: 40, sessionForWriter: (i) => sessions[i] });
  const exits = await storm.exits;

  assert.equal(
    exits.every((code) => code === 0),
    true,
    `every writer must commit: got ${JSON.stringify(exits)}: ${storm.stderrs.map((s) => s.slice(0, 300)).join(" | ")}`,
  );
  const stored = listHeartbeats(paths);
  assert.deepEqual(
    stored.map((r) => r.sessionId).sort(),
    [...sessions].sort(),
    "every concurrent writer must have published its own complete record",
  );
  for (const record of stored) {
    assert.equal(record.schema, HEARTBEAT_SCHEMA);
    assert.equal(Number.isInteger(record.revision) && record.revision >= 1, true, `revision must be positive, got ${record.revision}`);
  }
  assert.deepEqual(residue(paths), [], "no staged temp may survive the storm");
});

test("adversarial same-file writers never corrupt the record a reader observes", async (t) => {
  const { dir, paths } = mkCommon(t);
  recordEvent(paths, { type: "session.created", properties: { info: { id: SID } } }, { now: NOW, role: "executor", stream: "WF-C03", processId: process.pid });

  const WRITERS = 4;
  const storm = startWriters({ t, dir, writers: WRITERS, rounds: 60, sessionForWriter: () => SID });

  const observed = [];
  const failures = [];
  const deadline = Date.now() + 30000;
  // The poll must yield to the event loop, otherwise the children's `close`
  // events can never be delivered and the loop can never observe completion.
  while (!storm.settled.done && Date.now() < deadline) {
    const rec = readHeartbeat(paths, SID);
    if (rec !== null) {
      observed.push(rec);
      try {
        assert.equal(rec.schema, HEARTBEAT_SCHEMA);
        assert.equal(rec.sessionId, SID);
        assert.equal(Number.isInteger(rec.revision) && rec.revision >= 1, true, `revision must be a positive integer, got ${rec.revision}`);
        assert.equal(typeof rec.updatedAt, "string");
      } catch (err) {
        failures.push(err.message);
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  const exits = await storm.exits;

  assert.deepEqual(failures, [], "a reader observed a malformed heartbeat record");
  assert.ok(observed.length > 0, "the reader must have observed at least one record during the storm");

  // Several processes renaming onto the SAME target is outside the documented
  // one-writer-per-session model, so a loser may drop its update. That failure
  // must be a bounded transient filesystem error, never a corrupt write: the
  // staged bytes are discarded, the prior record survives, and no residue is left.
  for (let i = 0; i < exits.length; i += 1) {
    if (exits[i] === 0) continue;
    assert.match(storm.stderrs[i], TRANSIENT_FS, `a failed writer must fail for a transient filesystem reason: ${storm.stderrs[i].slice(0, 300)}`);
  }

  const final = readHeartbeat(paths, SID);
  assert.ok(final, "a complete record must remain after concurrent writers");
  assert.equal(final.sessionId, SID);
  assert.deepEqual(residue(paths), [], "concurrent writers must not leave staged temps behind");
});

// ---- Redaction, allowlist closure, and bounds ------------------------------

test("credential-shaped text cannot survive in any stored text field", (t) => {
  const { paths } = mkCommon(t);
  const secrets = [
    "sk-abcdefghijklmnop0123456789",
    "Bearer abcdefghijklmnopqrstuvwxyz012345",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "ghp_abcdefghijklmnopqrstuvwx",
    "AKIAIOSFODNN7EXAMPLE",
    "xoxb-1234567890-abcdefghijkl",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop",
  ];
  const blob = `opaque ${secrets.join(" | ")}`;
  const record = buildHeartbeat(
    {
      sessionId: SID,
      role: "executor",
      stream: "WF-C03",
      worktree: blob,
      branch: blob,
      leaseId: blob,
      nextAction: blob,
      lastAtomicAction: blob,
      lastEventType: blob,
      status: "ACTIVE",
    },
    { now: NOW },
  );
  const serialized = JSON.stringify(record);
  for (const secret of secrets) assert.equal(serialized.includes(secret), false, `secret must not survive: ${secret}`);
  assert.match(serialized, /\[REDACTED:/);

  writeHeartbeat(paths, record);
  const raw = fs.readFileSync(paths.sessionFile(SID), "utf8");
  for (const secret of secrets) assert.equal(raw.includes(secret), false, `stored file must not contain ${secret}`);
  for (const value of listHeartbeats(paths)) {
    const asText = JSON.stringify(value);
    for (const secret of secrets) assert.equal(asText.includes(secret), false);
  }
});

test("the heartbeat shape is a closed allowlist that drops hostile extra keys", (t) => {
  const { paths } = mkCommon(t);
  const record = buildHeartbeat(
    {
      sessionId: SID,
      status: "ACTIVE",
      role: "executor",
      stream: "WF-C03",
      prompt: "the entire user prompt",
      messages: [{ role: "user", content: "transcript" }],
      command: "git push --force",
      output: "raw command output",
      diff: "--- a/file\n+++ b/file",
      storage: { token: "abc" },
      env: { DATABASE_URL: "postgres://..." },
      apiKey: "sk-should-be-dropped",
    },
    { now: NOW },
  );
  assert.deepEqual(Object.keys(record).sort(), HEARTBEAT_KEYS, "the projection must be a closed allowlist");
  const stored = JSON.stringify(record);
  for (const forbidden of ["transcript", "git push", "raw command output", "DATABASE_URL", "postgres://", "--- a/file"]) {
    assert.equal(stored.includes(forbidden), false, `foreign key content leaked: ${forbidden}`);
  }
  writeHeartbeat(paths, record);
  assert.equal(readHeartbeat(paths, SID).sessionId, SID);
});

test("the heartbeat record is bounded even under pathological input", (t) => {
  const { paths } = mkCommon(t);
  const record = buildHeartbeat({ sessionId: SID, status: "ACTIVE", nextAction: "x".repeat(200000) }, { now: NOW });
  const bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
  assert.ok(bytes <= MAX_HEARTBEAT_BYTES, `record must stay bounded, got ${bytes} bytes`);
  assert.ok(record.nextAction.length <= 240, `next action must be truncated to the field bound, got ${record.nextAction.length}`);

  writeHeartbeat(paths, record);
  assert.ok(fs.statSync(paths.sessionFile(SID)).size <= MAX_HEARTBEAT_BYTES);

  assert.throws(
    () => buildHeartbeat({ sessionId: "a".repeat(200), status: "ACTIVE" }, { now: NOW }),
    (err) => err instanceof ObservabilityError && err.code === "HEARTBEAT_SESSION_ID_INVALID",
  );
});
