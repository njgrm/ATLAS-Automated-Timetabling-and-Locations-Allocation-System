// WF-C03 (B2/B4) — truthful liveness classification and the `workflow:status`
// production surface.
//
// Classification is driven only by supplied evidence (process presence, custody
// state, recorded status/events), never by heartbeat age alone and never by the
// mere existence of a worktree directory. The CLI rows run against the REAL
// committed register while redirecting all local state into a temp common dir,
// and assert the register bytes are untouched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { STATUS_CLI, REPO_ROOT, runCli, sha256 } from "./harness.mjs";
import { observabilityPaths, writeHeartbeat, buildHeartbeat, OBSERVABILITY_ROOT } from "../lib/observability.mjs";
import { gitCommonDir } from "../lib/git.mjs";
import {
  CLASSIFICATIONS,
  DEFAULT_ACTIVE_WINDOW_MS,
  buildSessionView,
  classifySession,
  recoveryFor,
  reconcileRegister,
  registerSnapshot,
  summarizeClassifications,
} from "../lib/liveness.mjs";

const STATE = path.join(REPO_ROOT, "docs", "plans", "atlas-delivery-cycles.json");
const STATE_DOC = JSON.parse(fs.readFileSync(STATE, "utf8"));
const STATE_SHA = sha256(fs.readFileSync(STATE));
const NOW_ISO = "2026-09-15T00:00:00.000Z";
const NOW = Date.parse(NOW_ISO);

function record(over = {}) {
  return {
    sessionId: "ses_live",
    role: "executor",
    stream: "WF-C01",
    status: "ACTIVE",
    updatedAt: "2026-09-14T23:59:30.000Z",
    lastEventType: "session.updated",
    ...over,
  };
}

/** A real pid whose process has already exited (verified absent at use time). */
function absentPid() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = spawnSync(process.execPath, ["-e", "process.exit(0)"], { windowsHide: true });
    if (typeof res.pid === "number" && !isAlive(res.pid)) return res.pid;
  }
  throw new Error("could not obtain a provably absent pid");
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return Boolean(err && err.code === "EPERM");
  }
}

function snapshotDir(root) {
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

// ---- Classification matrix -------------------------------------------------

test("the classification vocabulary is exactly the six documented states", () => {
  assert.deepEqual(CLASSIFICATIONS, ["ACTIVE", "IDLE", "RETURNED", "ERROR", "STALE_UNCONFIRMED", "UNKNOWN"]);
});

test("ACTIVE requires both a live process and a recent event", () => {
  assert.equal(classifySession({ record: record(), processAlive: true, now: NOW }), "ACTIVE");
  // A recent last event time inside the default window.
  assert.equal(DEFAULT_ACTIVE_WINDOW_MS, 5 * 60 * 1000);
});

test("IDLE is a live process that has gone quiet, not a dead session", () => {
  const stale = record({ updatedAt: new Date(NOW - DEFAULT_ACTIVE_WINDOW_MS - 1000).toISOString() });
  assert.equal(classifySession({ record: stale, processAlive: true, now: NOW }), "IDLE");
  // A live process with no usable timestamp is uncertain-but-live, so IDLE.
  assert.equal(classifySession({ record: record({ updatedAt: undefined }), processAlive: true, now: NOW }), "IDLE");
});

test("RETURNED comes from the session's own terminal event", () => {
  assert.equal(classifySession({ record: record({ status: "RETURNED", lastEventType: "session.deleted" }), processAlive: false, now: NOW }), "RETURNED");
});

test("ERROR comes from the recorded status or an error event", () => {
  assert.equal(classifySession({ record: record({ status: "ERROR" }), processAlive: true, now: NOW }), "ERROR");
  assert.equal(classifySession({ record: record({ status: "ACTIVE", lastEventType: "session.error" }), processAlive: true, now: NOW }), "ERROR");
});

test("an absent process yields STALE_UNCONFIRMED, never a dead verdict", () => {
  const stale = record({ updatedAt: new Date(NOW - 60 * 60 * 1000).toISOString() });
  const classification = classifySession({ record: stale, processAlive: false, now: NOW });
  assert.equal(classification, "STALE_UNCONFIRMED");
  assert.notEqual(classification, "RETURNED");
  assert.notEqual(classification, "ERROR");
  assert.notEqual(classification, "UNKNOWN");
  const guidance = recoveryFor(classification, stale);
  assert.match(guidance, /never assume the session is dead/);
  assert.match(guidance, /compaction checkpoint and machine state/);
});

test("expiry alone never classifies a session dead", () => {
  // The oldest possible heartbeat with no process evidence is still uncertainty.
  const ancient = record({ updatedAt: "2000-01-01T00:00:00.000Z", status: "ACTIVE", lastEventType: "session.idle" });
  assert.equal(classifySession({ record: ancient, processAlive: null, now: NOW }), "STALE_UNCONFIRMED");
  // ... and a live process with an ancient heartbeat is merely IDLE.
  assert.equal(classifySession({ record: ancient, processAlive: true, now: NOW }), "IDLE");
});

test("expired custody marks the session STALE_UNCONFIRMED", () => {
  assert.equal(classifySession({ record: record(), processAlive: true, custodyStale: true, now: NOW }), "STALE_UNCONFIRMED");
});

test("an unreadable or absent record is UNKNOWN", () => {
  assert.equal(classifySession({ record: null, processAlive: true, now: NOW }), "UNKNOWN");
  assert.equal(classifySession({ record: {}, processAlive: true, now: NOW }), "UNKNOWN");
  assert.equal(recoveryFor("UNKNOWN", {}), "no readable heartbeat for this session; do not infer activity from a worktree directory alone");
});

test("a worktree directory existing is never activity on its own", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-worktree-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const view = buildSessionView({ record: record({ worktree: dir, processId: null }), now: NOW });
  assert.notEqual(view.classification, "ACTIVE");
  assert.equal(view.classification, "STALE_UNCONFIRMED");
  assert.equal(view.processAlive, null);
  assert.equal(view.worktree, dir, "the observed directory is still reported as an artifact");
});

