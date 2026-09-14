// ops/workflow/lib/lock.mjs
// Exclusive repository-common-dir lock for atomic state transitions.
//
// The lock lives in the Git common directory so every linked worktree of the
// same repository serializes through one file.
//
// Publication is atomic: the complete owner record is written to a unique
// sibling temp file and published with a no-overwrite hard link (`linkSync`,
// which fails with EEXIST while the lock is held). A visible lock therefore
// always carries a complete owner record; this tool can never create a visible
// empty or partial lock.
//
// Reclaim is fail-closed: a lock is removed ONLY when a readable record names a
// positive integer `ownerPid` whose process is provably absent. An unreadable,
// empty, malformed, or ownerless lock is never deleted — it is reported as
// `LOCK_UNREADABLE` after the bounded inspection window so that removing it
// requires a human to prove the owner is gone.
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
 * Classify the current lock file.
 *
 *   GONE     — the path does not exist (or vanished); nothing to reclaim
 *   LIVE     — a readable record with a live positive ownerPid
 *   ABSENT   — a readable record with a positive ownerPid whose process is gone
 *   UNPROVEN — unreadable, empty, malformed, or ownerless: never reclaimable
 *
 * Only ABSENT authorizes reclaim.
 */
export function classifyLock(lockPath) {
  let raw;
  try {
    raw = fs.readFileSync(lockPath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { kind: "GONE", reason: "lock disappeared", owner: null };
    return { kind: "UNPROVEN", reason: `lock is unreadable (${(err && err.code) || "unknown error"})`, owner: null };
  }
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return { kind: "UNPROVEN", reason: raw.trim().length === 0 ? "lock is empty" : "lock record is malformed JSON", owner: null };
  }
  if (record === null || typeof record !== "object" || Array.isArray(record) || !Number.isInteger(record.ownerPid) || record.ownerPid <= 0) {
    return { kind: "UNPROVEN", reason: "lock record has no integer ownerPid > 0", owner: record && typeof record === "object" && !Array.isArray(record) ? record : null };
  }
  if (processAlive(record.ownerPid)) return { kind: "LIVE", reason: `held by live pid ${record.ownerPid}`, owner: record };
  return { kind: "ABSENT", reason: `owner pid ${record.ownerPid} is provably absent`, owner: record };
}

// Stage a complete record beside the lock path. The temp is never a lock.
function writeTempRecord(lockPath, record, attempt) {
  const dir = path.dirname(lockPath);
  fs.mkdirSync(dir, { recursive: true });
  const suffix = Math.random().toString(16).slice(2, 10);
  const tempPath = path.join(dir, `${path.basename(lockPath)}.${process.pid}.${Date.now()}.${attempt}.${suffix}.tmp`);
  fs.writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  return tempPath;
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
    let tempPath;
    try {
      tempPath = writeTempRecord(lockPath, record, attempt);
    } catch (err) {
      return { ok: false, code: "LOCK_ACQUIRE_FAILED", message: `could not stage a lock record beside ${lockPath}: ${err.message}`, lockPath };
    }
    let linked = false;
    try {
      fs.linkSync(tempPath, lockPath);
      linked = true;
    } catch (err) {
      if (err.code !== "EEXIST") {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          /* best effort */
        }
        return { ok: false, code: "LOCK_ACQUIRE_FAILED", message: `could not publish lock ${lockPath}: ${err.message}`, lockPath };
      }
    }
    try {
      fs.unlinkSync(tempPath);
    } catch {
      /* a stray temp is never a lock; a crashed publisher may leave one behind */
    }
    if (linked) return { ok: true, lockPath, record, reclaimed };

    // EEXIST: inspect the holder before doing anything destructive.
    const verdict = classifyLock(lockPath);
    if (verdict.kind === "ABSENT") {
      try {
        fs.unlinkSync(lockPath);
        reclaimed = true;
      } catch {
        /* another writer won the reclaim race; retry below */
      }
      continue;
    }
    if (verdict.kind === "GONE") continue;
    if (attempt < maxInspect) {
      sleepSync(backoffMs);
      continue;
    }
    if (verdict.kind === "LIVE") {
      return {
        ok: false,
        code: "LOCK_CONTENTION",
        message: `lock ${lockPath} is held by live pid ${verdict.owner.ownerPid} (${verdict.owner.transition || "unknown transition"})`,
        lockPath,
        owner: verdict.owner,
      };
    }
    return {
      ok: false,
      code: "LOCK_UNREADABLE",
      message: `lock ${lockPath} is not a complete owner record (${verdict.reason}); refusing to reclaim without proof the owner is absent`,
      lockPath,
      owner: verdict.owner,
    };
  }
  return { ok: false, code: "LOCK_CONTENTION", message: `lock ${lockPath} could not be acquired within the bounded inspection window`, lockPath };
}

// Release only a lock this process provably owns. An unreadable or foreign
// record is never deleted.
export function releaseLock(lock) {
  if (!lock || !lock.ok || !lock.lockPath) return;
  const verdict = classifyLock(lock.lockPath);
  if (verdict.kind !== "LIVE" || !verdict.owner || verdict.owner.ownerPid !== process.pid) return;
  try {
    fs.unlinkSync(lock.lockPath);
  } catch {
    /* already gone */
  }
}

export function inspectLock(repoRoot) {
  const lockPath = lockPathFor(repoRoot);
  const verdict = classifyLock(lockPath);
  if (verdict.kind === "GONE") return { held: false, lockPath, owner: null, ownerAlive: false, unreadable: false };
  return {
    held: true,
    lockPath,
    owner: verdict.owner,
    ownerAlive: verdict.kind === "LIVE",
    unreadable: verdict.kind === "UNPROVEN",
  };
}
