// ops/workflow/lib/directive.mjs
// The single directive-pin resolver and packet-pin linter.
//
// A directive pin is the pair `(blob <git-sha1>, LF-SHA-256 <hash>)` of
// `AGENTS.md`, or the hash alone where a packet cites only the hash. Two
// independent things are checked:
//
//   1. Reproducibility. On a directive-marked line every 40-hex token must
//      resolve as a Git object, and every *declared* LF-SHA-256 field must equal
//      the LF-normalized SHA-256 of the directive blob at the current tip OR at
//      ANY historical tip. A queued packet that pinned an older directive
//      therefore stays valid after a later directive bump, while a value that
//      reproduces at no tip fails closed.
//   2. Pair recomputation. The documented pair is recomputed from raw blob bytes;
//      a disagreement is PIN_HASH_MISMATCH.
//
// Scope discipline: only tokens in the documented declaration slots are pins. A
// hash that is not declared (`liveSemanticRevision`, a fixture fingerprint, or a
// superseded value quoted in a correction note) is prose and never fires, and a
// marker-free line never fires a blob-resolution rule.
import fs from "node:fs";
import path from "node:path";
import { catFileBlob, objectExists, objectType, resolveRepoRoot, runGit } from "./git.mjs";
import { lfSha256 } from "./util.mjs";

export const DIRECTIVE_PATH = "AGENTS.md";
export const DIRECTIVE_REF = "origin/main";
export const DIRECTIVE_MARKER_RE = /origin\/main:AGENTS\.md|\bDirective\b/;

export const PIN_BLOB_UNRESOLVED = "PIN_BLOB_UNRESOLVED";
export const PIN_DIRECTIVE_HASH_UNKNOWN = "PIN_DIRECTIVE_HASH_UNKNOWN";
export const PIN_HASH_MISMATCH = "PIN_HASH_MISMATCH";

const SHA40_RE = /^[0-9a-f]{40}$/;
const SHA64_RE = /^[0-9a-f]{64}$/;

export function isSha40(value) {
  return typeof value === "string" && SHA40_RE.test(value);
}

export function isSha64(value) {
  return typeof value === "string" && SHA64_RE.test(value);
}

/** All non-overlapping 40- or 64-hex tokens on a line, left to right. */
export function hexTokens(line, width) {
  const re = new RegExp(`(?<![0-9a-f])[0-9a-f]{${width}}(?![0-9a-f])`, "g");
  return [...line.matchAll(re)].map((match) => match[0]);
}

// A declared hash field is a `<… SHA-256> <64-hex>` slot: the label must
// immediately precede the token (allowing only a separator and optional
// backticks). `LF-SHA-256`, `LF-normalized SHA-256` and `raw Git-blob SHA-256`
// all match; "the previous value `ffd14520…`" does not. The window is wide
// enough for the separator plus a backticked 64-hex token and narrow enough that
// the next hash in the prose is never captured.
const HASH_FIELD_WINDOW = 80;
const BLOB_FIELD_WINDOW = 48;

function declaredHashes(line) {
  const out = [];
  const re = /SHA[\s-]?256/gi;
  let match;
  while ((match = re.exec(line)) !== null) {
    const start = match.index + match[0].length;
    const window = line.slice(start, start + HASH_FIELD_WINDOW);
    const token = window.match(/(?<![0-9a-f])([0-9a-f]{64})(?![0-9a-f])/);
    if (token) out.push({ token: token[1], index: start + token.index });
  }
  return out;
}

// A declared blob field is a `<… blob> <40-hex>` slot.
function declaredBlobs(line) {
  const out = [];
  const re = /\bblob\b/gi;
  let match;
  while ((match = re.exec(line)) !== null) {
    const start = match.index + match[0].length;
    const window = line.slice(start, start + BLOB_FIELD_WINDOW);
    const token = window.match(/(?<![0-9a-f])([0-9a-f]{40})(?![0-9a-f])/);
    if (token) out.push({ token: token[1], index: start + token.index });
  }
  return out;
}

/** The resolved blob id at `<tip>:AGENTS.md`, or null. */
export function directiveBlobIdAtTip(repoRoot, tip) {
  if (!isSha40(tip)) return null;
  const res = runGit(["rev-parse", "--verify", "--quiet", `${tip}:${DIRECTIVE_PATH}`], repoRoot);
  const blob = res.ok ? res.stdout.trim() : "";
  return isSha40(blob) ? blob : null;
}

/** The directive pin `{ blob, lfSha256 }` at a tip, or null when unresolved. */
export function directivePinAtTip(repoRoot, tip) {
  const blob = directiveBlobIdAtTip(repoRoot, tip);
  if (!blob) return null;
  const bytes = catFileBlob(repoRoot, blob);
  if (!bytes.ok) return null;
  return { blob, lfSha256: lfSha256(bytes.bytes) };
}

/** The LF-SHA-256 of the operating `AGENTS.md` copy at the repository root. */
export function operatingCopyHash(repoRoot) {
  try {
    return lfSha256(fs.readFileSync(path.join(repoRoot, DIRECTIVE_PATH)));
  } catch {
    return null;
  }
}

const historyCache = new Map();

/**
 * Every distinct `AGENTS.md` blob in reachable history and its LF-SHA-256.
 * Memoized per repository root; the value is a pure function of Git history.
 */
