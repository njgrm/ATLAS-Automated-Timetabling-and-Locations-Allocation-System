// A2 lock contract: atomic publication and fail-closed reclaim.
//
// The lock must never be deleted without proof that its recorded owner process
// is absent. Publication is a no-overwrite hard link, so a visible lock always
// carries a complete owner record.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createTempRepo, cleanupRepo } from "./harness.mjs";
import { acquireLock, releaseLock, inspectLock, lockPathFor } from "../lib/lock.mjs";

const repo = createTempRepo();
const LOCK = lockPathFor(repo.dir);
process.on("exit", () => cleanupRepo(repo.dir));

function reset() {
  try {
    fs.unlinkSync(LOCK);
  } catch {
    /* absent */
  }
}

function readLock() {
  return fs.readFileSync(LOCK, "utf8");
}

// Owner pid that cannot exist, so `processAlive` is provably false.
const ABSENT_PID = 2147480000;

test("a successful acquire publishes a complete readable owner record", () => {
  reset();
  const lock = acquireLock({ repoRoot: repo.dir, transition: "unit", streamId: "S" });
  assert.equal(lock.ok, true);
  assert.equal(lock.reclaimed, false);
  const record = JSON.parse(readLock());
  assert.equal(record.ownerPid, process.pid);
  assert.equal(record.transition, "unit");
  releaseLock(lock);
  assert.equal(fs.existsSync(LOCK), false);
});

test("an empty lock is never reclaimed or deleted", () => {
  reset();
  fs.writeFileSync(LOCK, "");
  const lock = acquireLock({ repoRoot: repo.dir, transition: "unit", maxInspect: 2, backoffMs: 1 });
  assert.equal(lock.ok, false);
  assert.equal(lock.code, "LOCK_UNREADABLE");
  assert.equal(fs.existsSync(LOCK), true);
  assert.equal(readLock(), "", "the unproven lock keeps its exact bytes");
  reset();
});

test("a malformed lock is never reclaimed or deleted", () => {
  reset();
  fs.writeFileSync(LOCK, "{not json");
  const lock = acquireLock({ repoRoot: repo.dir, maxInspect: 2, backoffMs: 1 });
  assert.equal(lock.code, "LOCK_UNREADABLE");
  assert.equal(readLock(), "{not json");
  reset();
});

test("an ownerless record is never reclaimed or deleted", () => {
  reset();
  fs.writeFileSync(LOCK, JSON.stringify({ schema: "atlas.workflow.lock/1" }));
  const lock = acquireLock({ repoRoot: repo.dir, maxInspect: 2, backoffMs: 1 });
  assert.equal(lock.code, "LOCK_UNREADABLE");
  assert.equal(fs.existsSync(LOCK), true);
  reset();
});

test("a live owner produces typed contention and is never deleted", () => {
  reset();
  fs.writeFileSync(LOCK, JSON.stringify({ ownerPid: process.pid, transition: "holder" }));
  const lock = acquireLock({ repoRoot: repo.dir, maxInspect: 2, backoffMs: 1 });
  assert.equal(lock.code, "LOCK_CONTENTION");
  assert.equal(fs.existsSync(LOCK), true);
  reset();
});

test("a provably absent owner IS reclaimed (legit stale reclaim still works)", () => {
  reset();
  fs.writeFileSync(LOCK, JSON.stringify({ ownerPid: ABSENT_PID, transition: "dead" }));
  const lock = acquireLock({ repoRoot: repo.dir, transition: "unit", maxInspect: 2, backoffMs: 1 });
  assert.equal(lock.ok, true);
  assert.equal(lock.reclaimed, true);
  assert.equal(JSON.parse(readLock()).ownerPid, process.pid);
  releaseLock(lock);
});

test("releaseLock deletes only this process's own readable record", () => {
  reset();
  const own = acquireLock({ repoRoot: repo.dir, transition: "own" });
  releaseLock(own);
  assert.equal(fs.existsSync(LOCK), false);

  fs.writeFileSync(LOCK, JSON.stringify({ ownerPid: ABSENT_PID }));
  releaseLock({ ok: true, lockPath: LOCK });
  assert.equal(fs.existsSync(LOCK), true, "a foreign record must never be deleted");

  fs.writeFileSync(LOCK, "");
  releaseLock({ ok: true, lockPath: LOCK });
  assert.equal(fs.existsSync(LOCK), true, "an unreadable record must never be deleted");
  reset();
});

test("inspectLock reports unreadable, live, and absent states consistently", () => {
  reset();
  fs.writeFileSync(LOCK, "");
  const empty = inspectLock(repo.dir);
  assert.equal(empty.held, true);
  assert.equal(empty.unreadable, true);
  assert.equal(empty.ownerAlive, false);

  fs.writeFileSync(LOCK, JSON.stringify({ ownerPid: process.pid }));
  const live = inspectLock(repo.dir);
  assert.equal(live.held, true);
  assert.equal(live.unreadable, false);
  assert.equal(live.ownerAlive, true);

  reset();
  const gone = inspectLock(repo.dir);
  assert.equal(gone.held, false);
  assert.equal(gone.unreadable, false);
});

test("a stray temp from a crashed publisher is never treated as a lock", () => {
  reset();
  const stray = `${LOCK}.999999.123.0.deadbeef.tmp`;
  fs.writeFileSync(stray, JSON.stringify({ ownerPid: ABSENT_PID }));
  const lock = acquireLock({ repoRoot: repo.dir, transition: "unit" });
  assert.equal(lock.ok, true, "a sibling temp must not block acquisition");
  assert.equal(JSON.parse(readLock()).ownerPid, process.pid);
  assert.equal(fs.existsSync(stray), true, "this tool does not manage another publisher's temp");
  releaseLock(lock);
  fs.unlinkSync(stray);
  reset();
});