test("a live recorded pid is reported with process-presence evidence", () => {
  const view = buildSessionView({ record: record({ processId: process.pid, worktree: null }), now: NOW });
  assert.equal(view.processAlive, true);
  assert.equal(view.classification, "ACTIVE");
  assert.equal(view.processId, process.pid);
  assert.equal(view.ageMs, 30000);
});

test("preview head drift is surfaced without changing classification", () => {
  const view = buildSessionView({
    record: record({ worktree: REPO_ROOT, head: "0".repeat(40), processId: process.pid }),
    now: NOW,
  });
  assert.equal(view.headDrift, true);
  assert.match(view.observedHead, /^[0-9a-f]{40}$/);
  assert.notEqual(view.observedHead, "0".repeat(40));
});

test("the classification summary is exhaustive and additive", () => {
  const views = [{ classification: "ACTIVE" }, { classification: "ERROR" }, { classification: "ACTIVE" }];
  assert.deepEqual(summarizeClassifications(views), {
    ACTIVE: 2,
    IDLE: 0,
    RETURNED: 0,
    ERROR: 1,
    STALE_UNCONFIRMED: 0,
    UNKNOWN: 0,
  });
});

// ---- Register reconciliation ----------------------------------------------

test("the register snapshot indexes every committed stream", () => {
  const snapshot = registerSnapshot(STATE_DOC);
  assert.equal(snapshot.byId.size, STATE_DOC.streams.length);
  for (const stream of STATE_DOC.streams) {
    assert.equal(snapshot.byId.get(stream.id).state, stream.state);
  }
});

test("reconciliation warns on unknown streams, terminal streams with a live heartbeat, and missing owners", () => {
  const register = registerSnapshot(STATE_DOC);
  const live = record({ sessionId: "ses_live", stream: "WF-C01", processId: process.pid });
  const unknown = record({ sessionId: "ses_unknown", stream: "NO-SUCH-STREAM", processId: process.pid });
  const { warnings } = reconcileRegister({ register, heartbeats: [live, unknown] });
  const codes = warnings.map((w) => w.code);
  assert.ok(codes.includes("HEARTBEAT_UNKNOWN_STREAM"), `expected an unknown-stream warning: ${JSON.stringify(warnings)}`);
  assert.ok(codes.includes("HEARTBEAT_ON_TERMINAL_STREAM"), `expected a terminal-stream warning: ${JSON.stringify(warnings)}`);
  assert.deepEqual(codes, [...codes].sort(), "warnings must be deterministically ordered");
});

