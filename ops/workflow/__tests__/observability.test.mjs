// WF-C03 (B1/B4/B5) — fake-event mapping, redaction, bounded local notifications.
//
// Every case drives `recordEvent`/`recordToolAction`, which is the exact
// production path the OpenCode plugin calls (the plugin is a thin wrapper).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  observabilityPaths,
  recordEvent,
  recordToolAction,
  readHeartbeat,
  buildHeartbeat,
  listHeartbeats,
  pushNotification,
  readNotifications,
  clearNotifications,
  SUBSCRIBED_EVENTS,
  MAX_NOTIFICATIONS,
} from "../lib/observability.mjs";
import { WORKFLOW_DIR } from "./harness.mjs";

const SID = "ses_wfc03_test";
const NOW = "2026-09-15T00:00:00.000Z";

function mkCommon(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-obs-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return observabilityPaths(dir);
}

function listFiles(root) {
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
      else out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}

const EVENTS = [
  { type: "session.created", event: { type: "session.created", properties: { info: { id: SID } } }, status: "ACTIVE" },
  { type: "session.updated", event: { type: "session.updated", properties: { info: { id: SID } } }, status: "ACTIVE" },
  { type: "session.status", event: { type: "session.status", properties: { sessionID: SID, status: { type: "busy" } } }, status: "ACTIVE" },
  { type: "session.status", event: { type: "session.status", properties: { sessionID: SID, status: { type: "idle" } } }, status: "IDLE" },
  { type: "session.idle", event: { type: "session.idle", properties: { sessionID: SID } }, status: "IDLE" },
  { type: "session.error", event: { type: "session.error", properties: { sessionID: SID, error: { name: "boom", message: "sk-abcdefghijklmnop0123" } } }, status: "ERROR" },
  { type: "session.compacted", event: { type: "session.compacted", properties: { sessionID: SID } }, status: "ACTIVE" },
  { type: "session.deleted", event: { type: "session.deleted", properties: { info: { id: SID } } }, status: "RETURNED" },
  { type: "permission.asked", event: { type: "permission.asked", properties: { id: "req1", sessionID: SID } }, status: "ACTIVE" },
  { type: "permission.replied", event: { type: "permission.replied", properties: { sessionID: SID, requestID: "req1" } }, status: "ACTIVE" },
];

test("the subscribed event inventory matches the fake-event matrix", () => {
  const matrix = new Set(EVENTS.map((e) => e.type));
  assert.deepEqual([...SUBSCRIBED_EVENTS].sort(), [...matrix].sort());
});

for (const { type, event, status } of EVENTS) {
  test(`fake event ${type} (${JSON.stringify(event.properties.status || "")}) updates the heartbeat`, (t) => {
    const paths = mkCommon(t);
    const created = recordEvent(paths, { type: "session.created", properties: { info: { id: SID } } }, { now: NOW, role: "executor", stream: "WF-C03", processId: process.pid, host: "fixture" });
    assert.equal(created.changed, true);
    assert.equal(created.record.status, "ACTIVE");

    const applied = recordEvent(paths, event, { now: NOW });
    assert.equal(applied.changed, true, `event ${type} must change the heartbeat`);
    const stored = readHeartbeat(paths, SID);
    assert.equal(stored.lastEventType, type);
    if (type === "session.status" || type === "session.idle") {
      assert.equal(stored.status, status, `${type} must map its status hint`);
    } else {
      assert.equal(stored.status, status, `${type} must map the expected status`);
    }
  });
}

test("an unsubscribed event is ignored, not recorded", (t) => {
  const paths = mkCommon(t);
  const result = recordEvent(paths, { type: "message.part.updated", properties: { sessionID: SID } }, { now: NOW });
  assert.equal(result.changed, false);
  assert.equal(result.reason, "UNSUBSCRIBED_EVENT");
  assert.deepEqual(listHeartbeats(paths), []);
});

test("an event without a session id is ignored", (t) => {
  const paths = mkCommon(t);
  const result = recordEvent(paths, { type: "session.idle", properties: {} }, { now: NOW });
  assert.equal(result.changed, false);
  assert.equal(result.reason, "NO_SESSION_ID");
});

