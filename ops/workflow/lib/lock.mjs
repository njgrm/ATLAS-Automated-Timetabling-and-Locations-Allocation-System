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
import { sha256Hex } from "./util.mjs";

export const LOCK_FILE_NAME = "atlas-workflow.lock";
export const CLAIM_FILE_SUFFIX = ".claim";
export const LOCK_SCHEMA = "atlas.workflow.lock/1";
export const DEFAULT_MAX_INSPECT = 6;
export const DEFAULT_BACKOFF_MS = 40;

// A hard link can fail with a non-EEXIST code when a concurrent create/remove
// races it (observed on Windows). Such a publish simply did not succeed, so it is
// retried within the bounded window instead of being reported as a hard failure.
export const TRANSIENT_LINK_ERRORS = new Set(["EPERM", "EACCES", "ENOENT", "EBUSY", "UNKNOWN"]);

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
    raw = fs.readFileSync(lockPath);
  } catch (err) {
    if (err && err.code === "ENOENT") return { kind: "GONE", reason: "lock disappeared", owner: null, fingerprint: null };
    return { kind: "UNPROVEN", reason: `lock is unreadable (${(err && err.code) || "unknown error"})`, owner: null, fingerprint: null };
  }
  const fingerprint = sha256Hex(raw);
  let record;
  try {
    record = JSON.parse(raw.toString("utf8"));
  } catch {
    const trimmed = raw.toString("utf8").trim();
    return { kind: "UNPROVEN", reason: trimmed.length === 0 ? "lock is empty" : "lock record is malformed JSON", owner: null, fingerprint };
  }
  if (record === null || typeof record !== "object" || Array.isArray(record) || !Number.isInteger(record.ownerPid) || record.ownerPid <= 0) {
    return { kind: "UNPROVEN", reason: "lock record has no integer ownerPid > 0", owner: record && typeof record === "object" && !Array.isArray(record) ? record : null, fingerprint };
  }
  if (processAlive(record.ownerPid)) return { kind: "LIVE", reason: `held by live pid ${record.ownerPid}`, owner: record, fingerprint };
  return { kind: "ABSENT", reason: `owner pid ${record.ownerPid} is provably absent`, owner: record, fingerprint };
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

export function claimPathFor(lockPath) {
  return `${lockPath}${CLAIM_FILE_SUFFIX}`;
}

/**
 * Serialized reclaim of a provably dead lock.
 *
 * The claim file (<lock>.claim) is an O_EXCL mutex: at most one reclaimer may be
 * inside this section at a time. Inside it we re-read the lock and require the
 * byte fingerprint to still match the dead record we classified; only then may
 * we unlink it and immediately CAS-publish our own staged record. A fresh
 * acquirer cannot publish while the dead record exists (linkSync => EEXIST), and
 * only this unique claim holder can remove it, so a live record can never be
 * unlinked by a reclaimer.
 *
 * Returns { result }: ACQUIRED | CONTENDED | NOT_ABSENT | CLAIM_BLOCKED | CLAIM_ERROR.
 * The claim file is always released in a finally and is never auto-deleted when
 * it already exists.
 */
