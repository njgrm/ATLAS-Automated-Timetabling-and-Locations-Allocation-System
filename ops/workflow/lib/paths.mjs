// ops/workflow/lib/paths.mjs
// One repo-relative artifact/packet resolver shared by every transition that
// must read a caller-named file inside the repository (refresh-artifact-pin,
// record-approval, create-stream --packet-path). It exists so a second,
// weaker path parser is never written: containment rules live in exactly one
// place.
//
// Fail-closed by construction. A reference is rejected when it is empty, NUL
// bearing, absolute, drive-qualified, UNC, contains a `..` segment, resolves
// outside the repository root after normalization, escapes through a link, names
// nothing, names a non-file, or cannot be read. `ok: false` always carries a
// human-readable reason; the caller supplies its own typed error code.
import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "./git.mjs";

const DRIVE_QUALIFIED_RE = /^[A-Za-z]:/;

function isContained(root, candidate) {
  const r = normalizePath(root);
  const c = normalizePath(candidate);
  return c === r || c.startsWith(`${r}/`);
}

/**
 * Resolve `relPath` against `baseDir` (a resolved repository root) and read it.
 * @returns {{ok: true, absPath: string, bytes: Buffer} | {ok: false, message: string}}
 */
export function resolveRepoRelativeFile(baseDir, relPath) {
  if (typeof baseDir !== "string" || baseDir.trim().length === 0) {
    return { ok: false, message: "no repository root is available to resolve the path against" };
  }
  if (typeof relPath !== "string" || relPath.trim().length === 0) {
    return { ok: false, message: "the path is empty" };
  }
  const raw = relPath.trim();
  if (raw.includes("\0")) return { ok: false, message: `path "${raw}" contains a NUL byte` };
  if (DRIVE_QUALIFIED_RE.test(raw) || raw.startsWith("\\\\") || raw.startsWith("//")) {
    return { ok: false, message: `path "${raw}" is drive-qualified or UNC` };
  }
  if (path.isAbsolute(raw) || raw.startsWith("/") || raw.startsWith("\\")) {
    return { ok: false, message: `path "${raw}" is absolute, not repository-relative` };
  }
  const segments = raw.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.length === 0) return { ok: false, message: `path "${raw}" names no file` };
  if (segments.some((segment) => segment === "..")) {
    return { ok: false, message: `path "${raw}" escapes the repository root with ".."` };
  }

  const baseRoot = path.resolve(baseDir);
  const absPath = path.resolve(baseRoot, segments.join(path.sep));
  if (!isContained(baseRoot, absPath)) {
    return { ok: false, message: `path "${raw}" resolves outside the repository root` };
  }

  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return { ok: false, message: `path "${raw}" names no file in this repository` };
  }
  if (!stat.isFile()) return { ok: false, message: `path "${raw}" is not a regular file` };

  // Link escape: the canonical target of the file must still be inside the
  // canonical repository root. A stat failure here is unresolved containment and
  // therefore fails closed rather than falling back to the literal path.
  let realRoot;
  let realFile;
  try {
    realRoot = fs.realpathSync.native(baseRoot);
    realFile = fs.realpathSync.native(absPath);
  } catch {
    return { ok: false, message: `path "${raw}" cannot be canonicalized for containment` };
  }
  if (!isContained(realRoot, realFile)) {
    return { ok: false, message: `path "${raw}" escapes the repository root through a link` };
  }

  let bytes;
  try {
    bytes = fs.readFileSync(realFile);
  } catch (err) {
    return { ok: false, message: `path "${raw}" could not be read: ${err.message}` };
  }
  return { ok: true, absPath: realFile, bytes };
}
