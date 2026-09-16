// ops/workflow/lib/util.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// A pinned document identity is the LF-normalized SHA-256 of its bytes: a
// checkout that rewrote LF to CRLF must never change a pin. The normalization is
// exactly `\r\n` -> `\n` (the canonical reproduction command in every packet), so
// a lone CR is preserved and the transform is idempotent.
export function lfNormalizedText(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return buffer.toString("utf8").replace(/\r\n/g, "\n");
}

export function lfSha256(bytes) {
  return sha256Hex(Buffer.from(lfNormalizedText(bytes), "utf8"));
}

export function readBytes(filePath) {
  try {
    return { ok: true, bytes: fs.readFileSync(filePath) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// Temp names must be unique per call, not per (pid, millisecond): two rapid
// writes in one process can share a millisecond, and a colliding stage path
// would let one write publish the other's bytes or fail with ENOENT. A monotonic
// counter plus a random suffix keeps publication atomic under that burst.
let tempCounter = 0;

function tempPathFor(filePath, suffix) {
  tempCounter += 1;
  const dir = path.dirname(filePath);
  const random = Math.random().toString(16).slice(2, 8);
  return path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${tempCounter}.${random}${suffix}`);
}

// Windows can transiently refuse to replace a file that another process is
// concurrently opening, renaming, or scanning (for example antivirus). The lock
// module already treats this class of failure as transient for its hard-link
// publication; a staged rename must be equally resilient, otherwise a concurrent
// publish is silently lost. Retries are bounded and a non-transient error is
// rethrown immediately.
const TRANSIENT_RENAME_ERRORS = new Set(["EPERM", "EACCES", "EBUSY", "ENOENT", "UNKNOWN"]);

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(tmpPath, filePath) {
  let lastError = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      lastError = err;
      if (!TRANSIENT_RENAME_ERRORS.has(err.code)) break;
      sleepSync(4 + attempt * 4);
    }
  }
  throw lastError;
}

// Write bytes via a temp file in the same directory, then rename over the target.
export function writeFileAtomicSync(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = tempPathFor(filePath, ".tmp");
  fs.writeFileSync(tmp, contents);
  try {
    renameWithRetry(tmp, filePath);
  } catch (err) {
    // This call owns the staged bytes; never leave them behind on a failed publish.
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* already gone */
    }
    throw err;
  }
}

// Stage bytes beside a target without touching the target. Returns the temp path.
export function stageFileSync(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = tempPathFor(filePath, ".stage.tmp");
  fs.writeFileSync(tmp, contents);
  return tmp;
}

// Publish a staged temp file over its target, and discard it on demand.
export function commitStagedSync(tmpPath, filePath) {
  renameWithRetry(tmpPath, filePath);
}

export function discardStagedSync(tmpPath) {
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* already gone */
  }
}