function reclaimDeadLock({ lockPath, expectedFingerprint, tempPath }) {
  const claimPath = claimPathFor(lockPath);
  let claimFd;
  try {
    claimFd = fs.openSync(claimPath, "wx");
  } catch (err) {
    if (err.code === "EEXIST") return { result: "CLAIM_BLOCKED" };
    return { result: "CLAIM_ERROR", message: err.message };
  }
  try {
    let current;
    try {
      current = fs.readFileSync(lockPath);
    } catch (err) {
      if (err.code === "ENOENT") return { result: "CONTENDED" };
      return { result: "CLAIM_ERROR", message: err.message };
    }
    if (expectedFingerprint === null || sha256Hex(current) !== expectedFingerprint) {
      // The record changed or was replaced after classification: never touch it.
      return { result: "NOT_ABSENT" };
    }
    fs.unlinkSync(lockPath);
    try {
      fs.linkSync(tempPath, lockPath);
      return { result: "ACQUIRED" };
    } catch (err) {
      if (err.code === "EEXIST") return { result: "CONTENDED" };
      return { result: "CLAIM_ERROR", message: err.message };
    }
  } finally {
    try {
      fs.closeSync(claimFd);
    } catch {
      /* best effort */
    }
    try {
      fs.unlinkSync(claimPath);
    } catch {
      /* the claim is ours; a failed unlink leaves a recovery note for an operator */
    }
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
    let tempPath;
    try {
      tempPath = writeTempRecord(lockPath, record, attempt);
    } catch (err) {
      return { ok: false, code: "LOCK_ACQUIRE_FAILED", message: `could not stage a lock record beside ${lockPath}: ${err.message}`, lockPath };
    }
    try {
      // CAS publication: linkSync fails with EEXIST while any lock file exists.
      let linked = false;
      try {
        fs.linkSync(tempPath, lockPath);
        linked = true;
      } catch (err) {
        if (err.code !== "EEXIST" && !TRANSIENT_LINK_ERRORS.has(err.code)) {
          return { ok: false, code: "LOCK_ACQUIRE_FAILED", message: `could not publish lock ${lockPath}: ${err.message}`, lockPath };
        }
        // EEXIST, or a transient create/remove race: the publish did not succeed.
      }
      if (linked) return { ok: true, lockPath, record, reclaimed };

      // EEXIST: inspect the holder before doing anything destructive.
      const verdict = classifyLock(lockPath);

      if (verdict.kind === "ABSENT") {
        const outcome = reclaimDeadLock({ lockPath, expectedFingerprint: verdict.fingerprint, tempPath });
        if (outcome.result === "ACQUIRED") return { ok: true, lockPath, record, reclaimed: true };
        if (outcome.result === "CLAIM_ERROR") {
          return { ok: false, code: "LOCK_ACQUIRE_FAILED", message: `could not reclaim lock ${lockPath}: ${outcome.message}`, lockPath };
        }
        // CONTENDED / NOT_ABSENT / CLAIM_BLOCKED re-enter the bounded loop.
        if (attempt < maxInspect) {
          sleepSync(backoffMs);
          continue;
        }
        if (outcome.result === "CLAIM_BLOCKED") {
          return {
            ok: false,
            code: "LOCK_CONTENTION",
            message: `lock ${lockPath} reclaim is blocked by an active or stale claim file (${claimPathFor(lockPath)}) that this tool never removes automatically`,
            lockPath,
          };
        }
        return { ok: false, code: "LOCK_CONTENTION", message: `lock ${lockPath} could not be acquired within the bounded inspection window`, lockPath };
      }

      if (verdict.kind === "LIVE") {
        if (attempt < maxInspect) {
          sleepSync(backoffMs);
          continue;
        }
        return {
          ok: false,
          code: "LOCK_CONTENTION",
          message: `lock ${lockPath} is held by live pid ${verdict.owner.ownerPid} (${verdict.owner.transition || "unknown transition"})`,
          lockPath,
          owner: verdict.owner,
        };
      }

      if (verdict.kind === "GONE") {
        if (attempt < maxInspect) {
          sleepSync(backoffMs);
          continue;
        }
        return { ok: false, code: "LOCK_CONTENTION", message: `lock ${lockPath} could not be acquired within the bounded inspection window`, lockPath };
      }

      // UNPROVEN: never reclaimable.
      if (attempt < maxInspect) {
        sleepSync(backoffMs);
        continue;
      }
      return {
        ok: false,
        code: "LOCK_UNREADABLE",
        message: `lock ${lockPath} is not a complete owner record (${verdict.reason}); refusing to reclaim without proof the owner is absent`,
        lockPath,
        owner: verdict.owner,
      };
    } finally {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* a stray temp is never a lock; a crashed publisher may leave one behind */
      }
    }
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