export function directiveHistory(repoRoot) {
  const key = path.resolve(repoRoot);
  if (historyCache.has(key)) return historyCache.get(key);
  const commits = new Set();
  const log = runGit(["log", "--all", "--format=%H", "--", DIRECTIVE_PATH], repoRoot);
  if (log.ok) {
    for (const line of log.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (isSha40(trimmed)) commits.add(trimmed);
    }
  }
  for (const ref of ["HEAD", DIRECTIVE_REF, "refs/remotes/origin/main"]) {
    const res = runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], repoRoot);
    const commit = res.ok ? res.stdout.trim() : "";
    if (isSha40(commit)) commits.add(commit);
  }
  const blobs = new Set();
  const hashes = new Set();
  const blobToHash = new Map();
  for (const commit of commits) {
    const blob = directiveBlobIdAtTip(repoRoot, commit);
    if (!blob || blobToHash.has(blob)) continue;
    const bytes = catFileBlob(repoRoot, blob);
    if (!bytes.ok) continue;
    const hash = lfSha256(bytes.bytes);
    blobToHash.set(blob, hash);
    blobs.add(blob);
    hashes.add(hash);
  }
  const history = { blobs, hashes, blobToHash };
  historyCache.set(key, history);
  return history;
}

/** Git-backed resolvers for `lintDirectivePins`, shared by the CLI and the engine. */
export function gitPinResolvers(repoRoot) {
  const history = directiveHistory(repoRoot);
  const typeCache = new Map();
  const hashCache = new Map();
  return {
    directiveHashes: history.hashes,
    objectExists: (sha) => objectExists(repoRoot, sha),
    objectType: (sha) => {
      if (typeCache.has(sha)) return typeCache.get(sha);
      const type = objectType(repoRoot, sha);
      typeCache.set(sha, type);
      return type;
    },
    blobHashOf: (sha) => {
      if (hashCache.has(sha)) return hashCache.get(sha);
      const bytes = catFileBlob(repoRoot, sha);
      const hash = bytes.ok ? lfSha256(bytes.bytes) : null;
      hashCache.set(sha, hash);
      return hash;
    },
  };
}

/**
 * Lint one document body. Returns an array of `{code, message, path}` errors.
 * Resolvers are injected so the rule is testable without a repository and so the
 * CLI and the transition engine run the identical implementation.
 */
export function lintDirectivePins(body, resolvers) {
  const errors = [];
  const lines = String(body).split(/\r?\n/);
  const markerLine = lines.map((line) => DIRECTIVE_MARKER_RE.test(line));
  const blobFields = lines.map(declaredBlobs);
  const hashFields = lines.map(declaredHashes);

  lines.forEach((line, i) => {
    if (!markerLine[i]) return;
    for (const token of hexTokens(line, 40)) {
      if (!resolvers.objectExists(token)) {
        errors.push({
          code: PIN_BLOB_UNRESOLVED,
          message: `directive-marked line cites Git object ${token}, which does not exist in this repository`,
          path: `line ${i + 1}`,
        });
      }
    }
    for (const field of hashFields[i]) {
      if (!resolvers.directiveHashes.has(field.token)) {
        errors.push({
          code: PIN_DIRECTIVE_HASH_UNKNOWN,
          message: `declared directive hash ${field.token} reproduces at no ${DIRECTIVE_PATH} blob in reachable history`,
          path: `line ${i + 1}`,
        });
      }
    }
  });

  lines.forEach((line, i) => {
    if (!markerLine[i] || blobFields[i].length === 0) return;
    // The documented pair may be declared on one line or continued on the next
    // one or two lines (the multi-line `blob …` / `LF-SHA-256 …` form).
    let hashes = hashFields[i];
    if (hashes.length === 0) {
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
        if (hashFields[j].length > 0) {
          hashes = hashFields[j];
          break;
        }
      }
    }
    if (hashes.length === 0) return;
    for (const blob of blobFields[i]) {
      if (resolvers.objectType(blob.token) !== "blob") continue;
      const actual = resolvers.blobHashOf(blob.token);
      if (actual === null) {
        errors.push({
          code: PIN_BLOB_UNRESOLVED,
          message: `declared directive blob ${blob.token} is a blob but its bytes could not be read`,
          path: `line ${i + 1}`,
        });
        continue;
      }
      for (const hash of hashes) {
        if (actual !== hash.token) {
          errors.push({
            code: PIN_HASH_MISMATCH,
            message: `declared pin pair disagrees: blob ${blob.token} has LF-SHA-256 ${actual}, not ${hash.token}`,
            path: `line ${i + 1}`,
          });
        }
      }
    }
  });

  return errors;
}

/**
 * Fail-closed registration guard (WF-C10 section 3.4): the operating `AGENTS.md`
 * at the repository root must match the directive at the observed tip. Never
 * silently skips: an unresolvable tip is DIRECTIVE_REMOTE_UNRESOLVED.
 */
export function checkDirectiveCopy(repoRoot, observedTip) {
  const pin = directivePinAtTip(repoRoot, observedTip);
  if (!pin) {
    return {
      ok: false,
      code: "DIRECTIVE_REMOTE_UNRESOLVED",
      message: `no ${DIRECTIVE_PATH} blob could be resolved at ${observedTip}; the directive copy cannot be confirmed`,
    };
  }
  const actual = operatingCopyHash(repoRoot);
  if (actual === null) {
    return { ok: false, code: "DIRECTIVE_COPY_STALE", message: `the operating ${DIRECTIVE_PATH} is unreadable at the repository root` };
  }
  if (actual !== pin.lfSha256) {
    return {
      ok: false,
      code: "DIRECTIVE_COPY_STALE",
      message: `the operating ${DIRECTIVE_PATH} LF-SHA-256 ${actual} != the directive at ${observedTip} (${pin.lfSha256}); run from a checkout whose copy matches the observed tip`,
    };
  }
  return { ok: true, blob: pin.blob, lfSha256: pin.lfSha256 };
}

export { resolveRepoRoot };