test("a register lease with no local heartbeat is reported", () => {
  const doc = { ...STATE_DOC, leases: [{ id: "lease-1", streamId: STATE_DOC.streams[0].id, state: "ACTIVE", role: "qa", worktree: null }] };
  const { warnings } = reconcileRegister({ register: registerSnapshot(doc), heartbeats: [] });
  assert.deepEqual(
    warnings.map((w) => w.code),
    ["REGISTER_LEASE_WITHOUT_HEARTBEAT"],
  );
});

// ---- workflow:status end-to-end -------------------------------------------

test("workflow:status reconciles the real committed register over a temp common dir", (t) => {
  const commonDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-status-"));
  t.after(() => fs.rmSync(commonDir, { recursive: true, force: true }));
  const paths = observabilityPaths(commonDir);
  const realCommon = gitCommonDir(REPO_ROOT);
  const realObs = realCommon ? path.join(realCommon, OBSERVABILITY_ROOT) : null;
  const realBefore = realObs ? snapshotDir(realObs) : null;

  const empty = runCli(STATUS_CLI, ["--state", STATE, "--common-dir", commonDir, "--json", "--now", NOW_ISO], { cwd: REPO_ROOT });
  assert.equal(empty.status, 0, empty.stdout + empty.stderr);
  assert.equal(empty.json.status, "ok");
  assert.deepEqual(empty.json.errors, []);
  assert.deepEqual(Object.keys(empty.json).sort(), ["artifacts", "errors", "nextActions", "status", "summary"]);
  assert.equal(empty.json.summary.registerRevision, STATE_DOC.registry.revision);
  assert.equal(empty.json.summary.coordinationMode, STATE_DOC.coordination.mode);
  assert.equal(empty.json.summary.stateSha256, STATE_SHA);
  assert.equal(empty.json.summary.sessions.total, 0);
  assert.equal(empty.json.summary.globalNextAction, STATE_DOC.coordination.globalNextAction);

  // A live session on a terminal stream, and an unknown stream whose process is gone.
  const livePid = process.pid;
  const gonePid = absentPid();
  writeHeartbeat(
    paths,
    buildHeartbeat(
      { sessionId: "ses_wfc03_active", role: "executor", stream: "WF-C01", status: "ACTIVE", processId: livePid, updatedAt: "2026-09-14T23:59:00.000Z" },
      { now: "2026-09-14T23:59:00.000Z" },
    ),
  );
  writeHeartbeat(
    paths,
    buildHeartbeat(
      { sessionId: "ses_wfc03_stale", role: "qa", stream: "NO-SUCH-STREAM", status: "ACTIVE", processId: gonePid, updatedAt: "2026-09-14T20:00:00.000Z" },
      { now: "2026-09-14T20:00:00.000Z" },
    ),
  );

  const result = runCli(STATUS_CLI, ["--state", STATE, "--common-dir", commonDir, "--json", "--now", NOW_ISO], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const views = new Map(result.json.summary.sessions.views.map((v) => [v.sessionId, v]));
  assert.equal(views.size, 2);
  assert.equal(views.get("ses_wfc03_active").classification, "ACTIVE");
  assert.equal(views.get("ses_wfc03_active").processAlive, true);
  assert.equal(views.get("ses_wfc03_stale").classification, "STALE_UNCONFIRMED");
  assert.equal(views.get("ses_wfc03_stale").processAlive, false);
  assert.match(views.get("ses_wfc03_stale").recovery, /never assume the session is dead/);
  assert.equal(result.json.summary.sessions.byClassification.ACTIVE, 1);
  assert.equal(result.json.summary.sessions.byClassification.STALE_UNCONFIRMED, 1);

  const reconcileCodes = result.json.summary.reconcile.warnings.map((w) => w.code);
  assert.ok(reconcileCodes.includes("HEARTBEAT_ON_TERMINAL_STREAM"), JSON.stringify(result.json.summary.reconcile.warnings));
  assert.ok(reconcileCodes.includes("HEARTBEAT_UNKNOWN_STREAM"), JSON.stringify(result.json.summary.reconcile.warnings));

  const heartbeatArtifacts = result.json.artifacts.filter((a) => a.kind === "heartbeat");
  assert.equal(heartbeatArtifacts.length, 2);
  for (const artifact of heartbeatArtifacts) assert.equal(artifact.sha256.length, 64);

  // Human view is concise and carries the recovery instruction.
  const human = runCli(STATUS_CLI, ["--state", STATE, "--common-dir", commonDir, "--now", NOW_ISO], { cwd: REPO_ROOT });
  assert.equal(human.status, 0);
  assert.match(human.stdout, /ATLAS workflow status/);
  assert.match(human.stdout, /STALE_UNCONFIRMED/);
  assert.match(human.stdout, /recovery: /);

  // The register and the real repository common dir are never touched.
  assert.equal(sha256(fs.readFileSync(STATE)), STATE_SHA, "status must not write the committed register");
  if (realObs) assert.deepEqual(snapshotDir(realObs), realBefore, "status must not write the real repository common dir");
  assert.equal(fs.existsSync(path.join(commonDir, "atlas-workflow.lock")), false);
});

test("the notification surface writes only local ring-buffer state", (t) => {
  const commonDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-notify-"));
  t.after(() => fs.rmSync(commonDir, { recursive: true, force: true }));
  const paths = observabilityPaths(commonDir);

  const notified = runCli(
    STATUS_CLI,
    ["--state", STATE, "--common-dir", commonDir, "--json", "--now", NOW_ISO, "--notify-kind", "RETURNED", "--notify-message", "session returned"],
    { cwd: REPO_ROOT },
  );
  assert.equal(notified.status, 0, notified.stdout + notified.stderr);
  const stored = JSON.parse(fs.readFileSync(paths.notificationsFile, "utf8"));
  assert.equal(stored.schema, "atlas.observability.notifications/1");
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].kind, "RETURNED");
  assert.equal(stored.entries[0].message, "session returned");
  assert.equal(sha256(fs.readFileSync(STATE)), STATE_SHA);
  assert.deepEqual(snapshotDir(commonDir).filter((f) => f.endsWith(".lock") || f.endsWith(".tmp")), []);

  const rejected = runCli(
    STATUS_CLI,
    ["--state", STATE, "--common-dir", commonDir, "--json", "--now", NOW_ISO, "--notify-kind", "SPAWN_AGENT"],
    { cwd: REPO_ROOT },
  );
  assert.equal(rejected.status, 1, "an unknown notification kind must fail closed");
  assert.equal(rejected.json.errors[0].code, "NOTIFICATION_KIND_INVALID");
});

test("malformed classification inputs are usage errors, not silent defaults", (t) => {
  const commonDir = fs.mkdtempSync(path.join(os.tmpdir(), "wfc03-usage-"));
  t.after(() => fs.rmSync(commonDir, { recursive: true, force: true }));

  const badNow = runCli(STATUS_CLI, ["--state", STATE, "--common-dir", commonDir, "--now", "yesterday"], { cwd: REPO_ROOT });
  assert.equal(badNow.status, 2);
  assert.equal(badNow.json.errors[0].code, "USAGE_INVALID_NOW");

  const badWindow = runCli(STATUS_CLI, ["--state", STATE, "--common-dir", commonDir, "--active-window-ms", "0"], { cwd: REPO_ROOT });
  assert.equal(badWindow.status, 2);
  assert.equal(badWindow.json.errors[0].code, "USAGE_INVALID_ACTIVE_WINDOW");

  const unknownFlag = runCli(STATUS_CLI, ["--state", STATE, "--common-dir", commonDir, "--nope", "1"], { cwd: REPO_ROOT });
  assert.equal(unknownFlag.status, 2);
  assert.equal(unknownFlag.json.errors[0].code, "USAGE_UNKNOWN_FLAG");
});