test("recordToolAction records a sanitized last atomic action and never the arguments", (t) => {
  const paths = mkCommon(t);
  recordEvent(paths, { type: "session.created", properties: { info: { id: SID } } }, { now: NOW });
  const applied = recordToolAction(paths, SID, "bash", { now: NOW });
  assert.equal(applied.changed, true);
  const stored = readHeartbeat(paths, SID);
  assert.equal(stored.lastAtomicAction, "bash");
  const raw = fs.readFileSync(paths.sessionFile(SID), "utf8");
  assert.equal(raw.includes("command"), false, "tool arguments must never be stored");
});

test("redaction removes credential-shaped values from every stored text field", (t) => {
  const paths = mkCommon(t);
  const secrets = [
    "sk-abcdefghijklmnop0123456789",
    "Bearer abcdefghijklmnopqrstuvwxyz012345",
    "-----BEGIN RSA PRIVATE KEY-----",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop",
    "password=hunter2secret",
    "api_key=abcdef1234567890",
  ];
  const record = buildHeartbeat({ sessionId: SID, nextAction: `next: ${secrets.join(" ")}`, status: "ACTIVE" }, { now: NOW });
  for (const secret of secrets) {
    assert.equal(record.nextAction.includes(secret), false, `secret ${secret} must not survive`);
  }
  assert.ok(record.nextAction.includes("[REDACTED:"), "redaction must leave a typed marker");
  paths.sessionFile(SID);
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  fs.writeFileSync(paths.sessionFile(SID), `${JSON.stringify(record, null, 2)}\n`);
  const raw = fs.readFileSync(paths.sessionFile(SID), "utf8");
  for (const secret of secrets) assert.equal(raw.includes(secret), false, `file must not contain ${secret}`);
});

test("notification messages are redacted and the ring buffer is bounded", (t) => {
  const paths = mkCommon(t);
  const secret = "-----BEGIN OPENSSH PRIVATE KEY-----";
  const pushed = pushNotification(paths, { kind: "ERROR", sessionId: SID, message: `failed with ${secret} and token=abcd1234` }, { now: NOW });
  assert.equal(pushed.ok, true);
  const raw = fs.readFileSync(paths.notificationsFile, "utf8");
  assert.equal(raw.includes(secret), false);
  assert.equal(raw.includes("token=abcd1234"), false);
  assert.match(raw, /\[REDACTED:/);

  clearNotifications(paths);
  for (let i = 0; i < MAX_NOTIFICATIONS + 5; i += 1) {
    pushNotification(paths, { kind: "RETURNED", sessionId: SID, message: `entry ${i}` }, { now: NOW });
  }
  const entries = readNotifications(paths).entries;
  assert.equal(entries.length, MAX_NOTIFICATIONS, "the ring buffer must stay bounded");
  assert.equal(entries[entries.length - 1].message, `entry ${MAX_NOTIFICATIONS + 4}`);
});

test("the notification path performs zero external actions", (t) => {
  const paths = mkCommon(t);
  // Mechanism assertion: the module has no import or call that can reach a
  // process, socket, or network. This is paired with the filesystem-delta
  // assertion below so a hidden side effect cannot pass silently.
  const source = fs.readFileSync(path.join(WORKFLOW_DIR, "lib", "observability.mjs"), "utf8");
  for (const forbidden of ["child_process", "node:net", "node:http", "node:https", "node:dns", "spawnSync", "execFile", "fetch("]) {
    assert.equal(source.includes(forbidden), false, `observability lib must not reference ${forbidden}`);
  }

  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  pushNotification(paths, { kind: "ERROR", sessionId: SID, message: "local only" }, { now: NOW });
  const files = listFiles(paths.root);
  assert.deepEqual(files, ["notifications.json"], `only the ring buffer may change, saw ${JSON.stringify(files)}`);
  assert.equal(files.some((f) => f.endsWith(".tmp") || f.endsWith(".lock")), false, "no lock or temp residue may remain");
});
