// ops/workflow/lib/git.mjs
// Minimal read-only Git helpers. Never mutates the repository.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function runGit(args, cwd) {
  const res = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", windowsHide: true });
  if (res.error) {
    return { ok: false, status: -1, stdout: "", stderr: String(res.error.message || res.error) };
  }
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

// Same as runGit but with bytes piped to stdin (used to batch object lookups).
export function runGitWithInput(args, cwd, input) {
  const res = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", input, windowsHide: true });
  if (res.error) {
    return { ok: false, status: -1, stdout: "", stderr: String(res.error.message || res.error) };
  }
  return { ok: res.ok ?? res.status === 0, status: res.status, stdout: res.stdout || "", stderr: res.stderr || "" };
}

// Repo root is stable for a directory; memoizing avoids one process spawn per
// verification (process creation dominates runtime on this host).
const repoRootCache = new Map();

export function resolveRepoRoot(dir) {
  const key = path.resolve(dir);
  if (repoRootCache.has(key)) return repoRootCache.get(key);
  const res = runGit(["rev-parse", "--show-toplevel"], key);
  const root = res.ok && res.stdout.trim().length > 0 ? res.stdout.trim() : null;
  repoRootCache.set(key, root);
  return root;
}

export function shaExists(repoRoot, sha) {
  const res = runGit(["cat-file", "-e", `${sha}^{commit}`], repoRoot);
  return res.ok;
}

// Existence of ANY Git object (blob, tree, commit, tag). Pin linting resolves a
// 40-hex directive token as an object, not necessarily a commit.
export function objectExists(repoRoot, sha) {
  return runGit(["cat-file", "-e", sha], repoRoot).ok;
}

// The object type of a 40-hex token, or null when it does not resolve.
export function objectType(repoRoot, sha) {
  const res = runGit(["cat-file", "-t", sha], repoRoot);
  return res.ok ? res.stdout.trim() || null : null;
}

// Raw blob bytes. A text decode/re-encode round trip must never be trusted for a
// byte identity, so this path returns a Buffer with no encoding applied.
export function catFileBlob(repoRoot, spec) {
  const res = spawnSync("git", ["-C", repoRoot, "cat-file", "blob", spec], { windowsHide: true });
  if (res.error || res.status !== 0) {
    return { ok: false, stderr: res.error ? String(res.error.message || res.error) : String(res.stderr || "") };
  }
  return { ok: true, bytes: Buffer.isBuffer(res.stdout) ? res.stdout : Buffer.from(res.stdout || "", "utf8") };
}

// Resolve existence for many SHAs with a single `git cat-file --batch-check`.
export function shaExistsMany(repoRoot, shas) {
  const result = new Map();
  const unique = [...new Set(shas.filter((s) => typeof s === "string" && /^[0-9a-f]{40}$/.test(s)))];
  for (const sha of shas) if (typeof sha === "string") result.set(sha, false);
  if (unique.length === 0) return result;
  const res = runGitWithInput(["cat-file", "--batch-check"], repoRoot, `${unique.join("\n")}\n`);
  if (!res.ok) return result;
  for (const line of res.stdout.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const [name, type] = line.split(" ");
    if (name) result.set(name, type !== undefined && type !== "missing");
  }
  return result;
}

export function isAncestor(repoRoot, ancestor, descendant) {
  const res = runGit(["merge-base", "--is-ancestor", ancestor, descendant], repoRoot);
  return res.ok;
}

export function isAncestorOrEqual(repoRoot, ancestor, descendant) {
  if (ancestor === descendant) return true;
  return isAncestor(repoRoot, ancestor, descendant);
}

export function diffNameOnly(repoRoot, base, candidate) {
  const res = runGit(["diff", "--name-only", "--no-renames", `${base}...${candidate}`], repoRoot);
  if (!res.ok) return null;
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Normalize a path for scope/identity comparison (case-insensitive on Windows).
export function normalizePath(p) {  return String(p)
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

// Absolute path of the repository common Git directory (shared by all linked
// worktrees), used for the exclusive workflow lock. Returns null when the path
// is not inside a Git repository.
export function gitCommonDir(repoRoot) {
  const res = runGit(["rev-parse", "--git-common-dir"], repoRoot);
  if (!res.ok) return null;
  const raw = res.stdout.trim();
  if (raw.length === 0) return null;
  return path.resolve(repoRoot, raw);
}

// Porcelain status of a worktree, or null when the path is absent or not a
// resolvable Git worktree. Read-only: never mutates the repository.
export function worktreeStatusPorcelain(worktreePath) {
  if (!worktreePath) return null;
  let stat;
  try {
    stat = fs.statSync(worktreePath);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return null;
  const res = runGit(["status", "--porcelain"], worktreePath);
  if (!res.ok) return null;
  return res.stdout;
}

// A per-operation memo for read-only Git facts. Callers that validate the same
// repository several times (the atomic transition engine validates the current
// and candidate documents) resolve each fact once. Keys include the exact query,
// so results are never shared across different repositories or revisions.
export function createGitMemo() {
  const map = new Map();
  const memo = (key, fn) => {
    if (map.has(key)) return map.get(key);
    const value = fn();
    map.set(key, value);
    return value;
  };
  return {
    map,
    shaExists: (repoRoot, sha) => memo(`sha:${repoRoot}:${sha}`, () => shaExists(repoRoot, sha)),
    shaExistsMany: (repoRoot, shas) => memo(`exist:${repoRoot}:${[...new Set(shas)].sort().join(",")}`, () => shaExistsMany(repoRoot, shas)),
    isAncestor: (repoRoot, a, b) => (a === b ? true : memo(`anc:${repoRoot}:${a}:${b}`, () => isAncestor(repoRoot, a, b))),
    isAncestorOrEqual: (repoRoot, a, b) => (a === b ? true : memo(`anc:${repoRoot}:${a}:${b}`, () => isAncestor(repoRoot, a, b))),
    diffNameOnly: (repoRoot, base, candidate) => memo(`diff:${repoRoot}:${base}:${candidate}`, () => diffNameOnly(repoRoot, base, candidate)),
  };
}
