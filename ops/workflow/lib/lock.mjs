// ops/workflow/lib/lock.mjs
// Exclusive repository-common-dir lock for atomic state transitions.
//
// The lock lives in the Git common directory so every linked worktree of the
// same repository serializes through one file. Acquisition is O_EXCL; a lock is
// reclaimed ONLY after proving that its recorded owner process is absent. A lock
// is never deleted merely because it is old, and a lock owned by a live process
// (including another agent's session) always produces a typed contention error.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gitCommonDir } from "./git.mjs";

export const LOCK_FILE_NAME = "atlas-workflow.lock";
export const LOCK_SCHEMA = "atlas.workflow.lock/1";
export const DEFAULT_MAX_INSPECT = 6;
export const DEFAULT_BACKOFF_MS = 40;

function sleepSync(ms) {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

export function lockPathFor(repoRoot) {
  const common = repoRoot ? gitCommonDir(repoRoot) : null;
  const base = common || repoRoot || os.tmpdir();
  return path.join(base, LOCK_FILE_NAME);
}

// Liveness probe for a recorded owner pid. A missing process proves the owner is
// absent; EPERM means the process exists but belongs to another user.
export function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

export function readLockRecord(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Acquire the exclusive lock.
 * Returns { ok: true, lockPath, record, reclaimed } on success or
 * { ok: false, code, message, lockPath, owner? } on contention/failure.
 */
export function acquireLock({
  repoRoot,
  transition,
  streamId,
  statePath,
  maxInspect = DEFAULT_MAX_INSPECT,
  backoffMs = DEFAULT_BACKOFF_MS,
} = {}) {
  const lockPath = lockPathFor(repoRoot);
  const record = {
    schema: LOCK_SCHEMA,
    ownerPid: process.pid,
    ownerHost: os.hostname(),
    transition: transition || null,
    streamId: streamId === undefined ? null : streamId,
    statePath: statePath || null,
    acquiredAt: new Date().toISOString(),
  };
  let reclaimed = false;
  for (let attempt = 0; attempt <= maxInspect; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, `${JSON.stringify(record, null, 2)}\n`);
      fs.closeSync(fd);
      return { ok: true, lockPath, record, reclaimed };
    } catch (err) {
      if (err.code !== "EEXIST") {
        return { ok: false, code: "LOCK_ACQUIRE_FAILED", message: err.message, lockPath };
      }
      const existing = readLockRecord(lockPath);
      // Proof of absence, not age, is what authorizes reclaim.
      if (!existing || existing.ownerPid === undefined || !processAlive(existing.ownerPid)) {
        try {
          fs.unlinkSync(lockPath);
          reclaimed = true;
        } catch {
          /* another writer won the reclaim race; retry below */
        }
        continue;
      }
      if (attempt < maxInspect) {
        sleepSync(backoffMs);
        continue;
      }
      return {
        ok: false,
        code: "LOCK_CONTENTION",
        message: `lock ${lockPath} is held by live pid ${existing.ownerPid} (${existing.transition || "unknown transition"})`,
        lockPath,
        owner: existing,
      };
    }
  }
  return { ok: false, code: "LOCK_CONTENTION", message: `lock ${lockPath} could not be acquired within the bounded inspection window`, lockPath };
}

// Release only a lock this process owns. Never removes another owner's lock.
export function releaseLock(lock) {
  if (!lock || !lock.ok || !lock.lockPath) return;
  const existing = readLockRecord(lock.lockPath);
  if (existing && existing.ownerPid !== process.pid) return;
  try {
    fs.unlinkSync(lock.lockPath);
  } catch {
    /* already gone */
  }
}

export function inspectLock(repoRoot) {
  const lockPath = lockPathFor(repoRoot);
  if (!fs.existsSync(lockPath)) return { held: false, lockPath, owner: null, ownerAlive: false };
  const owner = readLockRecord(lockPath);
  return { held: true, lockPath, owner, ownerAlive: !!(owner && processAlive(owner.ownerPid)) };
}
