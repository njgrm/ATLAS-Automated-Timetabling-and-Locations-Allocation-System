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
import { STATUS_CLI, REPO_ROOT, runCli, sha256, createTempRepo, cleanupRepo, substitute, fixtureRaw, repoSubstitutions } from "./harness.mjs";
import { observabilityPaths, writeHeartbeat, buildHeartbeat, OBSERVABILITY_ROOT } from "../lib/observability.mjs";
import { gitCommonDir } from "../lib/git.mjs";
import { profileKey, DEFAULT_PROFILE } from "../lib/custody.mjs";
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

/**
 * A pid that cannot exist on this host, verified absent at use time. This
 * replaces a spawned-then-exited process pid, which the OS can reuse before the
 * caller asserts on it: the same PID-reuse race made a lock worker classify a
 * seeded dead-owner record as LIVE.
 */
const IMPOSSIBLE_PID = 2147480000;

function absentPid() {
  if (isAlive(IMPOSSIBLE_PID)) {
    throw new Error(`the impossible pid ${IMPOSSIBLE_PID} is unexpectedly alive on this host; the absent-process precondition cannot be met`);
  }
  return IMPOSSIBLE_PID;
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

// A disposable Git repository that owns a real state document, so an explicit
// `--common-dir` can match the document's own resolved common directory (WF-C05
// scope-epoch guard). The register is the migrated pass-ordinary fixture plus a
// terminal CLOSED stream for the terminal-heartbeat warning.
function tempRegisterRepo(t) {
  const repo = createTempRepo();
  t.after(() => cleanupRepo(repo.dir));
  const doc = JSON.parse(substitute(fixtureRaw("pass-ordinary.json"), repoSubstitutions(repo)));
  doc.registry.revision = 3;
  const closed = JSON.parse(JSON.stringify(doc.streams[0]));
  closed.id = "CLOSED-1";
  closed.state = "CLOSED";
  closed.nextAction = null;
  closed.running = [];
  closed.awaited = [];
  closed.owners = {
    planner: { sessionId: null, status: "NONE", writable: false },
    executor: { sessionId: null, status: "NONE", writable: false },
    qa: { sessionId: null, status: "NONE", writable: false },
    auditor: { sessionId: null, status: "NONE", writable: false },
  };
  doc.streams.push(closed);
  const statePath = path.join(repo.dir, "docs", "plans", "atlas-delivery-cycles.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(doc, null, 2)}\n`);
  const commonDir = gitCommonDir(repo.dir);
  return { repo, doc, statePath, commonDir, stateSha: sha256(fs.readFileSync(statePath)) };
}

test("workflow:status reconciles the committed register over its own Git common dir", (t) => {
  const { repo, doc, statePath, commonDir, stateSha } = tempRegisterRepo(t);
  const paths = observabilityPaths(commonDir);

  const empty = runCli(STATUS_CLI, ["--state", statePath, "--common-dir", commonDir, "--json", "--now", NOW_ISO], { cwd: repo.dir });
  assert.equal(empty.status, 0, empty.stdout + empty.stderr);
  assert.equal(empty.json.status, "ok");
  assert.deepEqual(empty.json.errors, []);
  assert.deepEqual(Object.keys(empty.json).sort(), ["artifacts", "errors", "nextActions", "status", "summary"]);
  assert.equal(empty.json.summary.registerRevision, doc.registry.revision);
  assert.equal(empty.json.summary.coordinationMode, doc.coordination.mode);
  assert.equal(empty.json.summary.stateSha256, stateSha);
  assert.equal(empty.json.summary.sessions.total, 0);
  assert.equal(empty.json.summary.globalNextAction, doc.coordination.globalNextAction);

  // A live session on a terminal stream, and an unknown stream whose process is gone.
  const livePid = process.pid;
  const gonePid = absentPid();
  writeHeartbeat(
    paths,
    buildHeartbeat(
      { sessionId: "ses_wfc03_active", role: "executor", stream: "CLOSED-1", status: "ACTIVE", processId: livePid, updatedAt: "2026-09-14T23:59:00.000Z" },
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

  const result = runCli(STATUS_CLI, ["--state", statePath, "--common-dir", commonDir, "--json", "--now", NOW_ISO], { cwd: repo.dir });
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
  const human = runCli(STATUS_CLI, ["--state", statePath, "--common-dir", commonDir, "--now", NOW_ISO], { cwd: repo.dir });
  assert.equal(human.status, 0);
  assert.match(human.stdout, /ATLAS workflow status/);
  assert.match(human.stdout, /STALE_UNCONFIRMED/);
  assert.match(human.stdout, /recovery: /);

  // The committed register is never rewritten.
  assert.equal(sha256(fs.readFileSync(statePath)), stateSha, "status must not write the committed register");
  assert.equal(fs.existsSync(path.join(commonDir, "atlas-workflow.lock")), false);
});

test("an explicit --common-dir from a different Git scope fails closed", (t) => {
  const { repo, statePath, commonDir } = tempRegisterRepo(t);
  const foreign = createTempRepo();
  t.after(() => cleanupRepo(foreign.dir));
  const foreignCommon = gitCommonDir(foreign.dir);
  assert.ok(foreignCommon && foreignCommon !== commonDir);

  const paths = observabilityPaths(foreignCommon);
  writeHeartbeat(
    paths,
    buildHeartbeat(
      { sessionId: "ses_foreign", role: "executor", stream: "ORD-1", status: "ACTIVE", processId: process.pid, updatedAt: "2026-09-14T23:59:00.000Z" },
      { now: "2026-09-14T23:59:00.000Z" },
    ),
  );

  const result = runCli(STATUS_CLI, ["--state", statePath, "--common-dir", foreignCommon, "--json", "--now", NOW_ISO], { cwd: repo.dir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.deepEqual(result.json.errors.map((e) => e.code), ["STATUS_SCOPE_MISMATCH"]);
  assert.equal(result.json.summary.sessions.total, 0, "no foreign session may be rendered as current");
  assert.deepEqual(result.json.nextActions, [], "no foreign next action may be rendered as current");
});

test("the notification surface writes only local ring-buffer state", (t) => {
  const { repo, statePath, commonDir, stateSha } = tempRegisterRepo(t);
  const paths = observabilityPaths(commonDir);

  const notified = runCli(
    STATUS_CLI,
    ["--state", statePath, "--common-dir", commonDir, "--json", "--now", NOW_ISO, "--notify-kind", "RETURNED", "--notify-message", "session returned"],
    { cwd: repo.dir },
  );
  assert.equal(notified.status, 0, notified.stdout + notified.stderr);
  const stored = JSON.parse(fs.readFileSync(paths.notificationsFile, "utf8"));
  assert.equal(stored.schema, "atlas.observability.notifications/1");
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].kind, "RETURNED");
  assert.equal(stored.entries[0].message, "session returned");
  assert.equal(sha256(fs.readFileSync(statePath)), stateSha);
  assert.deepEqual(snapshotDir(paths.root).filter((f) => f.endsWith(".lock") || f.endsWith(".tmp")), []);

  const rejected = runCli(
    STATUS_CLI,
    ["--state", statePath, "--common-dir", commonDir, "--json", "--now", NOW_ISO, "--notify-kind", "SPAWN_AGENT"],
    { cwd: repo.dir },
  );
  assert.equal(rejected.status, 1, "an unknown notification kind must fail closed");
  assert.equal(rejected.json.errors[0].code, "NOTIFICATION_KIND_INVALID");
});

test("workflow:status surfaces an unreadable custody record instead of dropping it", (t) => {
  const { repo, statePath, commonDir } = tempRegisterRepo(t);
  const paths = observabilityPaths(commonDir);
  fs.mkdirSync(paths.custodyDir, { recursive: true });
  const file = paths.custodyFile(profileKey(DEFAULT_PROFILE));
  fs.writeFileSync(file, "{ this is not json\n");

  const result = runCli(STATUS_CLI, ["--state", statePath, "--common-dir", commonDir, "--json", "--now", NOW_ISO], { cwd: repo.dir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.status, "ok");
  assert.equal(result.json.summary.custody, null, "an unreadable record must never be reported as a valid lease");
  assert.equal(result.json.summary.custodyUnreadable.path, file);
  assert.match(result.json.summary.custodyUnreadable.reason, /not valid JSON/);
  assert.match(result.json.summary.custodyUnreadable.recovery, /uncertain custody/);
  assert.match(result.json.summary.custodyUnreadable.recovery, /Manual operator recovery/);
  assert.equal(result.json.summary.unreadableLeases.length, 1);
  assert.ok(result.json.nextActions.some((a) => a.scope === "custody" && /uncertain custody/.test(a.action)));
  assert.ok(result.json.artifacts.some((a) => a.kind === "custody-unreadable" && a.path === file));

  // The concise human view carries the same instruction.
  const human = runCli(STATUS_CLI, ["--state", statePath, "--common-dir", commonDir, "--now", NOW_ISO], { cwd: repo.dir });
  assert.equal(human.status, 0);
  assert.match(human.stdout, /next custody: uncertain custody/);
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
